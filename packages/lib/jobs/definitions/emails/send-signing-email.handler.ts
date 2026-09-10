import DocumentInviteEmailTemplate from '@documenso/email/templates/document-invite';
import { isRecipientEmailValidForSending } from '@documenso/lib/utils/recipients';
import { prisma } from '@documenso/prisma';
import { msg } from '@lingui/core/macro';
import {
  DocumentSource,
  DocumentStatus,
  EnvelopeType,
  OrganisationType,
  RecipientRole,
  SendStatus,
} from '@prisma/client';
import { createElement } from 'react';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { RECIPIENT_ROLE_TO_EMAIL_TYPE, RECIPIENT_ROLES_DESCRIPTION } from '../../../constants/recipient-roles';
import { buildEnvelopeEmailHeaders } from '../../../server-only/email/build-envelope-email-headers';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { assertOrganisationRatesAndLimits } from '../../../server-only/rate-limit/assert-organisation-rates-and-limits';
import { updateRecipientNextReminder } from '../../../server-only/recipient/update-recipient-next-reminder';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../../types/document-audit-logs';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { stripPdfExtension } from '../../../universal/strip-pdf-extension';
import { getFileServerSide } from '../../../universal/upload/get-file.server';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import { unsafeBuildEnvelopeIdQuery } from '../../../utils/envelope';
import { appendEnvelopeSubjectReference } from '../../../utils/envelope-subject-reference';
import { getRecipientRequestSubject } from '../../../utils/recipient-request-subject';
import { renderCustomEmailTemplate } from '../../../utils/render-custom-email-template';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendSigningEmailJobDefinition } from './send-signing-email';

export const run = async ({ payload, io }: { payload: TSendSigningEmailJobDefinition; io: JobRunIO }) => {
  const { userId, documentId, recipientId, requestMetadata } = payload;

  const [user, envelope, recipient] = await Promise.all([
    prisma.user.findFirstOrThrow({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    }),
    prisma.envelope.findFirstOrThrow({
      where: {
        ...unsafeBuildEnvelopeIdQuery(
          {
            type: 'documentId',
            id: documentId,
          },
          EnvelopeType.DOCUMENT,
        ),
        status: DocumentStatus.PENDING,
      },
      include: {
        documentMeta: true,
        envelopeItems: {
          include: {
            documentData: {
              select: {
                type: true,
                id: true,
                data: true,
              },
            },
          },
        },
        recipients: true,
        user: {
          select: {
            disabled: true,
          },
        },
        team: {
          select: {
            teamEmail: true,
            name: true,
          },
        },
      },
    }),
    prisma.recipient.findFirstOrThrow({
      where: {
        id: recipientId,
      },
    }),
  ]);

  const { documentMeta, team } = envelope;

  // CC recipients are notified here too (Adobe parity): the engine sends them a
  // branded "you've been copied" email — same template as signers, but with no
  // signing link/button, no PDF attachment, and no reminder scheduling. Their
  // copy explains they'll receive the fully signed PDF on completion.
  const isCc = recipient.role === RecipientRole.CC;

  const isRecipientSigningRequestEmailEnabled = extractDerivedDocumentEmailSettings(
    envelope.documentMeta,
  ).recipientSigningRequest;

  if (!isRecipientSigningRequestEmailEnabled) {
    return;
  }

  const {
    branding,
    emailLanguage,
    settings,
    organisationType,
    senderEmail,
    replyToEmail,
    organisationId,
    claims,
    emailsDisabled,
    emailTransport,
  } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId: envelope.teamId,
    },
    meta: envelope.documentMeta,
  });

  // Don't send signing invitations if the organisation has email sending disabled or the owner is disabled (e.g. banned).
  if (envelope.user.disabled || emailsDisabled) {
    return;
  }

  const customEmail = envelope?.documentMeta;
  const isDirectTemplate = envelope.source === DocumentSource.TEMPLATE_DIRECT_LINK;

  // RECIPIENT_ROLE_TO_EMAIL_TYPE has no CC entry — writing `undefined` into the
  // EMAIL_SENT audit row breaks the audit-log Zod parse for the whole envelope.
  // The audit email-type enum has a dedicated 'CC' value; use it.
  const recipientEmailType =
    recipient.role === RecipientRole.CC ? ('CC' as const) : RECIPIENT_ROLE_TO_EMAIL_TYPE[recipient.role];

  const { email, name } = recipient;
  const selfSigner = email === user.email;

  const i18n = await getI18nInstance(emailLanguage);

  const recipientActionVerb = i18n._(RECIPIENT_ROLES_DESCRIPTION[recipient.role].actionVerb).toLowerCase();

  // An approver is asked to review/approve, not to sign — the request subject
  // must reflect that. Signer wording is unchanged.
  const requestSubject = getRecipientRequestSubject(i18n, recipient.role, envelope.title);

  // Adobe parity, recipient-facing: the signer sees "Signature requested on …".
  // ("<title> has been sent out for signature to <name>" is Adobe's SENDER-side
  // notification, not the signer's subject.)
  let emailMessage = customEmail?.message || '';
  let emailSubject = requestSubject;

  if (selfSigner) {
    emailMessage = i18n._(
      msg`You have initiated the document ${`"${envelope.title}"`} that requires you to ${recipientActionVerb} it.`,
    );
    emailSubject = i18n._(msg`Please ${recipientActionVerb} your document`);
  }

  if (isDirectTemplate) {
    emailMessage = i18n._(
      msg`A document was created by your direct template that requires you to ${recipientActionVerb} it.`,
    );
    emailSubject = i18n._(msg`Please ${recipientActionVerb} this document created by your direct template`);
  }

  if (organisationType === OrganisationType.ORGANISATION) {
    emailSubject = requestSubject;
    emailMessage = customEmail?.message ?? '';

    if (!emailMessage) {
      const inviterName = user.name || '';

      emailMessage = i18n._(
        settings.includeSenderDetails
          ? msg`${inviterName} on behalf of "${team.name}" has sent you "${envelope.title}" to ${recipientActionVerb}. The document is attached for your reference. When all parties have completed it, everyone will receive the final signed PDF.`
          : msg`${team.name} has sent you "${envelope.title}" to ${recipientActionVerb}. The document is attached for your reference. When all parties have completed it, everyone will receive the final signed PDF.`,
      );
    }
  }

  // CC copy takes precedence over every branch above: a CC has no action, so
  // the subject and body must not talk about signing.
  if (isCc) {
    emailSubject = i18n._(msg`You have been copied on "${envelope.title}"`);

    const inviterName = user.name || '';
    emailMessage = i18n._(
      settings.includeSenderDetails
        ? msg`${inviterName} on behalf of "${team.name}" has added you as a CC on "${envelope.title}". No action is required from you — once all parties have completed signing, you'll automatically receive a copy of the fully signed document.`
        : msg`${team.name} has added you as a CC on "${envelope.title}". No action is required from you — once all parties have completed signing, you'll automatically receive a copy of the fully signed document.`,
    );
  }

  const customEmailTemplate = {
    'signer.name': name,
    'signer.email': email,
    'document.name': envelope.title,
  };

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';
  const signDocumentLink = `${NEXT_PUBLIC_WEBAPP_URL()}/sign/${recipient.token}`;
  const reportUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/report/${recipient.token}`;

  const template = createElement(DocumentInviteEmailTemplate, {
    documentName: envelope.title,
    inviterName: user.name || undefined,
    inviterEmail:
      organisationType === OrganisationType.ORGANISATION ? team?.teamEmail?.email || user.email : user.email,
    assetBaseUrl,
    signDocumentLink,
    customBody: renderCustomEmailTemplate(emailMessage, customEmailTemplate),
    role: recipient.role,
    selfSigner,
    organisationType,
    teamName: team?.name,
    teamEmail: team?.teamEmail?.email,
    includeSenderDetails: settings.includeSenderDetails,
    reportUrl,
  });

  if (isRecipientEmailValidForSending(recipient)) {
    try {
      await assertOrganisationRatesAndLimits({
        organisationId,
        organisationClaim: claims,
        type: 'email',
        count: 1,
      });
    } catch (_err) {
      io.logger.warn({
        msg: 'Recipient signing email dropped: org rate limit exceeded',
        organisationId,
        recipientId: recipient.id,
        envelopeId: envelope.id,
      });

      // Job is consumed and NOT retried.
      return;
    }

    await io.runTask('send-signing-email', async () => {
      const [html, text] = await Promise.all([
        renderEmailWithI18N(template, { lang: emailLanguage, branding }),
        renderEmailWithI18N(template, {
          lang: emailLanguage,
          branding,
          plainText: true,
        }),
      ]);

      // Attach the (unsigned) document PDF to the notification, matching
      // Adobe's behaviour so the recipient sees the contract in their inbox.
      // Signers AND CCs both get it: CCs (e.g. Event Directors) copy the
      // itinerary out of the PDF into their calendar at send time — they can't
      // wait for the fully-signed copy on completion (#278). Same document
      // either way; only the subject/body differ by role.
      const attachments = await Promise.all(
        envelope.envelopeItems.map(async (envelopeItem) => {
          const file = await getFileServerSide(envelopeItem.documentData);
          const fileName = envelope.internalVersion === 1 ? envelope.title : envelopeItem.title;
          return {
            filename: `${stripPdfExtension(fileName)}.pdf`,
            content: Buffer.from(file),
            contentType: 'application/pdf',
          };
        }),
      );

      await emailTransport.sendMail({
        to: {
          name: recipient.name,
          address: recipient.email,
        },
        from: senderEmail,
        replyTo: replyToEmail,
        // A custom subject is signer-facing ("please sign …") — never apply it
        // to a CC, whose subject must stay "You have been copied on …".
        //
        // Every subject (default, custom, or CC) is stamped with the
        // envelope's [ref MMDD-HHMM] code: a cancel-and-resend creates a new
        // envelope with the same title, and without a distinguishing marker
        // Gmail collapses its request email into the cancelled contract's
        // thread (#376). Same envelope keeps the same code, so reminders and
        // redistributes still thread with their own contract.
        subject: appendEnvelopeSubjectReference(
          isCc ? emailSubject : renderCustomEmailTemplate(documentMeta?.subject || emailSubject, customEmailTemplate),
          envelope.createdAt,
        ),
        html,
        text,
        attachments,
        headers: buildEnvelopeEmailHeaders({
          userId,
          envelopeId: envelope.id,
          teamId: envelope.teamId,
        }),
      });
    });
  }

  const sentAt = new Date();

  await io.runTask('update-recipient', async () => {
    await prisma.recipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        sendStatus: SendStatus.SENT,
        sentAt,
      },
    });
  });

  // Compute the first reminder time based on the envelope's effective settings.
  // CCs have nothing to sign, so they must never be scheduled for reminders.
  if (!isCc) {
    await updateRecipientNextReminder({
      recipientId: recipient.id,
      envelopeId: envelope.id,
      sentAt,
      lastReminderSentAt: null,
    });
  }

  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
      envelopeId: envelope.id,
      user,
      requestMetadata,
      data: {
        emailType: recipientEmailType,
        recipientId: recipient.id,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        recipientRole: recipient.role,
        isResending: false,
      },
    }),
  });
};
