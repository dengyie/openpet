# Phase 42 Production Code Quality Review

## Scope

- Base: `HEAD`
- Scope mode: working tree
- Risk level: high, because the change touches packaged runtime evidence and release-readiness reporting.
- Reviewed files: packaged runtime runner, Electron window startup path, action import lazy loading, smoke report validators, regression tests, and current-state docs.

## Findings

No remaining P0/P1/P2 findings after the review fixes below.

## Fixed During Review

### P1: Packaged runtime smoke could hang before main startup

- Location: `src/main/services/action-import-service.js`
- Problem: startup-only service construction loaded `sprite-generator` at module load time, which also loads `sharp`. In the packaged app smoke path this could block before the Electron main process produced evidence.
- Impact: real packaged runtime evidence could time out even though the app would otherwise be launchable.
- Fix: moved `sprite-generator` loading behind `loadSpriteGenerator()` so it is required only for import, regenerate, or frame-inspection paths.
- Regression coverage: `tests/services/action-import-service-lazy-load.test.js`.
- Confidence: High.

### P2: Ready picker evidence could not make runtime readiness fully pass

- Location: `scripts/validate-desktop-picker-smoke-report.js`, `scripts/run-packaged-runtime-smoke.js`
- Problem: the packaged runtime report had an `invalid-package-feedback` check, but a linked ready desktop picker report did not require or map that evidence.
- Impact: even complete native picker evidence would leave runtime readiness blocked, creating a false negative in the release gate.
- Fix: added `invalid-package-feedback` to the desktop picker required checks and mapped it into packaged runtime evidence when `--desktop-picker-report` is provided.
- Regression coverage: `tests/release/desktop-picker-smoke-report.test.js` and `tests/release/packaged-runtime-smoke-capture.test.js`.
- Confidence: High.

## Architecture Assessment

The behavior remains in the right layers. `main.js` only wires lifecycle order and invokes the smoke runner after `did-finish-load`; runtime evidence capture lives in `src/main/packaged-runtime-smoke-runner.js`; report merging and CLI orchestration live in `scripts/run-packaged-runtime-smoke.js`. `PetService` remains the state source for say/action operations.

## Robustness Assessment

The runner writes evidence in `finally`, captures failure notes when runtime inspection throws, and quits the packaged app after evidence is produced. `--allow-pending-picker` keeps picker-linked checks pending or blocked instead of claiming readiness. Linked desktop picker reports are validated before being merged.

## Test Assessment

Strongest coverage added in this phase:

- Window loading can be deferred so lifecycle handlers are registered before `index.html` loads.
- Pet window loading uses an absolute project-root path, including non-repo cwd launches.
- Packaged runtime report merging fails transparent-background and action-playback checks when evidence is insufficient.
- Linked desktop picker reports can make picker and invalid-package runtime checks pass only when the picker report is ready.
- Action import service does not load `sprite-generator` on startup-only paths.

No material missing test remains for the Phase 42 scope. Full native picker evidence and signed release evidence are intentionally deferred to Phase 43+.

## Verification

```bash
node --test tests/release/desktop-picker-smoke-report.test.js tests/release/desktop-picker-smoke-runbook-update.test.js tests/release/packaged-runtime-smoke-capture.test.js tests/release/release-evidence-archive-manifest.test.js tests/release/packaged-runtime-smoke-runbook-update.test.js
npm test
npm run test:control-center
npm run typecheck
npm run check:syntax
npm run pack
npm run run-packaged-runtime-smoke -- --app release/mac-arm64/OpenPet.app --output-dir docs/release-evidence/packaged-runtime --allow-pending-picker
git diff --check
```

Latest archived evidence:

`docs/release-evidence/packaged-runtime/2026-06-16T14-52-13-074Z-darwin-arm64/`

The archived report passes 11/14 checks with `--allow-pending-picker`; the remaining picker-linked checks are expected pending or blocked until a ready desktop picker smoke report is linked.

## Final Recommendation

Safe to merge with follow-ups. Minimum follow-ups are Phase 43 signed release evidence closure and native desktop picker evidence capture.
