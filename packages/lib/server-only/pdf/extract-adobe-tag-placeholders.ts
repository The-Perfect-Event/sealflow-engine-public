import type { ParsedField } from '@documenso/tag-parser';
import { PT_PER_MM, parseAdobeTaggedPdf } from '@documenso/tag-parser';
import { DEFAULT_SIGNATURE_TEXT_FONT_SIZE, DEFAULT_STANDARD_FONT_SIZE } from '../../constants/pdf';
import { type TFieldAndMeta, ZEnvelopeFieldAndMetaSchema } from '../../types/field-meta';
import type { PlaceholderInfo } from './auto-place-fields';

/**
 * Adobe Sign tag-style placeholder extraction.
 *
 * Counterpart to `extractPdfPlaceholders` (which handles the engine's native
 * `{{TYPE, r1, ...}}` syntax). Runs the Adobe-tagged PDF parser and adapts
 * its output to the engine's `PlaceholderInfo` shape so the downstream
 * envelope-create pipeline can auto-create placeholder recipients and place
 * fields exactly as it does for the native syntax.
 *
 * Returns the parse-cleaned PDF (tag text overlaid with white rectangles)
 * and the placeholders. If the input has no Adobe tags, returns the input
 * unchanged and an empty placeholder list.
 */
export const extractAdobeTagPlaceholders = async (
  pdf: Buffer,
): Promise<{ cleanedPdf: Buffer; placeholders: PlaceholderInfo[] }> => {
  const result = await parseAdobeTaggedPdf(new Uint8Array(pdf));

  if (result.fields.length === 0) {
    return { cleanedPdf: pdf, placeholders: [] };
  }

  // Map role label -> recipient index (1-based) so the engine's
  // `^r\d+$/i` pattern recognises them. Order follows result.recipients
  // (already deduped + sorted by the parser).
  const roleToIndex = new Map<string, number>();
  result.recipients.forEach((role, i) => {
    roleToIndex.set(role, i + 1);
  });

  const pageSizeByPage = new Map(result.pageSizes.map((p) => [p.page, p]));

  const placeholders: PlaceholderInfo[] = [];

  for (const field of result.fields) {
    const recipientIndex = roleToIndex.get(field.recipient);
    const pageSize = pageSizeByPage.get(field.position.page);

    if (recipientIndex === undefined || pageSize === undefined) {
      continue;
    }

    // Adobe text subtypes (phone/title/company/…) have no dedicated Documenso
    // field type, so they stay TEXT — but surface the intent as a label +
    // placeholder so signers see e.g. a "Phone" field, not a bare text box.
    const textSubtypeLabel = field.type === 'TEXT' && field.subtype ? TEXT_SUBTYPE_LABEL[field.subtype] : undefined;

    const fieldAndMeta: TFieldAndMeta = ZEnvelopeFieldAndMetaSchema.parse({
      type: field.type,
      fieldMeta: {
        type: fieldMetaTypeFor(field),
        required: field.required,
        ...(textSubtypeLabel ? { label: textSubtypeLabel, placeholder: textSubtypeLabel } : {}),
      },
    });

    const heightPt = field.dimensions.heightMm * PT_PER_MM;

    /*
      Vertical anchoring — align the RENDERED INK to the tag's first-line
      baseline, compensating for how each renderer positions content inside
      the field box:

      - The signature renderer vertically CENTERS its content (typed text or
        drawn image) in the field box. Konva centers each text line's em-box,
        which puts the text baseline ~0.3 × fontSize below the box centre. So
        place the box centre 0.3 × (signature font size) ABOVE the baseline,
        making the rendered signature sit ON the tag's line (drawn images
        straddle it naturally, like ink on a signing line).

      - Generic text fields (initials/name/email/date/text) render BOTTOM
        aligned: the text block's bottom sits at the field-box bottom and the
        baseline ~0.2 × fontSize above it. So place the box bottom
        0.2 × (standard font size) BELOW the baseline.

      `position.baselineYPt` is the baseline of the line where the tag BEGINS.
      Long tags (common with `:dimension(...)`) often wrap onto a second line;
      the previous math derived the baseline from the union bounding box,
      anchoring fields a full line below where the tag starts.

      Checkboxes keep the historical top anchor (box top at the tag glyph top).
    */
    const tagBaselineYpt = field.position.baselineYPt;

    let yPt: number;

    switch (field.type) {
      case 'SIGNATURE':
        yPt = tagBaselineYpt - 0.3 * DEFAULT_SIGNATURE_TEXT_FONT_SIZE - heightPt / 2;
        break;

      case 'CHECKBOX':
        yPt = field.position.yPt;
        break;

      default:
        yPt = tagBaselineYpt + 0.2 * DEFAULT_STANDARD_FONT_SIZE - heightPt;
        break;
    }

    placeholders.push({
      // Raw tag preserved for downstream logging / debugging.
      placeholder: field.raw,
      // 'signer1' -> 'r1' so the engine's recipient regex matches.
      recipient: `r${recipientIndex}`,
      fieldAndMeta,
      page: field.position.page,
      x: field.position.xPt,
      y: yPt,
      width: field.dimensions.widthMm * PT_PER_MM,
      height: heightPt,
      pageWidth: pageSize.widthPt,
      pageHeight: pageSize.heightPt,
    });
  }

  return {
    cleanedPdf: Buffer.from(result.cleanPdfBytes),
    placeholders,
  };
};

/**
 * Map the parser's `FieldType` (uppercase) to the engine's `fieldMeta.type`
 * discriminator (lowercase).
 */
/**
 * Human labels for Adobe text subtypes that Documenso has no dedicated field
 * type for. Applied as the TEXT field's label + placeholder.
 */
const TEXT_SUBTYPE_LABEL: Record<string, string> = {
  phone: 'Phone',
  title: 'Title',
  company: 'Company',
  address: 'Address',
  url: 'URL',
};

const fieldMetaTypeFor = (field: ParsedField): string => {
  switch (field.type) {
    case 'SIGNATURE':
      return 'signature';
    case 'INITIALS':
      return 'initials';
    case 'NAME':
      return 'name';
    case 'EMAIL':
      return 'email';
    case 'DATE':
      return 'date';
    case 'CHECKBOX':
      return 'checkbox';
    case 'TEXT':
      return 'text';
  }
};
