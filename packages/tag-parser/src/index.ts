import { decodeTag, TagDecodeError } from './decoder.js';
import { readTaggedPdf } from './reader.js';
import type { ParsedField, ParseResult, TagFailure } from './types.js';
import { type OverlayRect, overlayTagBoxes } from './writer.js';

export {
  DEFAULT_DIMENSIONS,
  KNOWN_SUBTYPES,
  mmToPt,
  PREFIX_MAP,
  PT_PER_MM,
} from './constants.js';
export { decodeTag, findTags, TagDecodeError } from './decoder.js';
export {
  buildFieldCreateData,
  buildPlaceholderRecipients,
  type DocumensoFieldCreate,
  type DocumensoFieldType,
  type DocumensoRecipientCreate,
  placeholderEmail,
  toDocumensoFieldCreate,
} from './documenso.js';
export { readTaggedPdf } from './reader.js';
export * from './types.js';
export { overlayTagBoxes } from './writer.js';

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
  // shows raw `{{...}}` text, regardless of decode success. Per-segment boxes
  // are used (not the union box) so a tag that wraps onto multiple lines never
  // whites out unrelated content sitting between/beside its segments.
  const rects: OverlayRect[] = occurrences.flatMap((o) =>
    (o.segmentBoxes.length > 0 ? o.segmentBoxes : [o.boundingBox]).map((boundingBox) => ({
      page: o.position.page,
      boundingBox,
    })),
  );
  const cleanPdfBytes = occurrences.length === 0 ? pdfBytes : await overlayTagBoxes(pdfBytes, rects);

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
