import DocumentRejectedEmail from '@documenso/email/templates/document-rejected';
import DocumentRejectionConfirmedEmail from '@documenso/email/templates/document-rejection-confirmed';
import { isRecipientEmailValidForSending } from '@documenso/lib/utils/recipients';
import { prisma } from '@documenso/prisma';
import { msg } from '@lingui/core/macro';
import { EnvelopeType, SendStatus, SigningStatus } from '@prisma/client';
import { createElement } from 'react';

import { getI18nInstance } from '../../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../../constants/app';
import { buildEnvelopeEmailHeaders } from '../../../server-only/email/build-envelope-email-headers';
import { getEmailContext } from '../../../server-only/email/get-email-context';
import { extractDerivedDocumentEmailSettings } from '../../../types/document-email';
import { unsafeBuildEnvelopeIdQuery } from '../../../utils/envelope';
import { renderEmailWithI18N } from '../../../utils/render-email-with-i18n';
import { formatDocumentsPath } from '../../../utils/teams';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSendSigningRejectionEmailsJobDefinition } from './send-rejection-emails';

export const run = async ({ payload, io }: { payload: TSendSigningRejectionEmailsJobDefinition; io: JobRunIO }) => {
  const { documentId, recipientId } = payload;

  const [envelope, recipient] = await Promise.all([
    prisma.envelope.findFirstOrThrow({
      where: unsafeBuildEnvelopeIdQuery(
        {
          type: 'documentId',
          id: documentId,
        },
        EnvelopeType.DOCUMENT,
      ),
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        documentMeta: true,
        team: {
          select: {
            teamEmail: true,
            name: true,
            url: true,
          },
        },
      },
    }),
    prisma.recipient.findFirstOrThrow({
      where: {
        id: recipientId,
        signingStatus: SigningStatus.REJECTED,
      },
    }),
  ]);

  const { user: documentOwner } = envelope;

  const isEmailEnabled = extractDerivedDocumentEmailSettings(envelope.documentMeta).recipientSigningRequest;

  if (!isEmailEnabled) {
    return;
  }

  const { branding, emailLanguage, senderEmail, replyToEmail, emailsDisabled, emailTransport } = await getEmailContext({
    emailType: 'RECIPIENT',
    source: {
      type: 'team',
      teamId: envelope.teamId,
    },
    meta: envelope.documentMeta,
  });

  const i18n = await getI18nInstance(emailLanguage);

  // Send confirmation email to the recipient who rejected.
  // Skipped when the organisation has email sending disabled, since this is sent on its behalf.
  // The owner notification below still sends regardless — it is an internal
  // notification to the document owner, not outbound mail on the org's behalf.
  if (!emailsDisabled && isRecipientEmailValidForSending(recipient)) {
    await io.runTask('send-rejection-confirmation-email', async () => {
      const recipientTemplate = createElement(DocumentRejectionConfirmedEmail, {
        recipientName: recipient.name,
        documentName: envelope.title,
        documentOwnerName: envelope.user.name || envelope.user.email,
        reason: recipient.rejectionReason || '',
        assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
      });

      const [html, text] = await Promise.all([
        renderEmailWithI18N(recipientTemplate, { lang: emailLanguage, branding }),
        renderEmailWithI18N(recipientTemplate, {
          lang: emailLanguage,
          branding,
          plainText: true,
        }),
      ]);

      await emailTransport.sendMail({
        to: {
          name: recipient.name,
          address: recipient.email,
        },
        from: senderEmail,
        headers: buildEnvelopeEmailHeaders({
          userId: envelope.userId,
          envelopeId: envelope.id,
          teamId: envelope.teamId,
        }),
        replyTo: replyToEmail,
        subject: i18n._(msg`Document "${envelope.title}" - Rejection Confirmed`),
        html,
        text,
      });
    });
  }

  // Send notification email to document owner
  await io.runTask('send-owner-notification-email', async () => {
    const ownerTemplate = createElement(DocumentRejectedEmail, {
      recipientName: recipient.name,
      documentName: envelope.title,
      documentUrl: `${NEXT_PUBLIC_WEBAPP_URL()}${formatDocumentsPath(envelope.team?.url)}/${envelope.id}`,
      rejectionReason: recipient.rejectionReason || '',
      assetBaseUrl: NEXT_PUBLIC_WEBAPP_URL(),
    });

    const [html, text] = await Promise.all([
      renderEmailWithI18N(ownerTemplate, { lang: emailLanguage, branding }),
      renderEmailWithI18N(ownerTemplate, {
        lang: emailLanguage,
        branding,
        plainText: true,
      }),
    ]);

    // Upstream sent this from DOCUMENSO_INTERNAL_EMAIL via the global mailer
    // ("purposefully"), but on our fork that means an unbranded
    // noreply@documenso.com sender — which production SES would reject as an
    // unverified identity, silently dropping every owner rejection notice.
    // Use the same org transport + branded sender as every other email.
    await emailTransport.sendMail({
      to: {
        name: documentOwner.name || '',
        address: documentOwner.email,
      },
      from: senderEmail,
      headers: buildEnvelopeEmailHeaders({ userId: envelope.userId, envelopeId: envelope.id, teamId: envelope.teamId }),
      replyTo: replyToEmail,
      subject: i18n._(msg`Document "${envelope.title}" - Rejected by ${recipient.name}`),
      html,
      text,
    });
  });

  await io.runTask('update-recipient', async () => {
    await prisma.recipient.update({
      where: {
        id: recipient.id,
      },
      data: {
        sendStatus: SendStatus.SENT,
      },
    });
  });
};
