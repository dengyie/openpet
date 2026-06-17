# Phase 65: Plugin Service Hard Cleanup

> Date: 2026-06-17
> Branch: `codex/plugin-service-hard-cleanup-phase65`
> Status: implemented locally

## Goal

Make declared plugin service stop semantics more honest so OpenPet does not report a service as fully stopped until the child process has actually emitted `exit`.

## What Changed

- `PluginService.stopService()` now keeps service runtime state at `stopping` after a stop request until the child `exit` event confirms shutdown.
- The same exit-confirmed contract now applies to:
  - explicit `stopService()` calls,
  - plugin disable cleanup,
  - app shutdown cleanup through `stopAllServices()`.
- Service stop logging is now split into distinct phases:
  - `Service stop requested`
  - `Service stopped`
- Stop-path failures now remain explicit through `failed` status and `Service stop failed` logging.
- Stop-confirmed exits now become `stopped`; non-zero exits after a stop request still become `failed`.

## Boundaries Preserved

- This phase only changes `entries.services` lifecycle semantics.
- `entries.setup` and `entries.commands` execution behavior is unchanged.
- Service shutdown still uses best-effort process-group `SIGTERM` first and direct child `SIGTERM` fallback second.
- OpenPet still does not claim full descendant-process termination on every platform.
- No `SIGKILL` escalation, background health polling, service auto-start, or broader bridge/runtime surface was added here.

## Tests

Targeted verification during implementation:

```bash
node --test tests/services/plugin-service.test.js --test-name-pattern "plugin service starts and stops enabled declaration service entries|plugin service stops running services when a plugin is disabled|plugin service keeps services in stopping state until the child exits|plugin service stops running services during app shutdown cleanup after exit confirmation|plugin service stops service process groups before falling back to child kill|plugin service falls back to child kill when process group stop fails|plugin service marks non-zero service exits as failed"
# pass
```

Full verification before commit:

```bash
npm run check:syntax
npm test
npm run test:control-center
git diff --check
node -e "JSON.parse(require('node:fs').readFileSync('docs/project-context.json','utf8')); console.log('project-context ok')"
```

## Acceptance

- Explicit service stop returns and renders `stopping` until child exit confirmation.
- Disable cleanup and app shutdown cleanup use the same exit-confirmed stop contract.
- Logs distinguish stop request from stop completion.
- Process-group cleanup wording stays honest as best-effort cleanup rather than hard process-tree guarantees.
- Docs reflect that Phase 65 hardens services only; setup and command cleanup semantics are unchanged in this phase.
