import { decodeTag } from '@documenso/tag-parser/src/decoder';
import { describe, expect, it } from 'vitest';

import { isTextFieldValueValid } from './validate-text-field-rule';

/**
 * project-management#267 — the payer ("financial contact") email box.
 *
 * The payer is usually NOT the signer (the Social Chair plans the event, the
 * Treasurer writes the checks), so the box has to be typeable. It previously
 * used the `Em` prefix, which is the EMAIL field type: the engine auto-fills
 * it with the signer's own address at send time and locks it, so every
 * contract recorded the signer as the payer.
 *
 * The replacement is `Txt…:email` — TEXT so it stays typeable, plus the
 * `email` subtype so the value is validated as an address rather than
 * accepting any string on a document we invoice from.
 */
describe('financial contact email tag', () => {
  const tag = (signer: number) => `{{*Txt${signer}_es_:signer${signer}:email}}`;

  it('is a typeable TEXT field, not the locked EMAIL type', () => {
    const field = decodeTag(tag(2));

    expect(field.type).toBe('TEXT');
    expect(field.type).not.toBe('EMAIL');
  });

  it('carries the email subtype so the adapter can attach the validation rule', () => {
    expect(decodeTag(tag(2)).subtype).toBe('email');
  });

  it('stays required via the leading star', () => {
    expect(decodeTag(tag(2)).required).toBe(true);
  });

  it('decodes for every client signer slot', () => {
    for (const signer of [2, 3, 4, 5]) {
      const field = decodeTag(tag(signer));

      expect(field.type).toBe('TEXT');
      expect(field.subtype).toBe('email');
      expect(field.recipient).toBe(`signer${signer}`);
    }
  });

  it('leaves the sibling name box as a plain TEXT field', () => {
    const field = decodeTag('{{*Txt2_es_:signer2}}');

    expect(field.type).toBe('TEXT');
    expect(field.subtype).toBeUndefined();
  });

  it('accepts an address other than the signer’s and rejects non-addresses', () => {
    // The whole point of the ticket: a different person can be the payer.
    expect(isTextFieldValueValid('treasurer@epsilontau.org', 'email')).toBe(true);
    expect(isTextFieldValueValid('not an email', 'email')).toBe(false);
    expect(isTextFieldValueValid('missing@domain', 'email')).toBe(false);
    expect(isTextFieldValueValid('', 'email')).toBe(false);
  });
});
