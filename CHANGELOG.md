# Changelog

All notable changes to **sealflow-engine** (the owned hard fork of Documenso
v2.14.0, AGPL-3.0). Each version is a release tag that CI builds and publishes as
`ghcr.io/the-perfect-event/sealflow-engine:<tag>` and mirrors to the public
[`sealflow-engine-public`](https://github.com/The-Perfect-Event/sealflow-engine-public)
repo (AGPL §13). Format loosely follows [Keep a Changelog](https://keepachangelog.com);
versioning is our own `v1.x.y` line (not upstream Documenso's).

Deploy procedure: [`sealflow/docs/operations-runbook.md`](https://github.com/The-Perfect-Event/sealflow) → "Deploy a sealflow-engine version bump".

## [v1.2.6] — 2026-08-06

project-management#7 — monitoring/alerting groundwork ahead of the Adobe→SealFlow cutover.

### Added
- **`/api/health` is now pure liveness** — no dependency calls, just confirms the
  process is up. Existing DB + certificate checks moved to a new endpoint.
- **`/api/health/deep`** — readiness check for PostgreSQL, Redis, and the signing
  certificate. Intended for synthetic monitoring (CloudWatch canary) and load
  balancer health checks, not for high-frequency polling. No Chromium check:
  certificate/audit-log PDF generation are both `@deprecated` in favour of Konva
  rendering, so nothing in the live request path launches a browser anymore.

## [v1.2.5] — 2026-07-07

Final item of Dan's round-2 feedback (project-management#101 AC#5) — completes
the ticket. Bundles the v1.2.4 editor controls (inline required toggle,
bottom-align default) so everything ships in one deploy.

### Added
- **Validated signer-input Text fields.** A Text field can now be set to
  **Validate signer input as → Email or Date** in its settings. When set, the
  signer must type a value and it's format-checked before they can submit
  (a plain Text field with no rule still accepts anything — "validates format vs
  'Text' does not"). Opt-in via `validationRule` meta; enforced on both V1 and
  V2 signing paths; shared pure validator (`isTextFieldValueValid`) with tests.

## [v1.2.4] — 2026-07-07

More of Dan's round-2 feedback (project-management#101). Editor field controls.
The last item — signer-typed/validated Date & Email fields — is a standalone
feature landing separately after signer-flow verification.

### Added
- **Inline required/optional toggle** — an asterisk toggle on the on-field button
  cluster (in addition to the settings-panel toggle from v1.2.3); reflects and
  flips the selected field(s) (AC#1, inline half — completes AC#1).

### Changed
- **Fields default to bottom alignment** — field content now bottom-aligns by
  default (was middle) so it sits on the document's printed lines; applied via
  the shared universal renderer, so it's consistent in the editor and the sealed
  PDF. Per-field `verticalAlign` still overrides (AC#2).

## [v1.2.3] — 2026-07-07

Dan's round-2 E2E feedback (project-management#101). This release lands the
non-canvas items; the Konva-editor items (inline required toggle, default
bottom-alignment) and signer-typed/validated Date & Email fields follow after
in-browser verification.

### Added
- **Required/optional toggle** in the field-settings panel — a one-click switch
  above every field type's settings (AC#1, settings-panel half).
- **"Fully Executed" completion file** — the signed PDF emailed on completion is
  named `<title> - Fully Executed.pdf` (AC#8).

### Fixed
- **Printed Name shows the full name** — the Name field now prints the
  sender-assigned recipient name instead of the signer's account display name
  (which could be first-name only). V1 + V2 signing (AC#4).
- **Signer text-entry popup no longer hides the document** — it docks to the
  bottom with a transparent overlay, so signers keep sight of the field they're
  filling. V1 + V2 (AC#6).

### Changed
- **US date format** — new documents default to `MM/DD/YYYY` (set per-org for
  TPE + ATS) (AC#3).
- **Residual Documenso references removed** from user-facing, non-email surfaces:
  signer "Powered by" de-linked, social handle dropped, mobile-footer copyright
  → Sealflow, `security.txt`, download filenames, `/share` redirect, and the
  support email is now env-driven (AC#7).

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

[v1.2.5]: https://github.com/The-Perfect-Event/sealflow-engine/releases/tag/v1.2.5
[v1.2.4]: https://github.com/The-Perfect-Event/sealflow-engine/releases/tag/v1.2.4
[v1.2.3]: https://github.com/The-Perfect-Event/sealflow-engine/releases/tag/v1.2.3
[v1.2.2]: https://github.com/The-Perfect-Event/sealflow-engine/releases/tag/v1.2.2
[v1.2.1]: https://github.com/The-Perfect-Event/sealflow-engine/releases/tag/v1.2.1
[v1.2.0]: https://github.com/The-Perfect-Event/sealflow-engine/releases/tag/v1.2.0
[v1.1.0]: https://github.com/The-Perfect-Event/sealflow-engine/releases/tag/v1.1.0
