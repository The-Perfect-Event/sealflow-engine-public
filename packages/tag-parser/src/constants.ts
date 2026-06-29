import type { FieldType, FieldSubtype, FieldDimensions } from './types.js';

/**
 * Adobe prefix -> Documenso type + optional subtype hint.
 * The optional trailing digit (Int1, Int2, Ttl2) is stripped before lookup;
 * it disambiguates multiple fields of the same kind and never changes the type.
 *
 * Keys are matched case-sensitively first, then case-insensitively as a
 * fallback (see decoder.ts). `Mobile` is capitalised and `phone` is lower-case
 * in real production tags — both map to TEXT/phone.
 */
export const PREFIX_MAP: Record<string, { type: FieldType; subtype?: FieldSubtype }> = {
  Sig: { type: 'SIGNATURE' },
  Int: { type: 'INITIALS' },
  Em: { type: 'EMAIL' },
  N: { type: 'NAME' },
  Dte: { type: 'DATE' },
  Chk: { type: 'CHECKBOX' },
  Ttl: { type: 'TEXT', subtype: 'title' },
  Mobile: { type: 'TEXT', subtype: 'phone' },
  phone: { type: 'TEXT', subtype: 'phone' },
  Txt: { type: 'TEXT' },
  Cmp: { type: 'TEXT', subtype: 'company' },
  Adr: { type: 'TEXT', subtype: 'address' },
  Hyp: { type: 'TEXT', subtype: 'url' },
};

/** Recognised explicit `:SUBTYPE` tokens. */
export const KNOWN_SUBTYPES: ReadonlySet<FieldSubtype> = new Set<FieldSubtype>([
  'phone',
  'title',
  'company',
  'address',
  'url',
  'signature',
  'initials',
]);

/** Per-type default field-box dimensions (mm) used when `:dimension(...)` is absent. */
export const DEFAULT_DIMENSIONS: Record<FieldType, FieldDimensions> = {
  SIGNATURE: { widthMm: 60, heightMm: 8 },
  INITIALS: { widthMm: 60, heightMm: 10 },
  EMAIL: { widthMm: 80, heightMm: 6 },
  NAME: { widthMm: 80, heightMm: 6 },
  DATE: { widthMm: 40, heightMm: 6 },
  CHECKBOX: { widthMm: 6, heightMm: 6 },
  TEXT: { widthMm: 60, heightMm: 6 },
};

/** PDF points per millimetre (1 mm = 72/25.4 pt). */
export const PT_PER_MM = 72 / 25.4;

export function mmToPt(mm: number): number {
  return mm * PT_PER_MM;
}

/**
 * Global tag-detection regex. Intentionally permissive so that malformed-but-
 * tag-shaped strings are still *found* (counted in tagsFound) and then routed
 * to tagsFailed by the strict decoder, rather than silently ignored.
 *
 * Requires the `_es_` Adobe marker so ordinary `{{ ... }}` template braces are
 * not mistaken for tags. Tag bodies never contain `{` or `}`.
 */
export const TAG_DETECT_REGEX = /\{\{[^{}]*_es_[^{}]*\}\}/g;
