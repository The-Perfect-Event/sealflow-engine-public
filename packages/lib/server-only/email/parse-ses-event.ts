import { z } from 'zod';

/**
 * Parsing for AWS SES event-publishing notifications (delivered via SNS).
 *
 * Pure module (no I/O, no Prisma) so the mapping from a raw SES event to the
 * envelope/recipients it concerns is fully unit-testable (#390).
 *
 * The envelope linkage comes from the `X-Sealflow-Envelope-Id` header that
 * `buildEnvelopeEmailHeaders` stamps onto every outgoing envelope email; the
 * affected addresses come from the event's bounced/complained recipient
 * lists (falling back to the mail destination).
 */

const ZSesHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
});

const ZSesMailSchema = z.object({
  messageId: z.string().optional(),
  destination: z.array(z.string()).default([]),
  headers: z.array(ZSesHeaderSchema).default([]),
});

const ZSesBounceSchema = z.object({
  bounceType: z.string(),
  bounceSubType: z.string().optional(),
  bouncedRecipients: z
    .array(
      z.object({
        emailAddress: z.string(),
        diagnosticCode: z.string().optional(),
      }),
    )
    .default([]),
});

const ZSesComplaintSchema = z.object({
  complaintFeedbackType: z.string().optional(),
  complainedRecipients: z
    .array(
      z.object({
        emailAddress: z.string(),
      }),
    )
    .default([]),
});

const ZSesEventSchema = z.object({
  // SES event publishing uses `eventType`; identity notifications use
  // `notificationType`. Accept either so both wirings work.
  eventType: z.string().optional(),
  notificationType: z.string().optional(),
  mail: ZSesMailSchema,
  bounce: ZSesBounceSchema.optional(),
  complaint: ZSesComplaintSchema.optional(),
});

export const SEALFLOW_ENVELOPE_ID_HEADER = 'X-Sealflow-Envelope-Id';

export type ParsedSesEmailEvent =
  | {
      kind: 'permanent-bounce' | 'transient-bounce';
      envelopeId: string | null;
      recipients: Array<{ email: string; diagnosticCode?: string }>;
      bounceType: string;
      bounceSubType?: string;
    }
  | {
      kind: 'complaint';
      envelopeId: string | null;
      recipients: Array<{ email: string }>;
      complaintFeedbackType?: string;
    }
  | {
      kind: 'ignored';
      reason: string;
    };

const findEnvelopeIdHeader = (headers: Array<{ name: string; value: string }>): string | null => {
  const header = headers.find((h) => h.name.toLowerCase() === SEALFLOW_ENVELOPE_ID_HEADER.toLowerCase());

  return header?.value || null;
};

/**
 * Parse a raw SES event JSON string (the SNS `Message` field) into a typed
 * result. Never throws on malformed input — unparseable or irrelevant events
 * come back as `{ kind: 'ignored' }` so the webhook can log and drop them
 * without erroring (a webhook that 500s on odd input gets retried forever).
 */
export const parseSesEvent = (rawMessage: string): ParsedSesEmailEvent => {
  let json: unknown;

  try {
    json = JSON.parse(rawMessage);
  } catch {
    return { kind: 'ignored', reason: 'not valid JSON' };
  }

  const result = ZSesEventSchema.safeParse(json);

  if (!result.success) {
    return { kind: 'ignored', reason: 'not an SES event shape' };
  }

  const event = result.data;
  const eventType = (event.eventType || event.notificationType || '').toLowerCase();
  const envelopeId = findEnvelopeIdHeader(event.mail.headers);

  if (eventType === 'bounce' && event.bounce) {
    const recipients =
      event.bounce.bouncedRecipients.length > 0
        ? event.bounce.bouncedRecipients.map((r) => ({
            email: r.emailAddress,
            diagnosticCode: r.diagnosticCode,
          }))
        : event.mail.destination.map((email) => ({ email }));

    return {
      kind: event.bounce.bounceType === 'Permanent' ? 'permanent-bounce' : 'transient-bounce',
      envelopeId,
      recipients,
      bounceType: event.bounce.bounceType,
      bounceSubType: event.bounce.bounceSubType,
    };
  }

  if (eventType === 'complaint' && event.complaint) {
    const recipients =
      event.complaint.complainedRecipients.length > 0
        ? event.complaint.complainedRecipients.map((r) => ({ email: r.emailAddress }))
        : event.mail.destination.map((email) => ({ email }));

    return {
      kind: 'complaint',
      envelopeId,
      recipients,
      complaintFeedbackType: event.complaint.complaintFeedbackType,
    };
  }

  return { kind: 'ignored', reason: `unhandled event type "${eventType || 'unknown'}"` };
};
