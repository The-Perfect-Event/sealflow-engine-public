import type { ParseResult, ParsedField, TagFailure } from './types.js';
import { decodeTag, TagDecodeError } from './decoder.js';
import { readTaggedPdf } from './reader.js';
import { overlayTagBoxes, type OverlayRect } from './writer.js';

export * from './types.js';
export { decodeTag, findTags, TagDecodeError } from './decoder.js';
export { readTaggedPdf } from './reader.js';
export { overlayTagBoxes } from './writer.js';
export {
  toDocumensoFieldCreate,
  buildFieldCreateData,
  buildPlaceholderRecipients,
  placeholderEmail,
  type DocumensoFieldCreate,
  type DocumensoRecipientCreate,
  type DocumensoFieldType,
} from './documenso.js';
export {
  PREFIX_MAP,
  KNOWN_SUBTYPES,
  DEFAULT_DIMENSIONS,
  PT_PER_MM,
  mmToPt,
} from './constants.js';

/**
 * Parse an Adobe-tagged PDF into a cleaned PDF + Documenso field list.
 *
 * Best-effort: a single malformed tag is recorded in `diagnostics.tagsFailed`
 * and never aborts the document. Every detected tag-shaped string is overlaid
 * (so no `{{` remains visible) even when it fails to decode into a field.
 * A PDF with zero tags is returned unchanged.
 */
export async function parseAdobeTaggedPdf(pdfBytes: Uint8Array): Promise<ParseResult> {
  const { occurrences, pageSizes: rawPageSizes } = await readTaggedPdf(pdfBytes);
  const pageSizes = rawPageSizes.map((ps, i) => ({ page: i + 1, widthPt: ps.widthPt, heightPt: ps.heightPt }));

  const fields: ParsedField[] = [];
  const tagsFailed: TagFailure[] = [];
  const recipientSet = new Set<string>();

  for (const occ of occurrences) {
    try {
      const decoded = decodeTag(occ.raw);
      fields.push({ ...decoded, position: occ.position, boundingBox: occ.boundingBox });
      recipientSet.add(decoded.recipient);
    } catch (err) {
      const reason = err instanceof TagDecodeError ? err.message : String(err);
      tagsFailed.push({ raw: occ.raw, reason });
    }
  }

  // Overlay ALL detected occurrences (parsed + failed) so the cleaned PDF never
  // shows raw `{{...}}` text, regardless of decode success.
  const rects: OverlayRect[] = occurrences.map((o) => ({
    page: o.position.page,
    boundingBox: o.boundingBox,
  }));
  const cleanPdfBytes =
    occurrences.length === 0 ? pdfBytes : await overlayTagBoxes(pdfBytes, rects);

  return {
    cleanPdfBytes,
    fields,
    recipients: [...recipientSet].sort(),
    pageSizes,
    diagnostics: {
      tagsFound: occurrences.length,
      tagsParsed: fields.length,
      tagsFailed,
    },
  };
}
