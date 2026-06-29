import type { FieldPosition, BoundingBox } from './types.js';
import { findTags } from './decoder.js';

// pdfjs-dist legacy build runs on the main thread in Node (no worker/canvas
// needed for text extraction). Imported lazily so the pure decoder stays
// dependency-free for fast unit tests.
type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
let pdfjsPromise: Promise<PdfjsModule> | undefined;
function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsPromise;
}

/** A tag occurrence located in the PDF, with geometry but not yet decoded. */
export interface TagOccurrence {
  raw: string;
  position: FieldPosition; // top-left of the tag's first character
  boundingBox: BoundingBox; // visible-text box, for the overlay rectangle
}

export interface PageSize {
  widthPt: number;
  heightPt: number;
}

export interface ReadResult {
  occurrences: TagOccurrence[];
  pageSizes: PageSize[]; // index 0 = page 1
}

/**
 * Geometry of a single pdfjs text item, in PDF user space (origin bottom-left).
 * `charStart` is the item's offset within the page's concatenated text.
 */
interface ItemGeom {
  str: string;
  charStart: number;
  leftPt: number; // x of the item's left edge
  baselinePt: number; // y of the text baseline
  widthPt: number; // advance width of the run
  heightPt: number; // font height
}

/** Linear interpolation of an x position for a character offset inside an item. */
function xAtOffset(item: ItemGeom, offsetInItem: number): number {
  const len = item.str.length || 1;
  return item.leftPt + (offsetInItem / len) * item.widthPt;
}

/**
 * Extract every tag-shaped string from a PDF along with its on-page geometry.
 *
 * A tag may be split across several pdfjs text items, so per page we build the
 * concatenated text (tracking each item's char offset) and then map each
 * regex match back to the items it overlaps. The overlay box covers only the
 * tag portion of each item (not surrounding text that shares the item).
 */
export async function readTaggedPdf(pdfBytes: Uint8Array): Promise<ReadResult> {
  const pdfjs = await getPdfjs();
  // pdfjs may detach/transfer the buffer; hand it a private copy.
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const occurrences: TagOccurrence[] = [];
  const pageSizes: PageSize[] = [];

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const pageHeight = viewport.height;
      pageSizes.push({ widthPt: viewport.width, heightPt: pageHeight });

      const content = await page.getTextContent();
      const items: ItemGeom[] = [];
      let text = '';

      for (const raw of content.items) {
        // Skip non-text marked-content items.
        if (!('str' in raw)) continue;
        const item = raw as { str: string; width: number; height: number; transform: number[]; hasEOL?: boolean };
        const transform = item.transform;
        const geom: ItemGeom = {
          str: item.str,
          charStart: text.length,
          leftPt: transform[4]!,
          baselinePt: transform[5]!,
          widthPt: item.width,
          heightPt: item.height || Math.abs(transform[3]!),
        };
        items.push(geom);
        text += item.str;
        // Preserve line breaks so tags can't be stitched across lines.
        if (item.hasEOL) text += '\n';
      }

      for (const match of findTags(text)) {
        const startOffset = match.index;
        const endOffset = match.index + match.raw.length;
        const box = boundingBoxForRange(items, startOffset, endOffset, pageHeight);
        if (!box) continue; // geometry not recoverable; skip silently
        box.position.page = pageNum; // 1-indexed
        occurrences.push({ raw: match.raw, position: box.position, boundingBox: box.boundingBox });
      }

      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }

  return { occurrences, pageSizes };
}

/**
 * Compute the overlay bounding box (covering only the tag's characters) and the
 * field anchor (top-left of the first character) for a char range, by unioning
 * the sub-rectangles of each pdfjs item the range touches.
 */
function boundingBoxForRange(
  items: ItemGeom[],
  startOffset: number,
  endOffset: number,
  pageHeight: number,
): { position: FieldPosition; boundingBox: BoundingBox } | undefined {
  let minLeft = Infinity;
  let maxRight = -Infinity;
  let maxTopFromBottom = -Infinity; // top edge, measured from page bottom
  let minBottomFromBottom = Infinity;
  let firstLeft: number | undefined;
  let firstTopFromBottom: number | undefined;

  for (const item of items) {
    const itemStart = item.charStart;
    const itemEnd = item.charStart + item.str.length;
    if (itemEnd <= startOffset || itemStart >= endOffset) continue; // no overlap

    const covStart = Math.max(startOffset, itemStart) - itemStart;
    const covEnd = Math.min(endOffset, itemEnd) - itemStart;
    const subLeft = xAtOffset(item, covStart);
    const subRight = xAtOffset(item, covEnd);
    const topFromBottom = item.baselinePt + item.heightPt;
    const bottomFromBottom = item.baselinePt;

    minLeft = Math.min(minLeft, subLeft);
    maxRight = Math.max(maxRight, subRight);
    maxTopFromBottom = Math.max(maxTopFromBottom, topFromBottom);
    minBottomFromBottom = Math.min(minBottomFromBottom, bottomFromBottom);

    if (firstLeft === undefined || itemStart <= startOffset) {
      // The item that actually contains the tag's first character.
      if (itemStart <= startOffset && startOffset < itemEnd) {
        firstLeft = subLeft;
        firstTopFromBottom = topFromBottom;
      } else if (firstLeft === undefined) {
        firstLeft = subLeft;
        firstTopFromBottom = topFromBottom;
      }
    }
  }

  if (!Number.isFinite(minLeft) || firstLeft === undefined || firstTopFromBottom === undefined) {
    return undefined;
  }

  const boundingBox: BoundingBox = {
    xPt: minLeft,
    yPt: pageHeight - maxTopFromBottom,
    widthPt: maxRight - minLeft,
    heightPt: maxTopFromBottom - minBottomFromBottom,
  };
  const position: FieldPosition = {
    page: 0, // set by caller
    xPt: firstLeft,
    yPt: pageHeight - firstTopFromBottom,
  };
  return { position, boundingBox };
}
