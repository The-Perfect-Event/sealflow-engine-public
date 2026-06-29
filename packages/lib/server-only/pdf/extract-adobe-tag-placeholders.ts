import type { ParsedField } from '@documenso/tag-parser';
import { PT_PER_MM, parseAdobeTaggedPdf } from '@documenso/tag-parser';
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
  result.recipients.forEach((role, i) => roleToIndex.set(role, i + 1));

  const pageSizeByPage = new Map(result.pageSizes.map((p) => [p.page, p]));

  const placeholders: PlaceholderInfo[] = [];

  for (const field of result.fields) {
    const recipientIndex = roleToIndex.get(field.recipient);
    const pageSize = pageSizeByPage.get(field.position.page);

    if (recipientIndex === undefined || pageSize === undefined) {
      continue;
    }

    const fieldAndMeta: TFieldAndMeta = ZEnvelopeFieldAndMetaSchema.parse({
      type: field.type,
      fieldMeta: {
        type: fieldMetaTypeFor(field),
        required: field.required,
      },
    });

    placeholders.push({
      // Raw tag preserved for downstream logging / debugging.
      placeholder: field.raw,
      // 'signer1' -> 'r1' so the engine's recipient regex matches.
      recipient: `r${recipientIndex}`,
      fieldAndMeta,
      page: field.position.page,
      x: field.position.xPt,
      y: field.position.yPt,
      width: field.dimensions.widthMm * PT_PER_MM,
      height: field.dimensions.heightMm * PT_PER_MM,
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
