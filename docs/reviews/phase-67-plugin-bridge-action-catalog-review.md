# Phase 67 Production Code Quality Review

> Date: 2026-06-17
> Branch: `codex/plugin-service-bridge-phase66`
> Scope: read-only action-catalog bridge route, targeted tests, and live docs

## Scope

- Base: current working tree on `codex/plugin-service-bridge-phase66`
- Scope mode: Phase 67 diff
- Risk level: medium because the change touches local bridge response shape and shared plugin runtime boundary, but remains read-only and narrow
- Assumption: bridge scope remains intentionally small and action import, action config writes, filesystem access, setup bridge access, service auto-start, and hard cleanup guarantees remain out of scope

## Findings

No blocking production findings remain after review.

## Review Optimizations Applied

- `src/main/services/plugin-service.js`: action catalog is derived from `PetService.getSnapshot()` instead of introducing another action-state store.
- `src/main/services/plugin-service.js`: the `GET /pet/actions` response is intentionally bounded to safe summary fields and excludes sprite URLs, paths, preview fields, atlas data, and writable config locations.
- `tests/services/plugin-service.test.js`: command/service bridge coverage now proves action-catalog reads work, wrong tokens are rejected, and expired bridge runs lose access.
- Live docs were updated so public and author-facing materials describe action discovery as a read-only bridge convenience rather than a broader asset-management API.

## Architecture Assessment

The behavior remains in the right layer. `PluginService` already owns the loopback bridge and runtime authorization, while `PetService` already owns pet-facing state snapshots. Reusing those boundaries avoids duplicating action state or inventing a parallel plugin API surface.

## Robustness Assessment

The new route inherits the same runtime scoping and token checks as existing bridge routes, so expired and unauthorized requests fail consistently. The main intentional limitation is that `currentActionId` is still derived from existing snapshot state rather than a richer runtime action-tracking channel, which keeps the phase narrow and avoids speculative new state.

## Test Assessment

Strong coverage:

- explicit declaration-only command runs can read the bounded action catalog;
- explicit service bridge runs can read the same bounded action catalog;
- invalid token and expired bridge requests are rejected;
- excluded fields such as sprite URLs are asserted absent from the response;
- existing command/service bridge mutation and rejection tests remain green.

The next useful future test would be a richer runtime scenario where current action tracking diverges from the default action, but current coverage is sufficient for this read-only discovery phase.

## Verification

Targeted verification completed during implementation:

```bash
node --test tests/services/plugin-service.test.js --test-name-pattern "declaration-only command bridge exposes bounded action catalog|plugin service bridge exposes bounded action catalog|plugin service bridge rejects invalid tokens and missing permissions|declaration-only command bridge rejects missing permissions, invalid token, and expired runs"
# pass
```

Planned full verification before merge:

```bash
npm run check:syntax
# pass

npm test
# pass

npm run test:control-center
# pass

git diff --check
# pass

node -e "JSON.parse(require('node:fs').readFileSync('docs/project-context.json','utf8')); console.log('project-context ok')"
# project-context ok
```

## Final Recommendation

Safe to merge.
