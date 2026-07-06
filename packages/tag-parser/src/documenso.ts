/**
 * Mapping from this library's {@link ParsedField} geometry to Documenso's v2
 * public API request shapes. Verified against Documenso v2.14.0 source:
 *   - POST /api/v2/envelope/field/create-many    (envelope-fields/create-envelope-fields.types.ts)
 *   - POST /api/v2/envelope/recipient/create-many (envelope-recipients/create-envelope-recipients.types.ts)
 *
 * Key facts baked in here:
 *   - Field coordinates are PERCENTAGES of the page (0–100), top-left origin —
 *     NOT points. We convert using each field's page size.
 *   - `fieldMeta.type` is the lower-case field kind; `required` lives in fieldMeta.
 *   - Documenso `FieldType` enum covers all of this library's types 1:1.
 */

import { PT_PER_MM } from './constants.js';
import type { FieldType, PageSize, ParsedField, ParseResult } from './types.js';

/** Documenso Prisma `FieldType` values (uppercase) — identical to ours. */
export type DocumensoFieldType = FieldType;

/** Lower-case `fieldMeta.type` discriminator expected by Documenso. */
const FIELD_META_TYPE: Record<FieldType, string> = {
  SIGNATURE: 'signature',
  INITIALS: 'initials',
  NAME: 'name',
  EMAIL: 'email',
  DATE: 'date',
  CHECKBOX: 'checkbox',
  TEXT: 'text',
};

/** One entry in the `data[]` array of POST /envelope/field/create-many. */
export interface DocumensoFieldCreate {
  type: DocumensoFieldType;
  recipientId: number;
  /** 1-indexed page. */
  page: number;
  /** Percentage-based, top-left origin (0–100). */
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  fieldMeta: { type: string; required?: boolean; label?: string };
}

/** One entry in the `data[]` array of POST /envelope/recipient/create-many. */
export interface DocumensoRecipientCreate {
  email: string;
  name: string;
  role: 'SIGNER';
  signingOrder?: number;
}

function clampPct(v: number): number {
  return Math.min(100, Math.max(0, v));
}

/** Build the non-routable placeholder email for a role (gotcha #6). */
export function placeholderEmail(role: string): string {
  // `.local` is non-routable, so an accidental Send before the user fills real
  // emails will bounce rather than deliver.
  return `${role}@placeholder.local`;
}

/**
 * Convert a single {@link ParsedField} to a Documenso field-create entry.
 * Requires the field's page size (for the point→percentage conversion) and the
 * resolved Documenso recipient id for the field's role.
 */
export function toDocumensoFieldCreate(
  field: ParsedField,
  pageSize: PageSize,
  recipientId: number,
): DocumensoFieldCreate {
  const widthPt = field.dimensions.widthMm * PT_PER_MM;
  const heightPt = field.dimensions.heightMm * PT_PER_MM;

  // `position.yPt` is the top of the tag glyph, and boxes grow downward by
  // their (per-type) height. Text-family fields are ~one line tall, so a
  // top-anchored box lands on the line. Signature/initial boxes are taller,
  // so top-anchoring drops the rendered mark well below the signing line.
  // Anchor those two by the tag BASELINE instead (box bottom on the line,
  // extending upward), so a signature/initial sits on its line like the text
  // fields do. Baseline = tag glyph top + glyph height (boundingBox.heightPt).
  const isBaselineAnchored = field.type === 'SIGNATURE' || field.type === 'INITIALS';
  const tagBaselineYpt = field.position.yPt + field.boundingBox.heightPt;
  const topYpt = isBaselineAnchored ? tagBaselineYpt - heightPt : field.position.yPt;

  return {
    type: field.type,
    recipientId,
    page: field.position.page,
    positionX: clampPct((field.position.xPt / pageSize.widthPt) * 100),
    positionY: clampPct((topYpt / pageSize.heightPt) * 100),
    width: clampPct((widthPt / pageSize.widthPt) * 100),
    height: clampPct((heightPt / pageSize.heightPt) * 100),
    fieldMeta: { type: FIELD_META_TYPE[field.type], required: field.required },
  };
}

/**
 * Build the placeholder recipient list (one per unique role, sorted) for the
 * POST /envelope/recipient/create-many call. `signingOrder` follows the sorted
 * role order so signer1 signs before signer2.
 */
export function buildPlaceholderRecipients(result: ParseResult): DocumensoRecipientCreate[] {
  return result.recipients.map((role, i) => ({
    email: placeholderEmail(role),
    name: role,
    role: 'SIGNER',
    signingOrder: i + 1,
  }));
}

/**
 * Build the full `data[]` for POST /envelope/field/create-many from a parse
 * result, given a map of role label → Documenso recipient id (obtained from the
 * recipient-create response). Fields whose role is missing from the map are
 * skipped and returned in `skipped` for the caller to log.
 */
export function buildFieldCreateData(
  result: ParseResult,
  roleToRecipientId: Map<string, number>,
): { data: DocumensoFieldCreate[]; skipped: ParsedField[] } {
  const pageById = new Map(result.pageSizes.map((p) => [p.page, p]));
  const data: DocumensoFieldCreate[] = [];
  const skipped: ParsedField[] = [];

  for (const field of result.fields) {
    const recipientId = roleToRecipientId.get(field.recipient);
    const pageSize = pageById.get(field.position.page);
    if (recipientId === undefined || pageSize === undefined) {
      skipped.push(field);
      continue;
    }
    data.push(toDocumensoFieldCreate(field, pageSize, recipientId));
  }
  return { data, skipped };
}
