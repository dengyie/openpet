# Phase 41 AI Behavior Decision Viewer Review

## Scope

- Base: `HEAD`
- Scope mode: working tree
- Risk level: high, because the change touches IPC, Control Center UI state, diagnostics export, and privacy-sensitive AI behavior data.
- Reviewed files:
  - `src/main/services/behavior-orchestrator-service.js`
  - `src/main/ipc.js`
  - `control-center-preload.js`
  - `src/control-center/src/hooks/useAiPane.js`
  - `src/control-center/src/panes/AiPane.jsx`
  - `src/control-center/src/api/control-center-api.js`
  - `src/shared/ipc-channels.js`
  - `src/shared/ipc-channels.ts`
  - `src/shared/openpet-contracts.ts`
  - `tests/services/behavior-orchestrator-service.test.js`
  - `tests/control-center/control-center-smoke.spec.js`

## Findings

No remaining P0/P1/P2 production issues after remediation.

### Fixed During Review: Decisions did not refresh after chat-triggered behavior

- Location: `src/control-center/src/hooks/useAiPane.js`
- Problem: after sending an AI chat message, the Control Center updated the transcript and action status but did not reload `ai.behavior.decisions`.
- Impact: a real behavior decision created by `AI_CHAT` would not appear in the Decisions viewer until the user reloaded the pane, weakening the main Phase 41 product goal.
- Fix: `onSendChat()` now reloads `api.getAiBehavior()` after successful chat and updates both `behavior` and `config.behavior`.
- Test: the Control Center smoke test now clears decisions, sends a chat message through the demo API, and asserts that a new `matched rule demo-chat` decision appears without page reload.

## Architecture Assessment

The behavior decision logic remains in `BehaviorOrchestratorService`, which is the right layer. IPC and preload only expose narrow commands for replay, diagnostics export, and clearing history. The renderer owns presentation and download behavior, but does not receive API keys or secret values.

The replay design intentionally re-runs dry-run against the current behavior config. That makes it a rule regression/debugging tool rather than an exact historical simulator. This is acceptable for Phase 41 and is documented as residual behavior.

## Security And Privacy Assessment

- API keys remain in the main-process secret store.
- Diagnostics export removes `replay` input and adds `replayRedacted: true`.
- Service tests prove exported diagnostics do not contain the sensitive reply text used for replay.
- Local settings still keep truncated replay input for local replay. This is a deliberate local-only tradeoff; exported diagnostics remain redacted.

## Test Assessment

Strongest coverage:

- Service test covers stored replay input, replay by id, redacted diagnostics export, and clear history.
- IPC channel test covers new channel constants through the shared contract.
- Playwright smoke covers decision rendering, replay, export, clear, and post-chat decision refresh.

Most important remaining future scenario:

- If behavior rules become a structured editor, add UI tests for editing a rule and replaying an existing decision against the edited unsaved/saved rule set.

## Verification

```bash
node --test tests/services/behavior-orchestrator-service.test.js tests/shared/ipc-channels.test.js
npm test
npm run test:control-center
npm run typecheck
npm run check:syntax
npm run pack
git diff --check
```

All commands passed on 2026-06-16.

`production-code-quality-review` helper context was collected with:

```bash
python3 /Users/mango/.agents/skills/production-code-quality-review/scripts/collect-review-context.py --repo /Users/mango/project/codex/OpenPet
python3 /Users/mango/.agents/skills/production-code-quality-review/scripts/diff-line-map.py --repo /Users/mango/project/codex/OpenPet
python3 /Users/mango/.agents/skills/production-code-quality-review/scripts/detect-stack.py --repo /Users/mango/project/codex/OpenPet
python3 /Users/mango/.agents/skills/production-code-quality-review/scripts/run-safe-checks.py --repo /Users/mango/project/codex/OpenPet
```

`run-safe-checks.py` returned suggested project commands rather than executing them; the relevant commands were run manually.

## Final Recommendation

Safe to merge.
