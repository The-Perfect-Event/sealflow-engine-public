import { FieldType, RecipientRole, SigningStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import type { TRecipientLite } from '../types/recipient';
import { canRecipientBeModified } from './recipients';

/**
 * Only signature-type insertions (SIGNATURE / FREE_SIGNATURE / INITIALS) prove
 * the recipient interacted with the document. EMAIL and prefilled TEXT fields
 * are AUTO-inserted at send time for every recipient — including sequential
 * signers who have never been emailed (extractFieldAutoInsertValues in
 * send-document) — and must never make a recipient unmodifiable. Found live:
 * a later sequential signer with an auto-inserted EMAIL field could not be
 * replaced ("Cannot modify a recipient who has already interacted...").
 */
describe('canRecipientBeModified', () => {
  const recipient = (overrides: Partial<TRecipientLite> = {}): TRecipientLite =>
    ({
      id: 10,
      role: RecipientRole.SIGNER,
      signingStatus: SigningStatus.NOT_SIGNED,
      ...overrides,
    }) as TRecipientLite;

  const field = (type: FieldType, inserted: boolean, recipientId = 10) => ({
    recipientId,
    inserted,
    type,
  });

  it('allows a signer whose EMAIL field was auto-inserted at send time', () => {
    expect(canRecipientBeModified(recipient(), [field(FieldType.EMAIL, true)])).toBe(true);
  });

  it('allows a signer whose prefilled TEXT field was auto-inserted at send time', () => {
    expect(canRecipientBeModified(recipient(), [field(FieldType.TEXT, true)])).toBe(true);
  });

  it('denies a signer who inserted a SIGNATURE field', () => {
    expect(canRecipientBeModified(recipient(), [field(FieldType.SIGNATURE, true)])).toBe(false);
  });

  it('denies a signer who inserted a FREE_SIGNATURE field', () => {
    expect(canRecipientBeModified(recipient(), [field(FieldType.FREE_SIGNATURE, true)])).toBe(false);
  });

  it('denies a signer who inserted an INITIALS field', () => {
    expect(canRecipientBeModified(recipient(), [field(FieldType.INITIALS, true)])).toBe(false);
  });

  it('ignores uninserted signature fields', () => {
    expect(canRecipientBeModified(recipient(), [field(FieldType.SIGNATURE, false)])).toBe(true);
  });

  it('ignores inserted signature fields belonging to OTHER recipients', () => {
    expect(canRecipientBeModified(recipient(), [field(FieldType.SIGNATURE, true, 99)])).toBe(true);
  });

  it('denies a recipient who has already signed regardless of fields', () => {
    expect(canRecipientBeModified(recipient({ signingStatus: SigningStatus.SIGNED }), [])).toBe(false);
  });

  it('always allows CC recipients', () => {
    expect(canRecipientBeModified(recipient({ role: RecipientRole.CC, signingStatus: SigningStatus.SIGNED }), [])).toBe(
      true,
    );
  });
});
