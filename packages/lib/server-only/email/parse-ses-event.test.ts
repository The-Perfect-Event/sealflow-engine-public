import { describe, expect, it } from 'vitest';

import { parseSesEvent } from './parse-ses-event';

/**
 * #390 — SES event parsing. Fixtures mirror the real SES event-publishing
 * JSON shape (delivered as the SNS Message string).
 */

const buildBounceEvent = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    eventType: 'Bounce',
    bounce: {
      bounceType: 'Permanent',
      bounceSubType: 'General',
      bouncedRecipients: [
        {
          emailAddress: 'kkg.riskprevention.calpoly@gmial.com',
          diagnosticCode: 'smtp; 550 5.1.1 user unknown',
        },
      ],
    },
    mail: {
      messageId: '0000014a-f4d4-4f89-b8b0-000000000000',
      destination: ['kkg.riskprevention.calpoly@gmial.com'],
      headers: [
        { name: 'X-Sealflow-Sender-User-Id', value: '3' },
        { name: 'X-Sealflow-Envelope-Id', value: 'envelope_afbnhevcvxwanyan' },
        { name: 'X-Sealflow-Team-Id', value: '1' },
      ],
    },
    ...overrides,
  });

describe('parseSesEvent', () => {
  it('parses a permanent bounce with the envelope header and diagnostic code', () => {
    const result = parseSesEvent(buildBounceEvent());

    expect(result).toEqual({
      kind: 'permanent-bounce',
      envelopeId: 'envelope_afbnhevcvxwanyan',
      recipients: [
        {
          email: 'kkg.riskprevention.calpoly@gmial.com',
          diagnosticCode: 'smtp; 550 5.1.1 user unknown',
        },
      ],
      bounceType: 'Permanent',
      bounceSubType: 'General',
    });
  });

  it('classifies a transient bounce separately (no document action)', () => {
    const raw = buildBounceEvent({
      bounce: {
        bounceType: 'Transient',
        bounceSubType: 'MailboxFull',
        bouncedRecipients: [{ emailAddress: 'full@example.com' }],
      },
    });

    const result = parseSesEvent(raw);

    expect(result.kind).toBe('transient-bounce');
  });

  it('matches the envelope header case-insensitively', () => {
    const raw = JSON.parse(buildBounceEvent());
    raw.mail.headers = [{ name: 'x-sealflow-envelope-id', value: 'envelope_abc' }];

    const result = parseSesEvent(JSON.stringify(raw));

    expect(result.kind).toBe('permanent-bounce');
    if (result.kind === 'permanent-bounce') {
      expect(result.envelopeId).toBe('envelope_abc');
    }
  });

  it('returns a null envelopeId when the header is absent (still parseable)', () => {
    const raw = JSON.parse(buildBounceEvent());
    raw.mail.headers = [];

    const result = parseSesEvent(JSON.stringify(raw));

    expect(result.kind).toBe('permanent-bounce');
    if (result.kind === 'permanent-bounce') {
      expect(result.envelopeId).toBeNull();
    }
  });

  it('falls back to mail.destination when bouncedRecipients is empty', () => {
    const raw = JSON.parse(buildBounceEvent());
    raw.bounce.bouncedRecipients = [];

    const result = parseSesEvent(JSON.stringify(raw));

    expect(result.kind).toBe('permanent-bounce');
    if (result.kind === 'permanent-bounce') {
      expect(result.recipients).toEqual([{ email: 'kkg.riskprevention.calpoly@gmial.com' }]);
    }
  });

  it('accepts the identity-notification shape (notificationType instead of eventType)', () => {
    const raw = JSON.parse(buildBounceEvent());
    delete raw.eventType;
    raw.notificationType = 'Bounce';

    expect(parseSesEvent(JSON.stringify(raw)).kind).toBe('permanent-bounce');
  });

  it('parses a complaint', () => {
    const raw = JSON.stringify({
      eventType: 'Complaint',
      complaint: {
        complaintFeedbackType: 'abuse',
        complainedRecipients: [{ emailAddress: 'someone@example.com' }],
      },
      mail: {
        destination: ['someone@example.com'],
        headers: [{ name: 'X-Sealflow-Envelope-Id', value: 'envelope_x' }],
      },
    });

    const result = parseSesEvent(raw);

    expect(result.kind).toBe('complaint');
    if (result.kind === 'complaint') {
      expect(result.recipients).toEqual([{ email: 'someone@example.com' }]);
      expect(result.envelopeId).toBe('envelope_x');
    }
  });

  it('ignores deliveries and other event types', () => {
    const raw = JSON.stringify({
      eventType: 'Delivery',
      mail: { destination: ['a@b.com'], headers: [] },
    });

    expect(parseSesEvent(raw).kind).toBe('ignored');
  });

  it('never throws on garbage input', () => {
    expect(parseSesEvent('not json').kind).toBe('ignored');
    expect(parseSesEvent('{}').kind).toBe('ignored');
    expect(parseSesEvent('null').kind).toBe('ignored');
  });
});
