# Phase 72: Plugin Service Process-Tree Hardening

> Date: 2026-06-17
> Scope: harden declared plugin service cleanup so OpenPet no longer reports a clean stop when the root process exits but known descendants are still running.

## Goal

Phase 68 made service stop state honest, and Phase 69 made it bounded with one conservative host-side force-stop attempt.

Phase 72 tightens the remaining gap in service cleanup truth:

- root-child exit is no longer treated as sufficient proof of a clean stop;
- OpenPet now performs a host-owned descendant verification step for declared service entries;
- positively observed leftover descendants fail closed on the existing `failed` runtime contract;
- unsupported verification paths keep the current bounded result, but log that stronger verification was unavailable.

This phase stays service-only. Setup and declaration-only command cleanup semantics do not change.

## Scope

In scope:

- service-only descendant verification after requested stop completion;
- fail-closed service runtime classification when known descendants survive;
- deterministic service-layer tests for clean verification, leftover descendants, and unavailable verification;
- live-doc updates for the stronger service-only cleanup truth.

Out of scope:

- setup descendant cleanup hardening;
- declaration-only command descendant cleanup hardening;
- new renderer-only runtime statuses;
- plugin manifest cleanup hints;
- bridge expansion, auto-start, or richer health policy changes;
- universal sandbox or guaranteed total process policing claims.

## Implementation

Updated files:

- `src/main/services/plugin-service.js`
- `tests/services/plugin-service.test.js`

Behavior changes:

1. `src/main/services/service-process-tree.js` now provides a host-owned `listServiceDescendantPids(pid)` helper that reads POSIX or Windows process tables and recursively gathers visible descendants.

2. `createPluginService(...)` now defaults `listServiceDescendantPids(pid)` to that host helper while still allowing test injection.

3. `verifyServiceDescendantsStopped(pluginId, serviceId, runtime)` now:
   - inspects visible descendants for the service root pid;
   - returns clean when no descendants remain;
   - marks the runtime fail-closed when visible descendants survive;
   - preserves the current bounded result but reports verification-unavailable when the host cannot inspect descendants.

4. Requested service-stop exit handling now:
   - keeps the existing Phase 68 stop-intent and Phase 69 force-stop behavior;
   - runs descendant verification before final `stopped` classification for non-force-stop exits;
   - reclassifies the runtime to `failed` when leftover descendants are positively observed;
   - logs one of:
     - `Service stopped`
     - `Service descendants still running after stop`
     - `Service stop verification unavailable`
     - `Service exited after force stop`

5. Disable cleanup and app-shutdown cleanup continue to use the same service stop path, so the stronger cleanup truth applies consistently outside explicit Control Center stop actions too.

## Decision Record

### Decision 1: keep Phase 72 service-only

- Problem: setup and declaration-only command cleanup still remain weaker than services.
- Choice: harden only declared `entries.services` in this phase.
- Reason: long-running services are the path where orphaned descendants most directly undermine operator trust. Expanding setup and command cleanup at the same time would widen scope across multiple runtime shapes.
- Risk: setup and declaration-only commands still remain direct-child best effort. This is acceptable because the limitation is explicit and unchanged.

### Decision 2: reuse `failed` instead of widening runtime contracts

- Problem: leftover descendants after requested stop could justify a new renderer-only state.
- Choice: keep the existing runtime surface and reuse `failed`.
- Reason: the important truth is that the service did not stop cleanly. Reusing `failed` preserves current shared contracts and keeps the surface fail-closed.
- Risk: operators do not get a dedicated `orphaned` status. Logs carry the more specific reason, which is enough for this phase.

## Validation

Targeted verification during implementation:

```bash
node --test tests/services/service-process-tree.test.js tests/services/plugin-service.test.js
```

Full verification before commit:

```bash
npm run check:syntax
npm test
npm run test:control-center
npm run typecheck
git diff --check
node -e "JSON.parse(require('node:fs').readFileSync('docs/project-context.json','utf8')); console.log('project-context ok')"
```

## Outcome

After Phase 72:

- declared service entries still stop through the existing bounded host cleanup path;
- a clean `stopped` result now means root exit was confirmed and no visible descendants were positively observed;
- surviving known descendants now fail closed on the existing `failed` contract instead of being misreported as clean stops;
- setup and declaration-only command cleanup remain on their previous direct-child best-effort contract;
- OpenPet still does not claim universal sandboxing or guaranteed total process policing.
