# sealflow-engine

The signing engine that powers Sealflow — The Perfect Event's in-house e-signature platform.

This repository is a **hard fork of [Documenso](https://github.com/documenso/documenso) v2.14.0** ([upstream SHA `037170f`](https://github.com/documenso/documenso/commit/037170f6253d8b2bdeaf2eb0a08d04f152a41a58)). See [`FORK_FROM`](FORK_FROM) for the machine-readable fork metadata. See the original upstream README at [`UPSTREAM_README.md`](UPSTREAM_README.md) for credits, history, and the original product story.

**License:** AGPL v3 (carried forward from upstream). See [`LICENSE`](LICENSE). Public source disclosure per AGPL §13 is at https://github.com/The-Perfect-Event/sealflow-engine-public — see [`AGPL_DISCLOSURE.md`](AGPL_DISCLOSURE.md).

**Owner:** Hasham Vakani · **Org:** The-Perfect-Event · **Tracking issue:** [sealflow#13](https://github.com/The-Perfect-Event/sealflow/issues/13)

---

## What this repo is

The owned, vendored version of Documenso. We build it ourselves, brand it ourselves, run it ourselves, and patch it ourselves. We do not depend on the `documenso/documenso` Docker image at runtime — we build `ghcr.io/the-perfect-event/sealflow-engine` from this source and deploy that.

## Why we forked

Documenso is open-source today (AGPL v3) but the playbook for VC-backed open-source SaaS is to relicense or paywall over time — see [Terraform → OpenTofu](https://opentofu.org/), [Redis → Valkey](https://valkey.io/), [Elasticsearch → OpenSearch](https://opensearch.org/). Forking at v2.14.0 locks in known-permissive terms permanently. Whatever upstream does to v3.x doesn't affect us.

Trade-off accepted: we own ongoing security patching. We subscribe to upstream security advisories and apply CVE-relevant fixes from them.

## What this repo is NOT

- **Not the sealflow umbrella.** Docs, deploy configs, integration code, parser library, and the broader project live at https://github.com/The-Perfect-Event/sealflow. This is just the engine.
- **Not a place to file user-facing issues.** All Sealflow issues go to the umbrella at https://github.com/The-Perfect-Event/sealflow/issues — this repo's issue tracker is for engine-internal, code-level work that doesn't fit the umbrella project board.
- **Not the public-facing source.** That's the disclosure mirror at https://github.com/The-Perfect-Event/sealflow-engine-public.

## Hard rules

Before editing anything in this repo, read:

1. **[`FROZEN.md`](FROZEN.md)** — Code paths under hard or soft freeze. Cryptographic correctness and legal evidence of signed documents. Do not modify without escalation.
2. **[`AGPL_DISCLOSURE.md`](AGPL_DISCLOSURE.md)** — How AGPL §13 disclosure works for us. Affects any release-tagging workflow.
3. **[sealflow#13 guardrails](https://github.com/The-Perfect-Event/sealflow/issues/13)** — The four guardrails for this fork. Read once when you start working on the engine.

## Layout overview

The layout is upstream Documenso's — see `apps/`, `packages/`, `prisma/`, etc. As we diverge (sealflow#14 — invite-only, sealflow#15 — custom org model, sealflow#16 — code-layer brand), the divergences will be documented in their respective PRs and reflected in the relevant subfolder READMEs.

## Build + deploy

Source-build CI lands in Phase 1c of sealflow#13. Until then, builds are local-only via `docker build`.

Production deployment is via `sealflow/deploy/Dockerfile.chromium` in the umbrella repo, which switches from upstream `FROM documenso/documenso` to `FROM ghcr.io/the-perfect-event/sealflow-engine:vX.Y.Z` in Phase 3 of sealflow#13.

## Upstream tracking

We do **not** continuously merge from upstream. We subscribe to upstream's [security advisories](https://github.com/documenso/documenso/security/advisories) and cherry-pick CVE-relevant fixes manually. Feature work upstream is informational only.

The fork point (`FORK_FROM`) is the canonical reference for "what version of upstream are we based on." If a CVE references a file under [`FROZEN.md`](FROZEN.md), the patch lands here as a `[FROZEN]`-tagged commit after the review process described in that doc.

## Credits

This codebase started as the work of the Documenso team. The original product was their idea, their architecture, their UX. Our fork carries their license forward, preserves their attribution in the source headers, and credits them prominently here.
