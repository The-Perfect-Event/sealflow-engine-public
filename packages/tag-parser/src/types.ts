/**
 * Public type contract for the Adobe-tag parser.
 * See tools/adobe-tag-parser/README.md for the tag taxonomy reference.
 */

export type FieldType =
  | 'SIGNATURE'
  | 'INITIALS'
  | 'DATE'
  | 'EMAIL'
  | 'NAME'
  | 'CHECKBOX'
  | 'TEXT';

export type FieldSubtype =
  | 'phone'
  | 'title'
  | 'company'
  | 'address'
  | 'url'
  | 'signature'
  | 'initials';

export interface FieldDimensions {
  widthMm: number;
  heightMm: number;
}

export interface FieldPosition {
  /** 1-indexed page number. */
  page: number;
  /** Points from the top-left of the page; anchored to the tag's first character. */
  xPt: number;
  yPt: number;
}

export interface BoundingBox {
  /** Points from the top-left of the page; covers the full rendered (visible) tag text. */
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
}

export interface ParsedField {
  /** Original tag string, for debugging. */
  raw: string;
  type: FieldType;
  subtype?: FieldSubtype;
  /** Recipient role label, e.g. 'signer1'. */
  recipient: string;
  required: boolean;
  /** Declared dimensions if `:dimension(...)` present, else per-type default. */
  dimensions: FieldDimensions;
  /** Field box anchor: top-left of the tag's first character + declared/default dimensions. */
  position: FieldPosition;
  /** Visible-text box to overlay with a white rectangle. */
  boundingBox: BoundingBox;
}

/**
 * Result of decoding a single tag string, before any PDF position information
 * is known. The PDF reader stage adds `position` and `boundingBox` to produce
 * a full {@link ParsedField}.
 */
export type DecodedField = Omit<ParsedField, 'position' | 'boundingBox'>;

export interface TagFailure {
  raw: string;
  reason: string;
}

export interface ParseDiagnostics {
  tagsFound: number;
  tagsParsed: number;
  tagsFailed: TagFailure[];
}

export interface PageSize {
  /** 1-indexed page number. */
  page: number;
  widthPt: number;
  heightPt: number;
}

export interface ParseResult {
  /** PDF with all tag text overlaid (or the input bytes unchanged when no tags found). */
  cleanPdfBytes: Uint8Array;
  fields: ParsedField[];
  /** Unique, sorted role labels, e.g. ['signer1', 'signer2']. */
  recipients: string[];
  /**
   * Page dimensions in points, one per page (1-indexed). Needed to convert a
   * field's point/mm geometry into Documenso's percentage-based coordinates.
   */
  pageSizes: PageSize[];
  diagnostics: ParseDiagnostics;
}
