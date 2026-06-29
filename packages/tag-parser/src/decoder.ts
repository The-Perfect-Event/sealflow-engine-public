import type { DecodedField, FieldSubtype, FieldDimensions } from './types.js';
import {
  PREFIX_MAP,
  KNOWN_SUBTYPES,
  DEFAULT_DIMENSIONS,
  TAG_DETECT_REGEX,
} from './constants.js';

/** Thrown internally by {@link decodeTag} and surfaced as a diagnostics failure. */
export class TagDecodeError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'TagDecodeError';
  }
}

/**
 * Matches the head of a tag body (between `{{` and `_es_`):
 *   [whitespace] [*] [whitespace] PREFIX [DIGITS]
 */
const HEAD_REGEX = /^\s*(\*?)\s*([A-Za-z]+?)(\d*)\s*$/;

/**
 * Matches a `dimension(width=Xmm, height=Ymm)` token. Whitespace around the
 * separators is tolerated; values may be integers or decimals.
 */
const DIMENSION_REGEX =
  /^dimension\(\s*width\s*=\s*([\d.]+)\s*mm\s*,\s*height\s*=\s*([\d.]+)\s*mm\s*\)$/i;

function resolvePrefix(word: string): { type: DecodedField['type']; subtype?: FieldSubtype } {
  const exact = PREFIX_MAP[word];
  if (exact) return exact;
  // Case-insensitive fallback so e.g. `SIG` / `sig` still resolve.
  const lower = word.toLowerCase();
  for (const [key, value] of Object.entries(PREFIX_MAP)) {
    if (key.toLowerCase() === lower) return value;
  }
  throw new TagDecodeError(`unknown prefix: ${word}`);
}

function parseDimension(token: string): FieldDimensions {
  const m = DIMENSION_REGEX.exec(token);
  if (!m) throw new TagDecodeError(`malformed dimension: ${token}`);
  const widthMm = Number(m[1]);
  const heightMm = Number(m[2]);
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    throw new TagDecodeError(`malformed dimension: ${token}`);
  }
  return { widthMm, heightMm };
}

/**
 * Decode a single raw tag string into a {@link DecodedField} (everything except
 * PDF position, which is filled in later by the reader stage).
 *
 * Best-effort by contract: throws {@link TagDecodeError} on unrecoverable
 * problems (unknown prefix, missing recipient, malformed dimension). Callers
 * route the error into `diagnostics.tagsFailed` rather than aborting.
 */
export function decodeTag(raw: string): DecodedField {
  const trimmed = raw.trim();
  const shell = /^\{\{([\s\S]*)\}\}$/.exec(trimmed);
  if (!shell) throw new TagDecodeError('not a tag: missing {{ }} delimiters');

  const inner = shell[1]!;
  const esIdx = inner.indexOf('_es_');
  if (esIdx === -1) throw new TagDecodeError('missing _es_ marker');

  const head = inner.slice(0, esIdx);
  // Tolerate whitespace between the `_es_` marker and the `:` recipient separator.
  const tail = inner.slice(esIdx + '_es_'.length).trimStart();

  // --- head: [*] PREFIX [digit] ---
  const headMatch = HEAD_REGEX.exec(head);
  if (!headMatch) throw new TagDecodeError(`malformed prefix segment: "${head.trim()}"`);
  const requiredFromStar = headMatch[1] === '*';
  const prefixWord = headMatch[2]!;
  const { type, subtype: prefixSubtype } = resolvePrefix(prefixWord);

  // --- tail: :recipient[:token]* ---
  if (!tail.startsWith(':')) throw new TagDecodeError('missing recipient (no ":" after _es_)');
  const tokens = tail.slice(1).split(':').map((t) => t.trim());
  const recipient = tokens.shift() ?? '';
  if (recipient === '') throw new TagDecodeError('missing recipient');

  let required = requiredFromStar;
  let declaredDimensions: FieldDimensions | undefined;
  let explicitSubtype: FieldSubtype | undefined;

  for (const token of tokens) {
    if (token === '') continue; // tolerate trailing/double colons
    const lower = token.toLowerCase();
    if (lower === 'required') {
      required = true;
    } else if (lower.startsWith('dimension')) {
      declaredDimensions = parseDimension(token);
    } else if (KNOWN_SUBTYPES.has(lower as FieldSubtype)) {
      explicitSubtype = lower as FieldSubtype;
    }
    // Unknown trailing tokens are ignored (best-effort), not fatal.
  }

  const subtype = explicitSubtype ?? prefixSubtype;
  const dimensions = declaredDimensions ?? DEFAULT_DIMENSIONS[type];

  const field: DecodedField = {
    raw: trimmed,
    type,
    recipient,
    required,
    dimensions,
  };
  if (subtype) field.subtype = subtype;
  return field;
}

export interface TagMatch {
  raw: string;
  /** Character offset of the tag within the searched string. */
  index: number;
}

/** Find every tag-shaped substring (counted toward tagsFound) in a text blob. */
export function findTags(text: string): TagMatch[] {
  const matches: TagMatch[] = [];
  const re = new RegExp(TAG_DETECT_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push({ raw: m[0], index: m.index });
    if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-width
  }
  return matches;
}
