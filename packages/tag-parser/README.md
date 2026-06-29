# @documenso/tag-parser

Compatibility layer that converts **Adobe Sign-style tagged PDFs** into
**signing fields** + a **cleaned PDF** (visible tag text overlaid).

Lets contracts with embedded Adobe Sign tags flow through the engine
without rewriting templates. The parser reads tags like
`{{Sig1_es_:signer1}}` from PDF text, maps them to recipients and
fields at the right page coordinates, and produces a cleaned PDF
(white-rectangle overlay) so the tag syntax isn't visible to signers.

## Public surface

```ts
import {
  parseAdobeTaggedPdf,
  buildPlaceholderRecipients,
  buildFieldCreateData,
} from '@documenso/tag-parser';

const result = await parseAdobeTaggedPdf(pdfBytes);
// result.cleanedPdf       — Uint8Array, tag text overlaid
// result.fields           — ParsedField[], page-coord positions
// result.recipientIds     — string[], in tag-order (e.g. ["signer1","signer2"])
// result.diagnostics      — { tagsFound, tagsFailed }
```

To produce engine-ready payloads:

```ts
const recipients = buildPlaceholderRecipients(result.recipientIds);
const fields = buildFieldCreateData(result.fields, recipients);
// recipients[i].email is the positional placeholder signer<N>@placeholder.local
// caller swaps these for real emails before distribution
```

## Adobe tag syntax supported

```
{{ [*] PREFIX [digit] _es_ : RECIPIENT [:SUBTYPE] [:dimension(width=Xmm, height=Ymm)] [:required] }}
```

| Prefix | Maps to |
|---|---|
| `Sig` | SIGNATURE |
| `Int` | INITIALS |
| `Em` | EMAIL |
| `N` | NAME |
| `Dte` | DATE |
| `Chk` | CHECKBOX |
| `Ttl` / `Mobile` / `phone` / `Txt` / `Cmp` / `Adr` / `Hyp` | TEXT (with subtype) |

Default dimensions, prefix maps, and subtype catalog live in `src/constants.ts`.

## Behavior contract

- **Best-effort**: a single malformed tag is recorded in
  `diagnostics.tagsFailed` and never aborts the document
- **Always overlay**: every detected tag-shaped string is overlaid even
  when it fails to decode (so no `{{` leaks to signers)
- **Identity passthrough**: a PDF with zero tags returns unchanged
- **Positional recipient mapping**: tag-order determines
  `signer1@placeholder.local`, `signer2@placeholder.local`, etc.
  Callers replace with real emails after parsing.

## Coordinates

- PDF coordinate origin is bottom-left
- Engine field coordinates are top-left, in percent of page dimensions
- Parser handles the flip + percent conversion; consumers receive
  ready-to-use `pageX / pageY / width / height` values

## License

MIT — part of the engine monorepo. See repository LICENSE for the engine
license terms.
