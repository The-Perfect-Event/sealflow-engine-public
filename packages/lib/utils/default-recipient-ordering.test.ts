import { describe, expect, it } from 'vitest';

import { computeDefaultRecipientOrdering } from './default-recipient-ordering';

type R = { email: string; signingOrder?: number };

describe('computeDefaultRecipientOrdering', () => {
  it('is a no-op when no default recipient specifies a signing order', () => {
    const senders = [{ email: 'a@x.com', signingOrder: 1 }];
    const defaults: R[] = [{ email: 'cc@x.com' }]; // e.g. a CC with no order

    const result = computeDefaultRecipientOrdering(senders, defaults);

    expect(result.forceSequential).toBe(false);
    expect(result.senderRecipients).toBe(senders); // untouched, same reference
    expect(result.defaultRecipients).toBe(defaults);
  });

  it('places an ordered approver ahead of the sender and forces sequential', () => {
    const senders = [{ email: 'dan@x.com', signingOrder: 1 }];
    const defaults = [{ email: 'tony@x.com', signingOrder: 1 }]; // approver first

    const result = computeDefaultRecipientOrdering(senders, defaults);

    expect(result.forceSequential).toBe(true);
    // approver keeps order 1; the signer is shifted to sit after it.
    expect(result.defaultRecipients[0].signingOrder).toBe(1);
    expect(result.senderRecipients[0].signingOrder).toBe(2);
  });

  it('preserves the relative order of multiple senders after the approver', () => {
    const senders = [
      { email: 'first@x.com', signingOrder: 1 },
      { email: 'second@x.com', signingOrder: 2 },
    ];
    const defaults = [{ email: 'tony@x.com', signingOrder: 1 }];

    const result = computeDefaultRecipientOrdering(senders, defaults);

    expect(result.senderRecipients.map((r) => r.signingOrder)).toEqual([2, 3]);
  });

  it('falls back to positional order for senders that omit signingOrder', () => {
    const senders: R[] = [{ email: 'a@x.com' }, { email: 'b@x.com' }];
    const defaults = [{ email: 'tony@x.com', signingOrder: 1 }];

    const result = computeDefaultRecipientOrdering(senders, defaults);

    // index+1 (1,2) shifted by maxDefaultOrder (1) → 2,3
    expect(result.senderRecipients.map((r) => r.signingOrder)).toEqual([2, 3]);
  });

  it('shifts senders past the highest default order when multiple approvers exist', () => {
    const senders = [{ email: 'dan@x.com', signingOrder: 1 }];
    const defaults = [
      { email: 'tony@x.com', signingOrder: 1 },
      { email: 'boss@x.com', signingOrder: 2 },
    ];

    const result = computeDefaultRecipientOrdering(senders, defaults);

    expect(result.forceSequential).toBe(true);
    expect(result.senderRecipients[0].signingOrder).toBe(3); // 1 + max(1,2)
  });

  it('does not mutate the input arrays or objects', () => {
    const senders = [{ email: 'dan@x.com', signingOrder: 1 }];
    const defaults = [{ email: 'tony@x.com', signingOrder: 1 }];

    computeDefaultRecipientOrdering(senders, defaults);

    expect(senders[0].signingOrder).toBe(1); // original untouched
  });
});
