import { PDFDocument, rgb } from 'pdf-lib';
import type { BoundingBox } from './types.js';

export interface OverlayRect {
  /** 1-indexed page number. */
  page: number;
  boundingBox: BoundingBox; // top-left origin, points
}

/**
 * Slight padding (pt) added around each overlay rectangle so anti-aliased glyph
 * edges of the visible tag text are fully covered.
 */
const OVERLAY_PADDING_PT = 2.5;

/**
 * Draw an opaque white rectangle over each tag's visible-text bounding box and
 * return the new PDF bytes. We overlay rather than edit the text layer because
 * PDF content streams overlap and out-of-order edits mangle unrelated text
 * (sealflow#11 gotcha #1).
 */
export async function overlayTagBoxes(
  pdfBytes: Uint8Array,
  rects: OverlayRect[],
): Promise<Uint8Array> {
  if (rects.length === 0) return pdfBytes;

  const pdf = await PDFDocument.load(pdfBytes);
  const pages = pdf.getPages();

  for (const rect of rects) {
    const page = pages[rect.page - 1];
    if (!page) continue; // page out of range; skip defensively
    const { height: pageHeight } = page.getSize();
    const bb = rect.boundingBox;

    // Convert top-left-origin box back to pdf-lib's bottom-left origin.
    const x = bb.xPt - OVERLAY_PADDING_PT;
    const y = pageHeight - (bb.yPt + bb.heightPt) - OVERLAY_PADDING_PT;
    const width = bb.widthPt + OVERLAY_PADDING_PT * 2;
    const height = bb.heightPt + OVERLAY_PADDING_PT * 2;

    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: rgb(1, 1, 1),
      borderColor: rgb(1, 1, 1),
      borderWidth: 0,
      opacity: 1,
    });
  }

  return pdf.save();
}
