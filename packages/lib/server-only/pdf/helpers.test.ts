import { describe, expect, it } from 'vitest';

import { findRecipientByPlaceholder, getPlaceholderRecipientEmail, getPlaceholderRecipientName } from './helpers';

describe('placeholder recipient identity (create ↔ lookup invariant)', () => {
  // Regression for the v1.2.0 upload bug: the auto-create path wrote
  // `recipient.N@documenso.com` while the lookup searched for
  // `signerN@placeholder.local`, so tagged uploads without pre-specified
  // recipients threw "Could not find recipient ID for placeholder". Both sides
  // now derive the email from the same helper — this test locks that in.
  it('lookup finds a recipient auto-created with the shared placeholder email', () => {
    const autoCreated = [1, 2].map((i) => ({ id: `rec_${i}`, email: getPlaceholderRecipientEmail(i) }));

    // Mirrors the failing prod tag {{Ttl2_es_:signer2:title}} -> ref "r2".
    const found = findRecipientByPlaceholder('r2', '{{Ttl2_es_:signer2:title}}', undefined, autoCreated);

    expect(found.id).toBe('rec_2');
  });

  it('produces a non-routable, human-readable identity', () => {
    expect(getPlaceholderRecipientEmail(1)).toBe('signer1@placeholder.local');
    expect(getPlaceholderRecipientName(1)).toBe('Signer 1');
  });

  it('index-based matching (recipients provided) still resolves', () => {
    const recipients = [
      { id: 'a', email: 'real1@example.com' },
      { id: 'b', email: 'real2@example.com' },
    ];

    const found = findRecipientByPlaceholder('r2', '{{Sig2_es_:signer2}}', recipients, []);

    expect(found.id).toBe('b');
  });
});
