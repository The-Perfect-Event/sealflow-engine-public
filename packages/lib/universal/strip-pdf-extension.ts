/**
 * Strip a single trailing `.pdf` (case-insensitive) from a document title.
 *
 * Document/envelope-item TITLES are stored WITHOUT the file extension — the
 * extension is re-added by the download layer (see `downloadPDF`, which does
 * `.replace(/\.pdf$/, '')` before appending a `_signed.pdf` / `.pdf` suffix).
 * Uploads derive the title from the original filename (e.g. `Contract.pdf`), so
 * without this normalisation the extension leaks into the stored title and then
 * doubles up in derived names (e.g. `Contract.pdf - Certificate.pdf`). Applying
 * this at every title-creation site keeps the extension included exactly once,
 * in the downloaded file only.
 *
 * The stored DocumentData filename is unaffected — that keeps its `.pdf`
 * (guaranteed by `putPdfFileServerSide`); only the human-facing title is cleaned.
 */
export const stripPdfExtension = (title: string): string => title.replace(/\.pdf$/i, '');
