# Plugin Bridge Action Catalog Phase 67 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give explicit declaration-only plugin commands and services a narrow read-only bridge route for discovering the current pet action catalog.

**Architecture:** Keep action-catalog discovery inside `PluginService`, because it already owns bridge routing, token validation, per-entry-run scoping, logs, and cleanup. Derive the returned action catalog from `PetService.getSnapshot()` so pet/action state still has one source of truth and the bridge does not reach into files or renderer-only state.

**Tech Stack:** Electron main process, Node HTTP loopback bridge, Node native test runner, existing pet/action services, existing docs/phase/review workflow.

---

## File Map

- Modify: `src/main/services/plugin-service.js`
  Purpose: add the bounded `GET /pet/actions` bridge route and action-catalog response shaping.
- Modify: `tests/services/plugin-service.test.js`
  Purpose: add TDD coverage for command/service action-catalog reads, bounded response shape, and rejection paths.
- Modify: `README.md`
  Purpose: expose the new read-only bridge capability in the public English summary.
- Modify: `README.zh-CN.md`
  Purpose: expose the new read-only bridge capability in the public Chinese summary.
- Modify: `docs/plugin-development.md`
  Purpose: teach third-party authors how to discover current actions safely before choosing one.
- Modify: `docs/plugin-ecosystem-rules.md`
  Purpose: update ecosystem capability and safety rules for read-only action-catalog discovery.
- Modify: `docs/HANDOFF.md`
  Purpose: refresh current plugin runtime boundary and next-step guidance.
- Modify: `docs/development-summary.md`
  Purpose: update the short engineering summary with action-catalog bridge support.
- Modify: `docs/project-status-review.md`
  Purpose: update the current project snapshot.
- Modify: `docs/productization-v1.1-todo-design.md`
  Purpose: record Phase 67 in the phase sequence.
- Modify: `docs/project-context.json`
  Purpose: update machine-readable current facts.
- Create: `docs/phases/phase-67-plugin-bridge-action-catalog.md`
  Purpose: record delivered scope, boundaries, and verification.
- Create: `docs/reviews/phase-67-plugin-bridge-action-catalog-review.md`
  Purpose: record production review findings and final recommendation.

## Task 1: Add failing action-catalog bridge tests

**Files:**
- Modify: `tests/services/plugin-service.test.js`

- [ ] **Step 1: Add a command bridge action-catalog test**

Add a test near the existing declaration-only command bridge tests that:

- runs declaration command `announce`;
- captures `OPENPET_BRIDGE_URL` and `OPENPET_BRIDGE_TOKEN`;
- requests `GET /pet/actions`;
- asserts a bounded response shape with:
  - `selectedPetId`
  - `defaultAction`
  - `clickAction`
  - `currentActionId`
  - `items[]` containing `id`, `label`, `kind`, `loop`, `frameCount`, `frameMs`;
- asserts excluded fields such as `sprite` are absent.

Use `createBridgeAwarePetService()` and `requestBridge()` so the test stays close to current bridge coverage.

- [ ] **Step 2: Run the command action-catalog test to verify it fails**

Run:

```bash
node --test tests/services/plugin-service.test.js --test-name-pattern "declaration-only command bridge exposes bounded action catalog"
```

Expected: FAIL because `GET /pet/actions` does not exist yet.

- [ ] **Step 3: Add a service bridge action-catalog test**

Add a second test near the service bridge tests that:

- starts declaration service `companion`;
- requests `GET /pet/actions`;
- asserts the same bounded response shape;
- emits child exit;
- asserts the route later returns `401`.

- [ ] **Step 4: Add invalid-token coverage for the new route**

Add a focused assertion in existing bridge rejection coverage, or add a new small test, proving `GET /pet/actions` returns `401` with a wrong bearer token.

## Task 2: Implement bounded action-catalog bridge support

**Files:**
- Modify: `src/main/services/plugin-service.js`

- [ ] **Step 1: Add a helper that shapes the action catalog**

Add a helper near `createPluginBridgeContext()` that reads `petService.getSnapshot?.() || {}` and returns a bounded object:

```js
const createPluginBridgeActionCatalog = () => {
  const snapshot = petService.getSnapshot?.() || {}
  const settings = snapshot.settings || {}
  const actions = snapshot.actions || {}
  const items = Array.isArray(actions.actions)
    ? actions.actions.map((action) => ({
        id: String(action.id || ''),
        label: String(action.label || action.id || ''),
        kind: String(action.kind || 'custom'),
        loop: Boolean(action.loop),
        frameCount: Number.isFinite(Number(action.frameCount)) ? Number(action.frameCount) : 0,
        frameMs: Number.isFinite(Number(action.frameMs)) ? Number(action.frameMs) : 0
      }))
    : []
  return {
    selectedPetId: String(settings.petPacks?.activePackId || 'legacy-cat'),
    defaultAction: String(actions.defaultAction || ''),
    clickAction: String(actions.clickAction || ''),
    currentActionId: String(actions.defaultAction || ''),
    items
  }
}
```

Do not include sprite URLs, paths, preview fields, atlas data, or writable config locations.

- [ ] **Step 2: Add a bridge handler for action-catalog reads**

Extend `createPluginBridgeHandlers(plugin, entryId)` with:

```js
petActions: async () => {
  appendLog({ pluginId: plugin.manifest.id, commandId: entryId, level: 'info', message: 'Bridge pet.actions requested' })
  return { ok: true, actions: createPluginBridgeActionCatalog() }
}
```

This route must stay read-only and must not require extra manifest permissions.

- [ ] **Step 3: Extend route matching and dispatch**

Update the bridge path matcher from:

```js
/^\/plugins\/bridge\/([^/]+)\/([^/]+)\/([^/]+)(\/context|\/pet\/say|\/pet\/action|\/pet\/event)$/
```

to include:

```js
\/pet\/actions
```

Then dispatch:

```js
if (route === '/pet/actions') {
  sendJson(response, 200, await runtime.handlers.petActions())
  return
}
```

Keep `GET /pet/actions` on the no-body path with no JSON content-type requirement.

- [ ] **Step 4: Keep error and auth behavior unchanged**

Do not special-case token handling. Invalid token, expired runtime, and missing runtime should continue to return the same existing `401` behavior.

## Task 3: Verify targeted behavior before doc updates

**Files:**
- No file changes required in this task.

- [ ] **Step 1: Run targeted bridge tests**

Run:

```bash
node --test tests/services/plugin-service.test.js --test-name-pattern "declaration-only command bridge exposes bounded action catalog|plugin service bridge exposes bounded action catalog|declaration-only command bridge rejects missing permissions, invalid token, and expired runs|plugin service bridge rejects invalid tokens and missing permissions"
```

Expected: PASS.

- [ ] **Step 2: Run syntax checks on touched files**

Run:

```bash
node --check src/main/services/plugin-service.js
node --check tests/services/plugin-service.test.js
```

Expected: both PASS.

## Task 4: Update docs and phase records

**Files:**
- Modify all doc files from the file map.

- [ ] **Step 1: Document author-facing action discovery**

Update author docs to say explicit command and service bridge runs can call `GET /pet/actions` to discover safe action summaries before choosing an action.

- [ ] **Step 2: Keep safety wording honest**

State that action discovery is:

- read-only;
- loopback-only;
- token-gated;
- per-entry-run scoped;
- intentionally excludes sprite paths, writable config, and asset import powers.

- [ ] **Step 3: Add Phase 67 phase and review docs**

Create:

- `docs/phases/phase-67-plugin-bridge-action-catalog.md`
- `docs/reviews/phase-67-plugin-bridge-action-catalog-review.md`

They should record:

- delivered route and bounded payload shape;
- preserved boundaries;
- targeted and full verification;
- production review findings and recommendation.

## Task 5: Review, verify, commit, and push

**Files:**
- No new implementation files beyond the listed scope.

- [ ] **Step 1: Run production review**

Run:

```bash
python3 /Users/mango/.agents/skills/production-code-quality-review/scripts/collect-review-context.py --repo /Users/mango/.config/superpowers/worktrees/OpenPet/codex-plugin-service-hard-cleanup-phase65
```

Review correctness, architecture, reliability, security, and tests for:

- bounded action payload shape;
- route auth/expiry behavior;
- accidental information leakage such as sprite paths or file URLs;
- command and service bridge regression risk.

- [ ] **Step 2: Apply any review-driven optimizations**

If review finds real issues, fix them before final verification. Keep fixes scoped to Phase 67.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run check:syntax
npm test
npm run test:control-center
git diff --check
node -e "JSON.parse(require('node:fs').readFileSync('docs/project-context.json','utf8')); console.log('project-context ok')"
```

- [ ] **Step 4: Commit and push**

```bash
git add src/main/services/plugin-service.js tests/services/plugin-service.test.js docs README.md README.zh-CN.md
git commit -m "feat: add plugin bridge action catalog"
git push -u origin codex/plugin-service-bridge-phase66
```

## Self-Review

- Spec coverage: read-only `GET /pet/actions`, bounded payload fields, command/service bridge support, auth/expiry behavior, docs, review, and verification are covered.
- Placeholder scan: no placeholder-only tasks remain; implementation steps include concrete file paths and commands.
- Type consistency: the response uses `actions.selectedPetId`, `actions.defaultAction`, `actions.clickAction`, `actions.currentActionId`, and `actions.items[]` consistently across tests, implementation, and docs.
