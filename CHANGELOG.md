# Changelog

All notable changes to **sealflow-engine** (the owned hard fork of Documenso
v2.14.0, AGPL-3.0). Each version is a release tag that CI builds and publishes as
`ghcr.io/the-perfect-event/sealflow-engine:<tag>` and mirrors to the public
[`sealflow-engine-public`](https://github.com/The-Perfect-Event/sealflow-engine-public)
repo (AGPL §13). Format loosely follows [Keep a Changelog](https://keepachangelog.com);
versioning is our own `v1.x.y` line (not upstream Documenso's).

Deploy procedure: [`sealflow/docs/operations-runbook.md`](https://github.com/The-Perfect-Event/sealflow) → "Deploy a sealflow-engine version bump".

## [v1.2.2] — 2026-07-06

Signer-experience white-label completion and a filename fix, from a review of the
live signing flow (project-management#98).

### Changed
- **Signer flow is fully white-labeled** — removed the post-signing "Share your
  signing experience" card (hardcoded `@documenso` tweet + a `/share/…` link that
  didn't work) from both the signer completion page and the sender dashboard;
  the recipient-facing browser tab title is now "Sign Document" (was
  "Sign Document - Sealflow"); removed the "Check out Sealflow" marketing text on
  cancelled/expired states; and the signing header shows the sender org's logo or
  nothing — never a Sealflow fallback. (Org branding colours + logo were already
  applied via the token→team branding pipeline.)

### Fixed
- **Doubled file extension** — uploaded document titles are now stored without the
  `.pdf` extension (`Contract.pdf` → title `Contract`), matching the download layer
  which re-adds exactly one extension. Previously the extension leaked into the
  stored title and doubled up in derived names. Normalised at every title-creation
  site via a shared `stripPdfExtension` helper (+ unit test).

## [v1.2.1] — 2026-07-06

Hotfix for a regression introduced in v1.2.0.

### Fixed
- **Tagged-document upload failed with "Could not find recipient ID"** — the
  v1.2.0 placeholder-recipient rename (`signerN@placeholder.local`) updated the
  recipient *lookup* but not the auto-*creation* site, so uploading an
  Adobe-tagged PDF **without** pre-specified recipients (the dashboard path)
  threw `INVALID_BODY` on `envelope.create`. Both sides now derive the
  placeholder email/name from a single shared helper
  (`getPlaceholderRecipientEmail` / `getPlaceholderRecipientName`) so they can't
  drift again; added a regression test that reproduces the `r2 → signer2` case.

## [v1.2.0] — 2026-07-06

Tagged-document + certificate polish and email white-labeling, from an end-to-end
review of a real Adobe-tagged contract (PI KAPPA ALPHA). Tracked in
project-management#98 (+ #97).

### Added
- **Certificate signature accent follows branding** — the signature-thumbnail
  border/shadow on the audit certificate derive from the org's brand primary
  colour instead of a hardcoded green (falls back to green when branding is off).
- **Phone/text-subtype field labels** — Adobe text subtypes (phone/title/company/
  address/url) now render as labeled TEXT fields ("Phone", …) instead of bare boxes.

### Fixed
- **Signature/initial field alignment** — Adobe-tag signature/initial placeholders
  are baseline-anchored so they sit *on* the signing line (were dropping 17–24pt
  below it; text fields were already correct). Applies to the dashboard tag-parser
  intercept and the standalone parser.
- **Sensible placeholder recipients** — auto-created recipients are now
  `Signer N` / `signerN@placeholder.local` (non-routable) instead of `Recipient N` /
  `recipient.N@documenso.com` (a routable Documenso domain).
- **Email white-label de-brand** — org logo in the admin-user-created email; removed
  dead `/signup` CTAs (invite-only) and hardcoded `documenso.com` contact/marketing
  links; the AGPL/attribution footer is gated by `hidePoweredBy` (project-management#97).
- **Dark-mode logo** — a white checkmark-cutout logo variant is swapped in on dark
  surfaces, replacing the brightness/invert CSS hot-patch (sealflow#19).

### Changed
- **Certificate typography** — reduced title 18→14, header 11→10, body 10/9/8 → 9/8/7
  for a cleaner page (soft-frozen `render-certificate.ts`; cosmetic only).

## [v1.1.0] — 2026-07-01

Invite-only tenancy and enterprise-module stubbing.

### Added
- **Invite-only account provisioning** — public signup removed (`/signup` → 404);
  accounts created only by an admin or an org-invite token (sealflow#14).
- **Admin-only organisation creation** — no personal-org auto-create; 2-role model
  (ADMIN/USER) (sealflow#15).

### Changed
- **EE stubbed for AGPL cleanliness** — Documenso Commercial-Licensed Enterprise
  modules replaced with AGPL no-op throwing stubs; run with EE off (sealflow#18).

## [v1.0.0] – [v1.0.3] — 2026-06-29 … 2026-06-30

Initial owned hard fork + production cutover (sealflow#13).

### Added
- **Hard fork of Documenso v2.14.0** (AGPL-3.0) as `sealflow-engine`; public §13
  disclosure mirror automated on every release tag.
- **Adobe-tag parser intercept** on the dashboard upload route — auto-places fields
  from `{{…_es_…}}`-tagged PDFs; `Envelope.taggedSource` audit column.
- **Native Sealflow branding** — Documenso logos/text replaced in source (no
  post-build patches).
- **Sequential signing by default** (`DocumentMeta.signingOrder = SEQUENTIAL`).

### Fixed
- Branding/logo and disclosure-mirror CI refspec fixes (v1.0.1–v1.0.3).

[v1.2.2]: https://github.com/The-Perfect-Event/sealflow-engine/releases/tag/v1.2.2
[v1.2.1]: https://github.com/The-Perfect-Event/sealflow-engine/releases/tag/v1.2.1
[v1.2.0]: https://github.com/The-Perfect-Event/sealflow-engine/releases/tag/v1.2.0
[v1.1.0]: https://github.com/The-Perfect-Event/sealflow-engine/releases/tag/v1.1.0
