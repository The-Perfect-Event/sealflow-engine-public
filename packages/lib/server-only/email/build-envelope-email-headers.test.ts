import { describe, expect, it } from 'vitest';

import { buildEnvelopeEmailHeaders } from './build-envelope-email-headers';

/**
 * #376 — threading isolation. Every email about one envelope must reference
 * the same synthetic root message-id so Gmail (post-2019 "definite
 * relationship" model) threads them together, while a cancel-and-resend (a
 * new envelope, same title) gets a different root and can never collapse
 * into the cancelled contract's thread.
 */
describe('buildEnvelopeEmailHeaders', () => {
  const base = { userId: 7, teamId: 3 };

  it('emits a per-envelope References root and X-Entity-Ref-ID', () => {
    const headers = buildEnvelopeEmailHeaders({ ...base, envelopeId: 'envelope_abc123' });

    expect(headers.References).toMatch(/^<envelope_abc123@[^@\s]+>$/);
    expect(headers['X-Entity-Ref-ID']).toBe('envelope_abc123');
  });

  it('is stable for the same envelope and distinct across envelopes', () => {
    const a1 = buildEnvelopeEmailHeaders({ ...base, envelopeId: 'envelope_original' });
    const a2 = buildEnvelopeEmailHeaders({ ...base, envelopeId: 'envelope_original' });
    const b = buildEnvelopeEmailHeaders({ ...base, envelopeId: 'envelope_resend' });

    expect(a1.References).toBe(a2.References);
    expect(a1.References).not.toBe(b.References);
  });

  it('keeps the sender-attribution headers unchanged', () => {
    const headers = buildEnvelopeEmailHeaders({ userId: 42, teamId: 9, envelopeId: 'envelope_x' });

    expect(headers['X-Sealflow-Sender-User-Id']).toBe('42');
    expect(headers['X-Sealflow-Envelope-Id']).toBe('envelope_x');
    expect(headers['X-Sealflow-Team-Id']).toBe('9');
  });
});
