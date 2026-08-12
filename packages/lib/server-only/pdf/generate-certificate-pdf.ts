import { PDF } from '@libpdf/core';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { DocumentMeta, Envelope, Field, Recipient, Signature } from '@prisma/client';
import { FieldType, RecipientRole } from '@prisma/client';
import { colord } from 'colord';
import { prop, sortBy } from 'remeda';
import { match } from 'ts-pattern';
import { ZSupportedLanguageCodeSchema } from '../../constants/i18n';
import type { TDocumentAuditLogBaseSchema } from '../../types/document-audit-logs';
import { extractDocumentAuthMethods } from '../../utils/document-auth';
import { getTranslations } from '../../utils/i18n';

import { loadRecipientBrandingByTeamId } from '../branding/load-recipient-branding';
import { getDocumentCertificateAuditLogs } from '../document/get-document-certificate-audit-logs';
import { getOrganisationClaimByTeamId } from '../organisation/get-organisation-claims';
import { renderCertificate } from './render-certificate';

export type GenerateCertificatePdfOptions = {
  /**
   * Note: completedAt is not included since it's not real at this point in time.
   *
   * If we actually need it here in the future, we will need to preserve the
   * completedAt value and pass it to the final `envelope.update` function when
   * the document is initially sealed.
   */
  envelope: Omit<Envelope, 'completedAt'> & {
    documentMeta: DocumentMeta;
  };
  envelopeOwner: {
    name: string;
    email: string;
  };
  recipients: Recipient[];
  fields: (Pick<Field, 'id' | 'type' | 'secondaryId' | 'recipientId'> & {
    signature?: Pick<Signature, 'signatureImageAsBase64' | 'typedSignature'> | null;
  })[];
  language?: string;
  pageWidth: number;
  pageHeight: number;
};

/**
 * Roles that never sign and therefore must not appear in the certificate's
 * signer blocks. CC recipients are auto-marked `signingStatus: SIGNED`
 * internally (they never actually sign), so listing them on the certificate
 * would misleadingly imply they signed. Industry convention (Adobe Sign,
 * DocuSign) lists signing participants only — CC delivery is still recorded
 * in the audit trail.
 */
const NON_SIGNING_CERTIFICATE_ROLES: RecipientRole[] = [RecipientRole.CC, RecipientRole.VIEWER];

export const generateCertificatePdf = async (options: GenerateCertificatePdfOptions) => {
  const { envelope, envelopeOwner, fields, language, pageWidth, pageHeight } = options;

  const recipients = options.recipients.filter((recipient) => !NON_SIGNING_CERTIFICATE_ROLES.includes(recipient.role));

  const documentLanguage = ZSupportedLanguageCodeSchema.parse(language);

  const [organisationClaim, branding, auditLogs, messages] = await Promise.all([
    getOrganisationClaimByTeamId({ teamId: envelope.teamId }),
    loadRecipientBrandingByTeamId({ teamId: envelope.teamId }),
    getDocumentCertificateAuditLogs({
      envelopeId: envelope.id,
    }),
    getTranslations(documentLanguage),
  ]);

  // Derive the certificate's signature-thumbnail accent from the org brand
  // colour when custom branding is enabled; otherwise leave undefined so the
  // renderer keeps its default green.
  const brandPrimary = branding.colors?.primary;
  const brandAccent = brandPrimary && colord(brandPrimary).isValid() ? colord(brandPrimary) : null;
  const signatureBorderColor = brandAccent?.alpha(0.6).toRgbString();
  const signatureShadowColor = brandAccent?.alpha(0.1).toRgbString();

  i18n.loadAndActivate({
    locale: documentLanguage,
    messages,
  });

  const payload = {
    recipients: recipients.map((recipient) => {
      const recipientId = recipient.id;

      const signatureField = fields.find(
        (field) => field.recipientId === recipient.id && field.type === FieldType.SIGNATURE,
      );

      const emailSent: TDocumentAuditLogBaseSchema | undefined = auditLogs['EMAIL_SENT'].find(
        (log) => log.type === 'EMAIL_SENT' && log.data.recipientId === recipientId,
      );

      const documentSent: TDocumentAuditLogBaseSchema | undefined = auditLogs['DOCUMENT_SENT'].find(
        (log) => log.type === 'DOCUMENT_SENT',
      );

      const documentOpened: TDocumentAuditLogBaseSchema | undefined = auditLogs['DOCUMENT_OPENED'].find(
        (log) => log.type === 'DOCUMENT_OPENED' && log.data.recipientId === recipientId,
      );

      const documentRecipientCompleted: TDocumentAuditLogBaseSchema | undefined = auditLogs[
        'DOCUMENT_RECIPIENT_COMPLETED'
      ].find((log) => log.type === 'DOCUMENT_RECIPIENT_COMPLETED' && log.data.recipientId === recipientId);

      const documentRecipientRejected: TDocumentAuditLogBaseSchema | undefined = auditLogs[
        'DOCUMENT_RECIPIENT_REJECTED'
      ].find((log) => log.type === 'DOCUMENT_RECIPIENT_REJECTED' && log.data.recipientId === recipientId);

      const extractedAuthMethods = extractDocumentAuthMethods({
        documentAuth: envelope.authOptions,
        recipientAuth: recipient.authOptions,
      });

      const insertedAuditLogsWithFieldAuth = sortBy(
        auditLogs.DOCUMENT_FIELD_INSERTED.filter(
          (log) => log.data.recipientId === recipient.id && log.data.fieldSecurity,
        ),
        [prop('createdAt'), 'desc'],
      );

      const actionAuthMethod = insertedAuditLogsWithFieldAuth.at(0)?.data?.fieldSecurity?.type;

      let authLevel = match(actionAuthMethod)
        .with('ACCOUNT', () => i18n._(msg`Account Re-Authentication`))
        .with('TWO_FACTOR_AUTH', () => i18n._(msg`Two-Factor Re-Authentication`))
        .with('PASSWORD', () => i18n._(msg`Password Re-Authentication`))
        .with('PASSKEY', () => i18n._(msg`Passkey Re-Authentication`))
        .with('EXPLICIT_NONE', () => i18n._(msg`Email`))
        .with(undefined, () => null)
        .exhaustive();

      if (!authLevel) {
        const accessAuthMethod = extractedAuthMethods.derivedRecipientAccessAuth.at(0);

        authLevel = match(accessAuthMethod)
          .with('ACCOUNT', () => i18n._(msg`Account Authentication`))
          .with('TWO_FACTOR_AUTH', () => i18n._(msg`Two-Factor Authentication`))
          .with(undefined, () => i18n._(msg`Email`))
          .exhaustive();
      }

      return {
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        role: recipient.role,
        signingStatus: recipient.signingStatus,
        signatureField,
        rejectionReason: recipient.rejectionReason,
        authLevel,
        logs: {
          emailed: emailSent ?? null,
          sent: documentSent ?? null,
          opened: documentOpened ?? null,
          completed: documentRecipientCompleted ?? null,
          rejected: documentRecipientRejected ?? null,
        },
      };
    }),
    envelopeOwner,
    envelopeId: envelope.id,
    qrToken: envelope.qrToken,
    hidePoweredBy: organisationClaim.flags.hidePoweredBy ?? false,
    signatureBorderColor,
    signatureShadowColor,
    pageWidth,
    pageHeight,
    i18n,
  };

  const certificatePages = await renderCertificate(payload);

  return await PDF.merge(certificatePages);
};
