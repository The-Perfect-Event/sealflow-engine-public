import Konva from 'konva';

import { DEFAULT_SIGNATURE_TEXT_FONT_SIZE, getSignatureFontFamily } from '../../constants/pdf';
import { AppError } from '../../errors/app-error';
import type { TSignatureFieldMeta } from '../../types/field-meta';
import { resolveFieldOverflowMode } from '../../types/field-meta';
import { calculateOverflowLayout } from './calculate-overflow-layout';
import { createFieldHoverInteraction, upsertFieldGroup, upsertFieldRect } from './field-generic-items';
import type { FieldToRender, RenderFieldElementOptions } from './field-renderer';
import { calculateFieldPosition } from './field-renderer';
import type { InkBounds } from './signature-ink-bounds';
import { findInkBounds } from './signature-ink-bounds';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SkiaImage: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SkiaCanvas: any;

void (async () => {
  if (typeof window === 'undefined') {
    const mod = await import('skia-canvas');
    SkiaImage = mod.Image;
    SkiaCanvas = mod.Canvas;
  }
})();

export const getImageDimensions = (
  img: Pick<HTMLImageElement, 'width' | 'height'>,
  fieldWidth: number,
  fieldHeight: number,
) => {
  let imageWidth = img.width;
  let imageHeight = img.height;

  // Fit the image to the field, preserving aspect ratio — scaling UP as
  // well as down. The previous `, 1` clamp capped the factor at 1x, so
  // a signature image with smaller pixel dimensions than the field was
  // drawn at its native (tiny) size and centered, never filling the box
  // (#302, Dan uploaded a tightly-cropped image and it came out tiny).
  const scalingFactor = Math.min(fieldWidth / imageWidth, fieldHeight / imageHeight);

  imageWidth = imageWidth * scalingFactor;
  imageHeight = imageHeight * scalingFactor;

  const imageX = (fieldWidth - imageWidth) / 2;
  const imageY = (fieldHeight - imageHeight) / 2;

  return {
    width: imageWidth,
    height: imageHeight,
    x: imageX,
    y: imageY,
  };
};

/**
 * Measure the ink bounding box of a loaded image by rasterising it and
 * scanning the alpha channel. Returns null when the image can't be measured
 * or cropping would be a no-op — callers then render the image uncropped,
 * which is exactly the pre-trim behavior (fail open, never fail the render).
 *
 * Works in both environments: browser (offscreen canvas) and Node
 * (skia-canvas). Stored signatures are canvas snapshots with the ink centered
 * in transparent padding (the upload pad embeds uploads at 0.8x in the full
 * pad canvas), so without this the "fit to field" scales the padding, not the
 * ink (#302, Dan).
 */
export const measureInkBounds = (img: HTMLImageElement): InkBounds | null => {
  try {
    const width = img.width;
    const height = img.height;

    if (!width || !height) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let canvas: any;

    if (typeof window !== 'undefined') {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
    } else {
      if (!SkiaCanvas) {
        return null;
      }

      canvas = new SkiaCanvas(width, height);
    }

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return null;
    }

    ctx.drawImage(img, 0, 0);

    return findInkBounds(ctx.getImageData(0, 0, width, height));
  } catch {
    return null;
  }
};

type FieldSignature =
  | {
      node: Konva.Text;
      isImageSignature: false;
      isLabel: boolean;
    }
  | {
      node: Konva.Image;
      isImageSignature: true;
      isLabel: boolean;
    };

/**
 * The pixel ratio used when caching the signature image as an offscreen bitmap.
 *
 * Konva's default redraw composites the source image with low-quality scaling
 * which makes signatures look blurry, especially when the source PNG is much
 * larger than the field. Caching at a high pixel ratio rasterises the shape
 * once into a sharp bitmap that is then reused on every redraw.
 *
 * Multiplied by `devicePixelRatio` to keep the cache crisp on retina displays.
 */
const SIGNATURE_IMAGE_CACHE_PIXEL_RATIO = 2;

/**
 * Build a Konva.Image for a base64 signature, sized to fit within the given
 * field dimensions. Works in both browser and Node.js (via skia-canvas).
 */
const createSignatureImage = (signatureImageAsBase64: string, fieldWidth: number, fieldHeight: number): Konva.Image => {
  if (typeof window !== 'undefined') {
    const img = new Image();

    const image = new Konva.Image({
      image: img,
      x: 0,
      y: 0,
      width: fieldWidth,
      height: fieldHeight,
      listening: false,
    });

    img.onload = () => {
      // Crop to the ink bounding box before fitting: the stored base64 is a
      // pad-canvas snapshot with the signature centered in transparent
      // padding, so fitting the raw image fills the field with padding while
      // the ink stays small (#302). Null bounds -> render uncropped as before.
      const inkBounds = measureInkBounds(img);

      image.setAttrs({
        image: img,
        ...(inkBounds ? { crop: inkBounds } : {}),
        ...getImageDimensions(inkBounds ?? img, fieldWidth, fieldHeight),
      });

      // Cache the image as a high-resolution bitmap so it stays sharp on
      // redraws and zoom changes instead of being re-scaled from the source PNG
      // every time.
      image.cache({
        pixelRatio: SIGNATURE_IMAGE_CACHE_PIXEL_RATIO * (window.devicePixelRatio || 1),
      });
    };

    img.src = signatureImageAsBase64;

    return image;
  }

  // Node.js with skia-canvas
  if (!SkiaImage) {
    throw new Error('Skia image not found');
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const img = new SkiaImage(signatureImageAsBase64) as unknown as HTMLImageElement;

  // Same ink-bounds crop as the browser path — this is the PDF export path,
  // so without it the signature burns into the final document tiny (#302).
  const inkBounds = measureInkBounds(img);

  return new Konva.Image({
    image: img,
    ...(inkBounds ? { crop: inkBounds } : {}),
    ...getImageDimensions(inkBounds ?? img, fieldWidth, fieldHeight),
    listening: false,
  });
};

const createFieldSignature = (field: FieldToRender, options: RenderFieldElementOptions): FieldSignature => {
  const { pageWidth, pageHeight, mode = 'edit', translations } = options;

  const { fieldX, fieldY, fieldWidth, fieldHeight } = calculateFieldPosition(field, pageWidth, pageHeight);
  const fontSize = field.fieldMeta?.fontSize || DEFAULT_SIGNATURE_TEXT_FONT_SIZE;

  const fieldText = new Konva.Text({
    id: `${field.renderId}-text`,
    name: 'field-text',
    listening: false,
  });

  const fieldTypeName = translations?.[field.type] || field.type;

  // Calculate text positioning based on alignment
  const textX = 0;
  const textY = 0;

  let textToRender: string = fieldTypeName;

  const signature = field.signature;

  // Handle edit mode.
  if (mode === 'edit') {
    textToRender = fieldTypeName;

    // If the field has already been signed and we have the signature data
    // available, render it. Otherwise leave the field type label as a placeholder.
    if (field.inserted && signature?.typedSignature) {
      textToRender = signature.typedSignature;
    }

    if (field.inserted && signature?.signatureImageAsBase64) {
      return {
        node: createSignatureImage(signature.signatureImageAsBase64, fieldWidth, fieldHeight),
        isImageSignature: true,
        isLabel: false,
      };
    }
  }

  // Handle sign mode.
  if (mode === 'sign' || mode === 'export') {
    textToRender = fieldTypeName;

    // Export mode burns fields into the final PDF: an uninserted signature
    // field must render NOTHING. Rendering the placeholder label here would
    // burn a cursive "SIGNATURE" into the document as if it were a signature.
    // (Mirrors the generic text renderer, which blanks placeholders on export.)
    if (mode === 'export' && !field.inserted) {
      textToRender = '';
    }

    if (field.inserted && !signature) {
      throw new AppError('MISSING_SIGNATURE');
    }

    if (signature?.typedSignature) {
      textToRender = signature.typedSignature;
    }

    if (signature?.signatureImageAsBase64) {
      return {
        node: createSignatureImage(signature.signatureImageAsBase64, fieldWidth, fieldHeight),
        isImageSignature: true,
        isLabel: false,
      };
    }
  }

  const fieldMeta = field.fieldMeta as TSignatureFieldMeta | undefined;

  // Whether we're rendering the field type name (like "Signature") vs actual signed content.
  // Overflow should not apply to the label.
  const isLabel = !signature?.typedSignature;

  const overflowLayout = calculateOverflowLayout({
    overflowMode: resolveFieldOverflowMode(fieldMeta),
    isLabel,
    textToRender,
    fontSize,
    fontFamily: getSignatureFontFamily(textToRender),
    lineHeight: 1,
    letterSpacing: 0,
    textAlign: 'center',
    verticalAlign: 'middle',
    baseX: textX,
    baseY: textY,
    baseWidth: fieldWidth,
    baseHeight: fieldHeight,
    groupX: fieldX,
    groupY: fieldY,
    pageWidth,
    pageHeight,
  });

  fieldText.setAttrs({
    x: overflowLayout.x,
    y: overflowLayout.y,
    verticalAlign: overflowLayout.verticalAlign,
    wrap: overflowLayout.wrap,
    text: textToRender,
    fontSize,
    fontFamily: getSignatureFontFamily(textToRender),
    align: overflowLayout.textAlign,
    width: overflowLayout.width,
    height: overflowLayout.height,
  } satisfies Partial<Konva.TextConfig>);

  return { node: fieldText, isImageSignature: false, isLabel };
};

export const renderSignatureFieldElement = (field: FieldToRender, options: RenderFieldElementOptions) => {
  const { mode = 'edit', pageLayer, pageWidth, pageHeight, color } = options;

  const isFirstRender = !pageLayer.findOne(`#${field.renderId}`);

  const fieldGroup = upsertFieldGroup(field, options);

  // Clear previous children and listeners to re-render fresh.
  fieldGroup.removeChildren();
  fieldGroup.off('transform');

  // Assign elements to group and any listeners that should only be run on initialization.
  if (isFirstRender) {
    pageLayer.add(fieldGroup);
  }

  // Render the field background and text.
  const fieldRect = upsertFieldRect(field, options);
  const { node: fieldSignature, isImageSignature, isLabel } = createFieldSignature(field, options);

  fieldGroup.add(fieldRect);
  fieldGroup.add(fieldSignature);

  fieldGroup.on('transform', () => {
    const groupScaleX = fieldGroup.scaleX();
    const groupScaleY = fieldGroup.scaleY();

    // Adjust text scale so it doesn't change while group is resized.
    fieldSignature.scaleX(1 / groupScaleX);
    fieldSignature.scaleY(1 / groupScaleY);

    const rectWidth = fieldRect.width() * groupScaleX;
    const rectHeight = fieldRect.height() * groupScaleY;

    // During active transform, use crop dimensions (field bounds only).
    if (!isImageSignature) {
      fieldSignature.x(0);
      fieldSignature.y(0);
      fieldSignature.wrap('word');
    }

    fieldSignature.width(rectWidth);
    fieldSignature.height(rectHeight);

    fieldGroup.getLayer()?.batchDraw();
  });

  fieldGroup.on('transformend', () => {
    fieldSignature.scaleX(1);
    fieldSignature.scaleY(1);

    const rectWidth = fieldRect.width();
    const rectHeight = fieldRect.height();

    if (!isImageSignature) {
      const fieldMeta = field.fieldMeta as TSignatureFieldMeta | undefined;

      const newOverflowLayout = calculateOverflowLayout({
        overflowMode: resolveFieldOverflowMode(fieldMeta),
        isLabel,
        textToRender: fieldSignature.text(),
        fontSize: fieldSignature.fontSize(),
        fontFamily: getSignatureFontFamily(fieldSignature.text()),
        lineHeight: 1,
        letterSpacing: 0,
        textAlign: 'center',
        verticalAlign: 'middle',
        baseX: 0,
        baseY: 0,
        baseWidth: rectWidth,
        baseHeight: rectHeight,
        groupX: fieldGroup.x(),
        groupY: fieldGroup.y(),
        pageWidth,
        pageHeight,
      });

      fieldSignature.x(newOverflowLayout.x);
      fieldSignature.y(newOverflowLayout.y);
      fieldSignature.width(newOverflowLayout.width);
      fieldSignature.height(newOverflowLayout.height);
      fieldSignature.wrap(newOverflowLayout.wrap);
      fieldSignature.verticalAlign(newOverflowLayout.verticalAlign);
    } else {
      fieldSignature.width(rectWidth);
      fieldSignature.height(rectHeight);
    }

    fieldGroup.getLayer()?.batchDraw();
  });

  // Handle export mode.
  if (mode === 'export') {
    // Hide the rectangle.
    fieldRect.opacity(0);
  }

  if (color !== 'readOnly' && mode !== 'export') {
    createFieldHoverInteraction({ fieldGroup, fieldRect, options });
  }

  return {
    fieldGroup,
    isFirstRender,
  };
};
