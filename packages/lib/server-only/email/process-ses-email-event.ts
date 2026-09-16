import { jobs } from '@documenso/lib/jobs/client';
import { prisma } from '@documenso/prisma';

import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import { logger } from '../../utils/logger';
import type { ParsedSesEmailEvent } from './parse-ses-event';
import { parseSesEvent } from './parse-ses-event';

/**
 * Applies a verified SES email event to the documents it concerns (#390).
 *
 * Permanent bounce: mark each matching recipient (`bouncedAt`), write an
 * EMAIL_BOUNCED audit row, and notify the document owner so they can correct
 * the address and resend — instead of the document silently stalling on an
 * address that can never receive mail.
 *
 * Transient bounces and complaints are logged only: a transient failure may
 * still deliver on retry, and a complaint is a deliverability signal for the
 * operator, not a document-progress problem.
 */
export const processSesEmailEvent = async (rawMessage: string): Promise<ParsedSesEmailEvent> => {
  const event = parseSesEvent(rawMessage);

  const log = logger.child({ module: 'ses-email-event' });

  if (event.kind === 'ignored') {
    log.info({ reason: event.reason }, 'SES event ignored');

    return event;
  }

  if (event.kind === 'transient-bounce' || event.kind === 'complaint') {
    log.warn(
      {
        kind: event.kind,
        envelopeId: event.envelopeId,
        recipients: event.recipients.map((r) => r.email),
      },
      'SES delivery signal (no document action taken)',
    );

    return event;
  }

  // Permanent bounce.
  if (!event.envelopeId) {
    log.warn(
      { recipients: event.recipients.map((r) => r.email) },
      'Permanent bounce without an envelope header — cannot attribute to a document',
    );

    return event;
  }

  for (const bounced of event.recipients) {
    const recipient = await prisma.recipient.findFirst({
      where: {
        envelopeId: event.envelopeId,
        email: bounced.email,
      },
    });

    if (!recipient) {
      log.warn(
        { envelopeId: event.envelopeId, email: bounced.email },
        'Permanent bounce for an email with no matching recipient on the envelope',
      );

      continue;
    }

    // Already marked — a bounce can be reported more than once (e.g. a
    // reminder to the same dead address). Don't stack audit rows and owner
    // emails for the same standing failure.
    if (recipient.bouncedAt) {
      log.info(
        { envelopeId: event.envelopeId, recipientId: recipient.id },
        'Recipient already marked bounced; skipping duplicate report',
      );

      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.recipient.update({
        where: { id: recipient.id },
        data: { bouncedAt: new Date() },
      });

      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_BOUNCED,
          envelopeId: event.envelopeId as string,
          data: {
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            recipientId: recipient.id,
            recipientRole: recipient.role,
            bounceType: event.bounceType,
            bounceSubType: event.bounceSubType,
            diagnosticCode: bounced.diagnosticCode,
          },
        }),
      });
    });

    await jobs.triggerJob({
      name: 'send.owner.recipient.bounced.email',
      payload: {
        recipientId: recipient.id,
        envelopeId: event.envelopeId,
      },
    });

    log.info(
      { envelopeId: event.envelopeId, recipientId: recipient.id },
      'Recipient marked bounced; owner notification queued',
    );
  }

  return event;
};
