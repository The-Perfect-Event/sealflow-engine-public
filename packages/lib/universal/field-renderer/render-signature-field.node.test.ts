import { Canvas } from 'skia-canvas';
import { beforeAll, describe, expect, it } from 'vitest';

import { getImageDimensions, measureInkBounds } from './render-signature-field';

/**
 * End-to-end regression for #302 through REAL pixels and the REAL Node
 * measurement path (skia-canvas), not hand-built ImageData.
 *
 * Why this test exists: the v1.3.9 fix passed unit tests that fed the
 * renderer a clean, tightly-cropped image — but production images are pad
 * canvas snapshots with the signature centered at 0.8x in transparent
 * padding, and the fix did nothing for those. This test manufactures the
 * stored image exactly the way signature-pad-upload did, then verifies the
 * render path recovers the ink.
 */

// The render module loads skia-canvas via an async IIFE on import; give it a
// tick to resolve before using the Node path.
beforeAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 50));
});

/** A tightly-cropped "signature": a black scrawl filling a 400x100 image. */
const drawSignatureSource = () => {
  const source = new Canvas(400, 100);
  const ctx = source.getContext('2d');

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(5, 80);
  ctx.bezierCurveTo(80, 5, 160, 95, 240, 30);
  ctx.bezierCurveTo(300, 0, 350, 90, 395, 50);
  ctx.stroke();

  return source;
};

/**
 * Reproduce what signature-pad-upload.tsx STORED before the trim fix: the
 * source drawn centered at 0.8x contain scale onto the full pad canvas, full
 * canvas exported. (Pad ~600x300 at DPI 2 for a 300x150 element.)
 */
const buildStoredPaddedDataUrl = async (): Promise<string> => {
  const source = drawSignatureSource();
  const pad = new Canvas(600, 300);
  const ctx = pad.getContext('2d');

  const scale = Math.min((pad.width * 0.8) / source.width, (pad.height * 0.8) / source.height);
  const x = (pad.width - source.width * scale) / 2;
  const y = (pad.height - source.height * scale) / 2;

  ctx.drawImage(source, x, y, source.width * scale, source.height * scale);

  return await pad.toDataURL('png');
};

describe('#302 regression — padded stored signature through the real Node render path', () => {
  it('recovers the ink from the padded canvas and fills the field', async () => {
    const storedDataUrl = await buildStoredPaddedDataUrl();

    // Load it the way createSignatureImage does in Node.
    const { Image } = await import('skia-canvas');
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const img = new Image(storedDataUrl) as unknown as HTMLImageElement;

    expect(img.width).toBe(600);
    expect(img.height).toBe(300);

    // Ground truth: the ink bounds of the SOURCE, measured the same way.
    const source = drawSignatureSource();
    const sourceDataUrl = await source.toDataURL('png');
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const sourceImg = new Image(sourceDataUrl) as unknown as HTMLImageElement;
    const sourceBounds = measureInkBounds(sourceImg) ?? { x: 0, y: 0, width: 400, height: 100 };

    const bounds = measureInkBounds(img);

    // The pad drew the source at scale = min(480/400, 240/100) = 1.2,
    // offset to center it at (60, 90). The measured ink in the padded canvas
    // must be the source ink scaled by exactly that transform (few px slack
    // for anti-aliasing + the 1px margin).
    expect(bounds).not.toBeNull();
    if (!bounds) {
      return;
    }

    expect(Math.abs(bounds.x - (60 + sourceBounds.x * 1.2))).toBeLessThanOrEqual(4);
    expect(Math.abs(bounds.y - (90 + sourceBounds.y * 1.2))).toBeLessThanOrEqual(4);
    expect(Math.abs(bounds.width - sourceBounds.width * 1.2)).toBeLessThanOrEqual(6);
    expect(Math.abs(bounds.height - sourceBounds.height * 1.2)).toBeLessThanOrEqual(6);

    // OLD path: fit the raw 600x300 canvas into a 300x60 field -> 120x60
    // drawn, of which the ink is only ~96x24.
    const oldFit = getImageDimensions(img, 300, 60);
    const oldVisibleInkWidth = (bounds.width / img.width) * oldFit.width;
    expect(oldVisibleInkWidth).toBeLessThan(100);

    // NEW path: fit the CROPPED ink into the field -> the ink itself spans
    // (nearly) the full field width.
    const newFit = getImageDimensions(bounds, 300, 60);
    expect(newFit.width).toBeGreaterThan(200);
    expect(newFit.width * newFit.height).toBeGreaterThan(
      3 * oldVisibleInkWidth * ((bounds.height / img.height) * oldFit.height),
    );
  });

  it('leaves an already-clean (edge-to-edge ink) image uncropped', async () => {
    // Ink genuinely touching every edge: a full-bleed border stroke.
    const source = new Canvas(400, 100);
    const ctx = source.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, 400, 100);

    const dataUrl = await source.toDataURL('png');

    const { Image } = await import('skia-canvas');
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const img = new Image(dataUrl) as unknown as HTMLImageElement;

    const bounds = measureInkBounds(img);

    // Full-coverage ink -> measureInkBounds signals "nothing to trim" and the
    // render path falls back to the raw image, exactly the pre-fix fit.
    expect(bounds).toBeNull();

    const fit = getImageDimensions(bounds ?? img, 300, 60);
    expect(fit.width).toBe(240); // 400x100 into 300x60: 0.6x contain
    expect(fit.height).toBe(60);
  });
});
