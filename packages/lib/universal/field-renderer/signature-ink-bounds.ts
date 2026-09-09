/**
 * Ink-bounds detection for signature images.
 *
 * Stored signature base64s are canvas snapshots, and the upload pad in
 * particular embeds the uploaded picture centered at 0.8x inside the full pad
 * canvas — so the stored PNG carries large transparent margins around the
 * actual ink. Fitting that padded canvas to a field fills the box with
 * transparency while the visible signature stays small (#302, Dan).
 *
 * `findInkBounds` locates the smallest rectangle containing every
 * non-transparent pixel so callers can crop the padding away — either before
 * storing (upload pad) or when rendering an already-stored signature
 * (signing preview + PDF export).
 */

export type InkBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Pixels with alpha at or below this are treated as background. A small
 * threshold ignores compression noise without eating anti-aliased edges.
 */
const INK_ALPHA_THRESHOLD = 8;

/**
 * Source pixels of padding kept around the detected ink so anti-aliased
 * edges aren't clipped by the crop.
 */
const INK_BOUNDS_MARGIN = 1;

type ImageDataLike = {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray | Uint8Array | number[];
};

/**
 * Find the bounding box of all non-transparent pixels in RGBA image data.
 *
 * Returns `null` when the image has no ink at all (fully transparent) or when
 * cropping would be pointless or unsafe: bounds that already cover the whole
 * image, or a degenerate sliver (under 2px in either dimension) that is more
 * likely noise than a signature. Images without an alpha channel (e.g. a JPEG
 * source drawn onto an opaque canvas) come back as full-coverage and therefore
 * `null` — trimming is only meaningful where transparency exists.
 */
export const findInkBounds = (imageData: ImageDataLike): InkBounds | null => {
  const { width, height, data } = imageData;

  if (width <= 0 || height <= 0 || data.length < width * height * 4) {
    return null;
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;

    for (let x = 0; x < width; x++) {
      const alpha = data[rowOffset + x * 4 + 3];

      if (alpha > INK_ALPHA_THRESHOLD) {
        if (x < minX) {
          minX = x;
        }
        if (x > maxX) {
          maxX = x;
        }
        if (y < minY) {
          minY = y;
        }
        if (y > maxY) {
          maxY = y;
        }
      }
    }
  }

  // Fully transparent — nothing to crop to.
  if (maxX < minX || maxY < minY) {
    return null;
  }

  // Degenerate sliver (measured before the margin is added) — treat as no
  // usable ink rather than blowing a few stray pixels up to fill the field.
  if (maxX - minX + 1 < 2 || maxY - minY + 1 < 2) {
    return null;
  }

  const x = Math.max(0, minX - INK_BOUNDS_MARGIN);
  const y = Math.max(0, minY - INK_BOUNDS_MARGIN);
  const boundsWidth = Math.min(width, maxX + 1 + INK_BOUNDS_MARGIN) - x;
  const boundsHeight = Math.min(height, maxY + 1 + INK_BOUNDS_MARGIN) - y;

  // Already covers the image — cropping is a no-op, signal it.
  if (x === 0 && y === 0 && boundsWidth === width && boundsHeight === height) {
    return null;
  }

  return { x, y, width: boundsWidth, height: boundsHeight };
};
