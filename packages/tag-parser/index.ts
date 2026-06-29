/**
 * Public surface of the @documenso/tag-parser package.
 *
 * Originally developed as a standalone CLI library at
 * sealflow/tools/adobe-tag-parser (sealflow#11). Vendored into the engine
 * monorepo as part of sealflow#13 Phase 2a so the dashboard upload route
 * can intercept tagged PDFs and auto-place fields.
 *
 * Consumers (TPE-Sales integration in sealflow#3 will use it via the
 * engine's published v2 API surface, not this package directly):
 *
 *   import { parseAdobeTaggedPdf, buildPlaceholderRecipients,
 *            buildFieldCreateData } from '@documenso/tag-parser';
 */
export * from './src/index';
