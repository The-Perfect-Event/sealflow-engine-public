# Workflows

Upstream Documenso workflows were removed at fork time (sealflow#13 Phase 1a) — they were tied to upstream's CI infrastructure (Crowdin, npm publish, deploy targets, issue labelers) and do not apply to our owned fork.

## Active workflows

| File | Trigger | What it does |
|---|---|---|
| [`build-and-push.yml`](build-and-push.yml) | `push` of `v*.*.*` tag, or manual `workflow_dispatch` | Builds the engine Docker image from `docker/Dockerfile` and pushes to `ghcr.io/the-perfect-event/sealflow-engine`. Tag-driven by design — no per-commit builds to conserve Actions minutes. |

## How to publish a release image

```bash
# From local clone of sealflow-engine on main with everything you want included:
git tag v1.0.0
git push origin v1.0.0
# Watch: gh run watch --repo The-Perfect-Event/sealflow-engine
```

## How to do an ad-hoc build (no tag)

```bash
gh workflow run build-and-push.yml \
  --repo The-Perfect-Event/sealflow-engine \
  -f image_tag=dev-2026-06-29 \
  -f push=true
```

Or `push=false` for a build-only sanity check (no GHCR push).

## Coming later

- Phase 1f: `disclosure-mirror.yml` — push tag tree to `sealflow-engine-public` for AGPL §13 disclosure.
- Possibly a CodeQL re-introduction once we're stable on our fork — currently deferred.
