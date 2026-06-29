# FROZEN code paths

Per [sealflow#13](https://github.com/The-Perfect-Event/sealflow/issues/13) guardrail #1.

The paths listed below implement the **cryptographic and legal correctness** of signed documents. A bug here = invalid PAdES signature, missing RFC-3161 timestamp, wrong audit trail = contracts that don't hold up. Modifications require board-level approval and a co-signed PR review.

This is the rule a future-us (or a future hire) needs to honor without thinking. If you are editing one of these files because "it would be cleaner," **stop**. Open an issue first.

## Hard freeze — no changes without escalation

These implement signing itself. Every byte here matters.

| Path | What it does |
|---|---|
| `packages/signing/` (entire package) | The signing module — local cert transport (`transports/local.ts`), Google Cloud KMS transport (`transports/google-cloud.ts`), RFC-3161 TSA call (`helpers/tsa.ts`), public API in `index.ts`. This is where the PDF actually gets cryptographically sealed. |
| `packages/lib/jobs/definitions/internal/seal-document.ts` | Seal job definition. Orchestrates the sealing flow. |
| `packages/lib/jobs/definitions/internal/seal-document.handler.ts` | Seal job handler. Runs the actual seal in the worker. |
| `packages/lib/jobs/definitions/internal/seal-document-sweep.ts` | Sealing sweep cron — finds documents that need re-sealing. |
| `packages/lib/jobs/definitions/internal/seal-document-sweep.handler.ts` | Sealing sweep handler. |
| `packages/lib/server-only/pdf/normalize-pdf.ts` | PDF normalization that runs before sealing. Changing this can break signature validity. |

## Soft freeze — legally-load-bearing, change with audit trail

These don't perform cryptography but produce the legal evidence of the signing event. Changes here need PR review by Hasham + one other (not auto-merge), commit messages describing what changed and why, and a paper trail in the ticket.

| Path | What it does |
|---|---|
| `packages/lib/server-only/pdf/render-certificate.ts` | Renders the audit certificate appended to the signed PDF. |
| `packages/lib/server-only/pdf/generate-certificate-pdf.ts` | Generates the certificate PDF. |
| `packages/lib/server-only/pdf/generate-audit-log-pdf.ts` | Generates the audit log PDF. |
| `packages/lib/server-only/pdf/render-audit-logs.ts` | Renders audit log entries onto the certificate. |
| `packages/lib/server-only/pdf/add-rejection-stamp-to-pdf.ts` | Adds the rejection stamp when a recipient rejects. |
| `packages/trpc/server/admin-router/reseal-document.ts` | Re-seal flow for admin recovery. Touches the seal pipeline directly. |

## What's NOT frozen and can be modified freely

- Branding (colors, logos, text replacement) — Phase 1d of sealflow#13 will rewrite these natively
- Upload routes — Phase 2 of sealflow#13 hooks these for tag-parser intercept
- Auth/signup flow — sealflow#14 will rewrite to invite-only
- Org/team model — sealflow#15 may diverge significantly
- Email templates (visible content, subject lines) — change as needed for branding
- i18n strings — replace per sealflow#16
- v2 API route handlers — internal logic free to change; route shapes + response schemas remain stable per sealflow#13 guardrail #3
- The frontend dashboard pages, the editor, the recipient inbox, etc. — all open for changes

## Escalation process for frozen-path changes

1. Open a sealflow issue describing what you want to change and why
2. Tag with the `frozen-path` label
3. PR must reference the issue
4. PR requires review approval from Hasham + one other (no self-merge even if you're the org admin)
5. Commit message must include `[FROZEN]` prefix and reference the approving review
6. After merge, before next release tag: run a sealed-document repro against the new build (envelope create → sign → seal → `pdfsig` verify shows valid `ETSI.CAdES.detached` + `ETSI.RFC3161`) — same gate sealflow#9's POC passed.

## Why these specific paths

These are inherited from Documenso's signing pipeline, which has been validated against `pdfsig` in our POC (see `sealflow/docs/foundation-setup.md` for the gate evidence) and produces valid PAdES + RFC-3161 outputs against the DigiCert TSA. The validation we did establishes a known-good baseline. Any change here invalidates that baseline until we re-run the verification.
