import { type Field, FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { isRequiredField } from './advanced-fields-helpers';

const field = (type: FieldType, fieldMeta: unknown): Field => ({ type, fieldMeta }) as unknown as Field;

describe('isRequiredField', () => {
  describe('signature-type fields are unconditionally required', () => {
    it('ignores an explicit optional toggle on a signature (documents must never complete unsigned)', () => {
      expect(isRequiredField(field(FieldType.SIGNATURE, { type: 'signature', required: false }))).toBe(true);
    });

    it('ignores an explicit optional toggle on a free signature', () => {
      expect(isRequiredField(field(FieldType.FREE_SIGNATURE, { type: 'signature', required: false }))).toBe(true);
    });
  });

  describe('honors an explicit required toggle for non-signature field types', () => {
    it('treats a signature toggled required as required', () => {
      expect(isRequiredField(field(FieldType.SIGNATURE, { type: 'signature', required: true }))).toBe(true);
    });

    it('treats a date toggled optional as optional (previously always required)', () => {
      expect(isRequiredField(field(FieldType.DATE, { type: 'date', required: false }))).toBe(false);
    });

    it('treats a text field toggled required as required', () => {
      expect(isRequiredField(field(FieldType.TEXT, { type: 'text', required: true }))).toBe(true);
    });
  });

  describe('falls back to the historical default when required is unset (backward compatible)', () => {
    it('defaults a signature with no fieldMeta to required', () => {
      expect(isRequiredField(field(FieldType.SIGNATURE, null))).toBe(true);
    });

    it('defaults a signature whose fieldMeta omits required to required', () => {
      expect(isRequiredField(field(FieldType.SIGNATURE, { type: 'signature' }))).toBe(true);
    });

    it('defaults a date with no fieldMeta to required', () => {
      expect(isRequiredField(field(FieldType.DATE, null))).toBe(true);
    });

    it('defaults a text field with no fieldMeta to optional', () => {
      expect(isRequiredField(field(FieldType.TEXT, null))).toBe(false);
    });

    it('defaults a text field whose fieldMeta omits required to optional', () => {
      expect(isRequiredField(field(FieldType.TEXT, { type: 'text' }))).toBe(false);
    });
  });
});
