import { describe, expect, it } from 'vitest';

import { getImageDimensions } from './render-signature-field';

/**
 * The signature image must be fit ("contain") into the field — scaled UP or
 * DOWN, aspect ratio preserved, centered. Regression for #302: a small-pixel
 * image used to be capped at 1x scale and rendered tiny in a large field.
 */
const img = (width: number, height: number) => ({ width, height }) as HTMLImageElement;

describe('getImageDimensions (#302 signature fit)', () => {
  it('scales a SMALL image UP to fill the field (was the bug — capped at 1x before)', () => {
    // 50x20 image into a 200x80 field: min(200/50, 80/20) = min(4, 4) = 4x
    const r = getImageDimensions(img(50, 20), 200, 80);
    expect(r.width).toBe(200);
    expect(r.height).toBe(80);
  });

  it('scales a LARGE image DOWN to fit (existing behavior must not regress)', () => {
    // 800x400 into 200x80: min(200/800, 80/400) = min(0.25, 0.2) = 0.2x
    const r = getImageDimensions(img(800, 400), 200, 80);
    expect(r.width).toBe(160); // 800*0.2
    expect(r.height).toBe(80); // 400*0.2 — fills the limiting dimension
  });

  it('preserves aspect ratio (no stretch)', () => {
    const r = getImageDimensions(img(100, 100), 200, 80); // square into wide field
    expect(r.width).toBe(r.height); // stays square
    expect(r.height).toBe(80); // limited by height
  });

  it('centers the image within the field', () => {
    const r = getImageDimensions(img(100, 100), 200, 80); // 80x80 centered in 200x80
    expect(r.x).toBe((200 - 80) / 2); // 60
    expect(r.y).toBe((80 - 80) / 2); // 0
  });
});
