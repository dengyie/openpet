# Phase 67: Plugin Bridge Action Catalog

> Date: 2026-06-17
> Branch: `codex/plugin-service-bridge-phase66`
> Status: implemented locally

## Goal

Let explicit declaration-only plugin commands and services discover the current pet action catalog through the existing loopback bridge.

## What Changed

- `PluginService` now exposes a read-only `GET /pet/actions` bridge route for explicit command and service runs.
- The route returns a bounded action summary derived from `PetService.getSnapshot()`:
  - `selectedPetId`
  - `defaultAction`
  - `clickAction`
  - `currentActionId`
  - `items[]` with `id`, `label`, `kind`, `loop`, `frameCount`, and `frameMs`
- The route intentionally excludes sprite URLs, preview URLs, paths, atlas data, frame dimensions, and writable config locations.
- Action catalog reads are logged with the same per-entry bridge logging pattern used by the existing bridge routes.
- Invalid token and expired bridge requests remain rejected.

## Boundaries Preserved

- This phase adds a read-only discovery route only.
- It does not add action config editing, sprite import, sprite generation, or filesystem write access.
- Bridge access remains loopback-only, bearer-token gated, per-entry-run scoped, and permission-checked where applicable.
- `PetService` remains the single source of truth for pet-facing state.
- Command, setup, and service process boundaries remain unchanged.
- Hard process-tree cleanup guarantees remain future runtime work.

## Verification Status

Targeted verification completed during implementation:

```bash
node --test tests/services/plugin-service.test.js --test-name-pattern "declaration-only command bridge exposes bounded action catalog|plugin service bridge exposes bounded action catalog|plugin service bridge rejects invalid tokens and missing permissions|declaration-only command bridge rejects missing permissions, invalid token, and expired runs"
# pass
```

Planned full verification before commit:

```bash
npm run check:syntax
npm test
npm run test:control-center
git diff --check
node -e "JSON.parse(require('node:fs').readFileSync('docs/project-context.json','utf8')); console.log('project-context ok')"
```

## Acceptance

- Explicit bridge runs can read the bounded action catalog.
- The response omits file/path/sprite internals.
- Invalid token and expired bridge requests are rejected.
- Docs describe the new read-only action-discovery capability without overclaiming broader plugin power.
