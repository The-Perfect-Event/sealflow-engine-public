import { describe, expect, it } from 'vitest';

import { getImageDimensions } from './render-signature-field';
import { findInkBounds } from './signature-ink-bounds';

/**
 * Regression for #302 round two. The v1.3.9 fix scaled the STORED image to
 * the field, but the upload pad stores the full pad canvas with the uploaded
 * picture centered at 0.8x — mostly transparent padding. Fitting that padded
 * canvas still rendered the ink tiny. These tests exercise the pipeline the
 * way the upload pad actually produces images, not with pre-cropped inputs.
 */

const makeImageData = (width: number, height: number) => ({
  width,
  height,
  data: new Uint8ClampedArray(width * height * 4),
});

const paintInk = (imageData: ReturnType<typeof makeImageData>, x: number, y: number, w: number, h: number) => {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      const i = (row * imageData.width + col) * 4;
      imageData.data[i] = 0;
      imageData.data[i + 1] = 0;
      imageData.data[i + 2] = 0;
      imageData.data[i + 3] = 255;
    }
  }
};

describe('findInkBounds', () => {
  it('finds the ink rectangle inside transparent padding (with 1px anti-alias margin)', () => {
    const img = makeImageData(200, 100);
    paintInk(img, 50, 30, 80, 20);

    const bounds = findInkBounds(img);

    expect(bounds).toEqual({ x: 49, y: 29, width: 82, height: 22 });
  });

  it('returns null for a fully transparent image', () => {
    expect(findInkBounds(makeImageData(100, 50))).toBeNull();
  });

  it('returns null when ink already covers the whole image (nothing to trim)', () => {
    const img = makeImageData(40, 20);
    paintInk(img, 0, 0, 40, 20);

    expect(findInkBounds(img)).toBeNull();
  });

  it('returns null for an opaque (no-alpha-channel style) image such as a JPEG source', () => {
    const img = makeImageData(60, 30);
    // JPEG decoded to RGBA has alpha 255 everywhere.
    for (let i = 3; i < img.data.length; i += 4) {
      img.data[i] = 255;
    }

    expect(findInkBounds(img)).toBeNull();
  });

  it('returns null for a degenerate sliver of stray pixels', () => {
    const img = makeImageData(100, 100);
    paintInk(img, 10, 10, 1, 1);

    expect(findInkBounds(img)).toBeNull();
  });

  it('ignores near-transparent compression noise', () => {
    const img = makeImageData(100, 100);
    paintInk(img, 40, 40, 10, 10);
    // Noise at the corner below the alpha threshold must not stretch the bounds.
    img.data[3] = 5;

    const bounds = findInkBounds(img);

    expect(bounds).toEqual({ x: 39, y: 39, width: 12, height: 12 });
  });
});

describe('upload-pad pipeline regression (#302 — padded canvas must not stay tiny)', () => {
  /**
   * Simulate exactly what signature-pad-upload used to store: a 600x300 pad
   * canvas with a tightly-cropped 400x100 signature drawn centered at 0.8x
   * contain scale. scale = min((600*0.8)/400, (300*0.8)/100) = 1.2 ->
   * ink is 480x120 centered at (60, 90).
   */
  const buildPaddedPadCanvas = () => {
    const img = makeImageData(600, 300);
    paintInk(img, 60, 90, 480, 120);
    return img;
  };

  it('OLD behavior baseline: fitting the padded canvas leaves the ink small in the field', () => {
    const img = buildPaddedPadCanvas();

    // A wide signature field, 300x60.
    const fitted = getImageDimensions({ width: img.width, height: img.height }, 300, 60);

    // The padded 2:1 canvas fits by height -> 120x60. The ink inside is only
    // 80% of that width and 40% of that height: 96x24 visible ink in a 300x60
    // field. That is the bug Dan sees.
    expect(fitted.width).toBe(120);
    const inkWidthInField = (480 / 600) * fitted.width;
    const inkHeightInField = (120 / 300) * fitted.height;
    expect(inkWidthInField).toBe(96);
    expect(inkHeightInField).toBe(24);
  });

  it('NEW behavior: cropping to ink bounds first makes the signature fill the field', () => {
    const img = buildPaddedPadCanvas();

    const bounds = findInkBounds(img);
    expect(bounds).not.toBeNull();
    if (!bounds) {
      return;
    }

    // Ink (with margin) is ~482x122, aspect ~4:1 — same as the field family.
    const fitted = getImageDimensions(bounds, 300, 60);

    // The cropped image IS the ink, so the fitted size is the visible ink
    // size: it must essentially fill the 300x60 field (within the 1px
    // anti-alias margin) instead of the 96x24 of the old path.
    expect(fitted.width).toBeGreaterThan(230);
    expect(fitted.height).toBeGreaterThanOrEqual(58);
    expect(fitted.width * fitted.height).toBeGreaterThan(4 * 96 * 24);
  });
});
