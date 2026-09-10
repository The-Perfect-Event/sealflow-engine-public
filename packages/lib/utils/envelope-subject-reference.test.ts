import { describe, expect, it } from 'vitest';

import { appendEnvelopeSubjectReference, getEnvelopeSubjectReference } from './envelope-subject-reference';

/**
 * #376 — cancel-and-resend creates a new envelope with the same title, and
 * identical subjects made Gmail collapse the new approval request into the
 * cancelled contract's thread. The [MMDD-HHMM] stamp (Pacific time, from
 * the envelope's creation moment) makes every envelope's subject unique while
 * keeping reminders of the same envelope in their own thread.
 */

describe('getEnvelopeSubjectReference', () => {
  it('formats the creation moment as [MMDD-HHMM] in Pacific time', () => {
    // 2026-09-11 04:41 UTC == 2026-09-10 21:41 PDT
    expect(getEnvelopeSubjectReference(new Date('2026-09-11T04:41:00Z'))).toBe('[0910-2141]');
  });

  it('is stable for the same envelope and distinct across envelopes', () => {
    const a = new Date('2026-09-09T18:00:00Z');
    const b = new Date('2026-09-11T04:41:00Z');

    expect(getEnvelopeSubjectReference(a)).toBe(getEnvelopeSubjectReference(a));
    expect(getEnvelopeSubjectReference(a)).not.toBe(getEnvelopeSubjectReference(b));
  });

  it('handles midnight without a "24" hour', () => {
    // 07:05 UTC == 00:05 PDT
    expect(getEnvelopeSubjectReference(new Date('2026-09-10T07:05:00Z'))).toBe('[0910-0005]');
  });
});

describe('appendEnvelopeSubjectReference', () => {
  const createdAt = new Date('2026-09-11T04:41:00Z');

  it('appends to a default subject', () => {
    expect(appendEnvelopeSubjectReference('Approval requested on "RHO KKG SLO 09.17.2026"', createdAt)).toBe(
      'Approval requested on "RHO KKG SLO 09.17.2026" [0910-2141]',
    );
  });

  it('gives two same-titled envelopes different subjects (the Tony scenario)', () => {
    const original = appendEnvelopeSubjectReference(
      'Approval requested on "RHO KKG SLO"',
      new Date('2026-09-09T18:00:00Z'),
    );
    const resend = appendEnvelopeSubjectReference('Approval requested on "RHO KKG SLO"', createdAt);

    expect(original).not.toBe(resend);
  });

  it('does not double-append', () => {
    const once = appendEnvelopeSubjectReference('Custom subject', createdAt);

    expect(appendEnvelopeSubjectReference(once, createdAt)).toBe(once);
  });
});
