/**
 * Public surface of the @documenso/tag-parser package.
 *
 * Parses Adobe Sign-style text tags from a PDF (e.g. {{Sig1_es_:signer1}})
 * into Sealflow recipient + field create payloads, and produces a cleaned
 * PDF with the visible tag text overlaid.
 *
 * Usage:
 *   import { parseAdobeTaggedPdf, buildPlaceholderRecipients,
 *            buildFieldCreateData } from '@documenso/tag-parser';
 */
export * from './src/index';
