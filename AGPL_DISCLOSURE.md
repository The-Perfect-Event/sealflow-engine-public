# AGPL §13 source disclosure

`sealflow-engine` is a fork of [Documenso](https://github.com/documenso/documenso) (originally licensed AGPL v3, fork point recorded in [`FORK_FROM`](FORK_FROM)). Our fork continues under **AGPL v3** — see [`LICENSE`](LICENSE).

AGPL v3 §13 requires that anyone who interacts with the program over a network (signers loading the signing page, integrations calling our v2 API, etc.) must be able to obtain the **corresponding source code** of the running version.

## How we comply

This source repository (`The-Perfect-Event/sealflow-engine`) is **private** for operational reasons — it's our internal engine, not a hosted product. AGPL §13 disclosure is satisfied by a separate **public mirror**:

> **Public disclosure mirror:** https://github.com/The-Perfect-Event/sealflow-engine-public

The public mirror is updated by automation on every release tag. The signing-domain footer and the [Documenso, Inc. attribution](LICENSE) link to the mirror so signers can locate the source corresponding to the running build.

## What the mirror contains

The mirror is a **one-way push from `main`** at each release tag of the private repo. It contains:

- The full source tree exactly as built into the running release
- The `LICENSE` (AGPL v3)
- The `FORK_FROM` metadata
- A `MIRROR_README.md` pointing back to this repo for issue tracking

It does **not** contain:

- Operational secrets or configuration (none of these are committed to either repo)
- Internal R&D notes / decision documents (those live in private repos)

## Workflow at release time

Phase 1f of [sealflow#13](https://github.com/The-Perfect-Event/sealflow/issues/13) sets up the automation. The intended pattern:

1. Tag a release on this private repo (`git tag vX.Y.Z`, push tag)
2. CI workflow detects the tag, performs a `git push --mirror` (or equivalent filtered push) to the public mirror
3. The public mirror's `main` is fast-forwarded to the new tag's tree

Until that automation lands, the mirror can be updated manually by:

```bash
# From a fresh clone of sealflow-engine, on the release tag:
git remote add public https://github.com/The-Perfect-Event/sealflow-engine-public.git
git push public main:main --force-with-lease
```

## Modifications visible to signers

Any code change in this repo that goes into a release is automatically disclosed via the mirror at release time. We don't need a separate change-by-change log — the git history on the public mirror is the disclosure log.

## Trademark + attribution

Per AGPL v3 §5(c), copyright notices in the original Documenso source files are preserved. The legal entity "Documenso, Inc." is referenced in the LICENSE file and in any user-facing license-disclosure surfaces (e.g. an "About" page footnote). Visual branding (logos, product name, colors) is replaced with Sealflow's — branding is not a trademark of the original code.

## Questions / non-compliance reports

If you believe this fork is not compliant with AGPL §13, please open an
issue on the public mirror:

https://github.com/The-Perfect-Event/sealflow-engine-public/issues

Compliance issues will be prioritized.
