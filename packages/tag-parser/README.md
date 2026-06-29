# @sealflow/adobe-tag-parser

Compatibility layer that converts **Adobe Sign-style tagged PDFs** into
**Documenso fields** + a **cleaned PDF** (visible tag text overlaid).

TPE-Sales has years of HTML contract templates with hand-embedded Adobe tags.
Rather than rewrite every template for the Documenso migration, this library
parses the tags at intake. One library, two callers (see
[`docs/adobe-tag-compat.md`](../../docs/adobe-tag-compat.md)):

1. **TPE-Sales API path** — backend calls `parseAdobeTaggedPdf()` inline before
   posting to Documenso (sealflow#3 owns this caller).
2. **Documenso dashboard upload path** — the webhook listener
   (`tools/sealflow-webhook-listener/`) reacts to `document.created`, runs the
   PDF through this library, replaces the upload with the cleaned version, and
   creates the fields with placeholder recipients.

Status: **complete and tested** (sealflow#11 steps 1–5) — decoder, PDF
read/overlay/compose, and the Documenso v2 field-payload mapping. The dashboard
webhook (step 6) is deferred; see
[`docs/adobe-tag-compat.md`](../../docs/adobe-tag-compat.md).

## Tag format

```
{{ [*] PREFIX [digit] _es_ : RECIPIENT [:SUBTYPE] [:dimension(width=Xmm, height=Ymm)] [:required] }}
```

### Prefix → Documenso type

| Adobe prefix | Documenso type | Subtype hint | Notes |
|---|---|---|---|
| `Sig` | SIGNATURE | — | |
| `Int` (+ digit `Int1`,`Int2`) | INITIALS | — | digit disambiguates only |
| `Em` | EMAIL | — | |
| `N` | NAME | — | |
| `Dte` | DATE | — | |
| `Chk` | CHECKBOX | — | |
| `Ttl` (+ digit) | TEXT | `title` | |
| `Mobile`, `phone` | TEXT | `phone` | `Mobile` capitalised, `phone` lower-case |
| `Txt` | TEXT | — | generic text |
| `Cmp` | TEXT | `company` | |
| `Adr` | TEXT | `address` | |
| `Hyp` | TEXT | `url` | |

A trailing digit on the prefix (`Int1`, `Ttl2`) is disambiguation only — it
never changes the type.

### Required encoding (equivalent)

- Leading `*`: `{{*Sig_es_:signer1}}`
- Trailing `:required`: `{{Sig_es_:signer1:required}}`
- Both: `{{*Sig_es_:signer1:required}}` (no error, `required=true`)

### Subtype resolution

An explicit `:SUBTYPE` token wins; otherwise the prefix's subtype hint is used.
Recognised subtypes: `phone`, `title`, `company`, `address`, `url`,
`signature`, `initials`.

### Field-box dimensions

Declared via `:dimension(width=Xmm, height=Ymm)` (whitespace tolerant, decimals
allowed). When absent, the per-type default applies:

| Type | Default (mm) |
|---|---|
| SIGNATURE | 60 × 8 |
| INITIALS | 60 × 10 |
| EMAIL / NAME | 80 × 6 |
| DATE | 40 × 6 |
| CHECKBOX | 6 × 6 |
| TEXT | 60 × 6 |

> **Two rectangles, two purposes.** The rendered tag text is ~150 mm wide; the
> *bounding box* (overlay rectangle) covers that visible text, while the *field
> box* uses the tag's start position + the declared/default dimensions above.
> Field position is the **top-left of the tag's first character**, not the
> bounding-box centre.

## API

```typescript
import { parseAdobeTaggedPdf, decodeTag, findTags } from '@sealflow/adobe-tag-parser';

const result = await parseAdobeTaggedPdf(pdfBytes); // Uint8Array in, ParseResult out
```

```typescript
interface ParseResult {
  cleanPdfBytes: Uint8Array;          // PDF with tag text overlaid (input unchanged if 0 tags)
  fields: ParsedField[];
  recipients: string[];               // unique, sorted: ['signer1', 'signer2']
  diagnostics: { tagsFound: number; tagsParsed: number; tagsFailed: { raw: string; reason: string }[] };
}

interface ParsedField {
  raw: string;
  type: 'SIGNATURE' | 'INITIALS' | 'DATE' | 'EMAIL' | 'NAME' | 'CHECKBOX' | 'TEXT';
  subtype?: 'phone' | 'title' | 'company' | 'address' | 'url' | 'signature' | 'initials';
  recipient: string;
  required: boolean;
  dimensions: { widthMm: number; heightMm: number };
  position: { page: number; xPt: number; yPt: number };          // 1-indexed page, pts from top-left
  boundingBox: { xPt: number; yPt: number; widthPt: number; heightPt: number };
}
```

`ParseResult` also carries `pageSizes` (per-page width/height in points), needed
to convert field geometry into Documenso's percentage coordinates.

### Documenso v2 mapping

Helpers to turn parser output into Documenso v2 public-API request bodies
(verified against v2.14.0 source):

```typescript
import { buildPlaceholderRecipients, buildFieldCreateData } from '@sealflow/adobe-tag-parser';

const recipients = buildPlaceholderRecipients(result);       // POST /api/v2/envelope/recipient/create-many
const { data, skipped } = buildFieldCreateData(result, roleToRecipientId); // .../field/create-many
```

Coordinates are emitted as **percentages of the page (0–100), top-left origin**
(`positionX/Y/width/height`), `fieldMeta.type` is the lower-case field kind, and
`required` lives in `fieldMeta`. Placeholder recipient emails use the
non-routable `*.placeholder.local` TLD.

> **PDF replacement is NOT done via the public API.** Documenso v2.14.0's
> replace-pdf route is internal-only, so the supported flow is the TPE-Sales
> inline path (post `cleanPdfBytes` via `envelope.create`). See the compat doc.

Lower-level helpers are also exported for testing/diagnostics:
`decodeTag(raw)` (pure string → `DecodedField`, no PDF), `findTags(text)`,
`readTaggedPdf`, `overlayTagBoxes`, `toDocumensoFieldCreate`, `PREFIX_MAP`,
`DEFAULT_DIMENSIONS`, `mmToPt`.

**Best-effort by contract.** A single malformed tag (unknown prefix, missing
recipient, malformed dimension) is recorded in `diagnostics.tagsFailed` — it
never throws out of `parseAdobeTaggedPdf` or aborts the document. A PDF with
zero tags returns the input bytes unchanged.

## Build & test

```bash
npm install
npm test           # vitest — 69 cases: decoder taxonomy, Documenso mapping, pixel-diff integration
npm run typecheck
npm run build      # emits dist/
npm run verify -- path/to/tagged.pdf   # dry-run: print the v2 payloads the parser would send
```

The integration test runs against the PI KAPPA ALPHA USC reference PDF in
`test/fixtures/`. Note it contains **12 tag placements** (9 unique strings) —
signer2's initials/name tags repeat across pages 6/7/9, each a distinct field.
The parser never deduplicates; the recipient set is `['signer1', 'signer2']`.

`scripts/verify-documenso-api.ts` doubles as the live smoke test against a real
Documenso instance (`--base --token --envelope document_<id>`) and the reference
payload shape for the sealflow#3 TPE-Sales integration.
