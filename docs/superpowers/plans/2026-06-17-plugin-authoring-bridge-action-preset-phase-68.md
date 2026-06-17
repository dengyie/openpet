# Plugin Authoring Bridge Action Preset Phase 68 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a narrow `POST /pet/actions/preset` plugin bridge route so explicit declaration-only command and service runs can safely apply existing default/click action presets.

**Architecture:** Keep bridge routing, auth, logging, and run scoping inside `PluginService`, but route preset writes through the existing `actionImportService.updateActionConfig()` host save path rather than direct file edits. Reuse the bounded Phase 67 action-catalog response shape so successful writes return the same safe summary without exposing sprite or filesystem internals.

**Tech Stack:** Electron main process, Node HTTP loopback bridge, `actionImportService`, Node native test runner, existing plugin phase/review/doc workflow.

---

## File Map

- Modify: `src/main/services/plugin-service.js`
  Purpose: add `POST /pet/actions/preset`, validate payloads, delegate writes through injected host action config service, log updates, and return the bounded catalog shape.
- Modify: `main.js`
  Purpose: inject `actionImportService` into `createPluginService(...)`.
- Modify: `tests/services/plugin-service.test.js`
  Purpose: add TDD coverage for command/service preset writes, partial updates, invalid action rejection, invalid token rejection, and post-write readback.
- Modify: `README.md`
  Purpose: mention that explicit bridge runs can apply read-only-discovered action presets.
- Modify: `README.zh-CN.md`
  Purpose: mention that explicit bridge runs can apply safe action preset changes.
- Modify: `docs/plugin-development.md`
  Purpose: teach authors how to use `POST /pet/actions/preset` and what it cannot do.
- Modify: `docs/plugin-ecosystem-rules.md`
  Purpose: update ecosystem rules to include bounded action preset writes and preserve non-filesystem language.
- Modify: `docs/HANDOFF.md`
  Purpose: refresh the current plugin runtime boundary summary.
- Modify: `docs/development-summary.md`
  Purpose: record the new runtime-backed plugin slice.
- Modify: `docs/project-status-review.md`
  Purpose: keep the current product snapshot aligned with the new bridge capability.
- Modify: `docs/productization-v1.1-todo-design.md`
  Purpose: record Phase 68 and update “next phase” wording.
- Modify: `docs/project-context.json`
  Purpose: update machine-readable project facts.
- Create: `docs/phases/phase-68-plugin-authoring-bridge-action-preset.md`
  Purpose: record delivered route, boundaries, and verification.
- Create: `docs/reviews/phase-68-plugin-authoring-bridge-action-preset-review.md`
  Purpose: capture production review outcome and recommendation.

## Task 1: Add failing command-bridge preset tests

**Files:**
- Modify: `tests/services/plugin-service.test.js`

- [ ] **Step 1: Add a command bridge test for updating both preset fields**

Insert a new test near the existing Phase 67 command bridge action-catalog tests:

```js
test('declaration-only command bridge applies action presets through the host save path', async () => {
  const spawned = []
  const child = createFakeServiceProcess()
  const presetCalls = []
  const root = createDeclarationOnlyPluginDir()
  const pluginPath = path.join(root, 'weather-declaration', 'plugin.json')
  fs.writeFileSync(path.join(pluginPath), JSON.stringify({
    id: 'weather-declaration',
    name: 'Weather Declaration',
    version: '1.0.0',
    permissions: [],
    entries: {
      commands: [{ id: 'announce', title: 'Announce Weather', command: 'node ./commands/announce.js', cwd: '.' }]
    }
  }))
  let snapshot = {
    settings: {
      name: 'Bridge Pet',
      petPacks: { activePackId: 'legacy-cat' }
    },
    actions: {
      defaultAction: 'idle',
      clickAction: 'wave',
      actions: [
        { id: 'idle', label: 'Idle' },
        { id: 'wave', label: 'Wave' }
      ]
    }
  }
  const petService = {
    getSnapshot: () => snapshot
  }
  const actionImportService = {
    updateActionConfig: async (payload) => {
      presetCalls.push(payload)
      snapshot = {
        ...snapshot,
        actions: {
          ...snapshot.actions,
          defaultAction: payload.defaultAction ?? snapshot.actions.defaultAction,
          clickAction: payload.clickAction ?? snapshot.actions.clickAction
        }
      }
      return snapshot.actions
    }
  }
  const service = createPluginService({
    settingsService: createSettingsService({
      plugins: { enabled: { 'weather-declaration': true } }
    }),
    petService,
    actionImportService,
    officialPlugins: [],
    pluginDirs: [root],
    spawnCommandProcess: (file, args, options) => {
      spawned.push({ file, args, options })
      return child
    }
  })

  const commandRun = service.runCommand('weather-declaration', 'announce')
  await waitFor(() => spawned.length === 1)
  const baseUrl = spawned[0].options.env.OPENPET_BRIDGE_URL
  const token = spawned[0].options.env.OPENPET_BRIDGE_TOKEN
  const presetResponse = await requestBridge(`${baseUrl}/pet/actions/preset`, {
    method: 'POST',
    token,
    body: { defaultAction: 'wave', clickAction: 'idle' }
  })
  const readbackResponse = await requestBridge(`${baseUrl}/pet/actions`, { token })

  child.stdout.write('{"ok":true}\n')
  child.emit('exit', 0, null)
  await commandRun

  assert.deepEqual(presetCalls, [{ defaultAction: 'wave', clickAction: 'idle' }])
  assert.equal(presetResponse.status, 200)
  assert.equal(presetResponse.body.actions.defaultAction, 'wave')
  assert.equal(presetResponse.body.actions.clickAction, 'idle')
  assert.equal(readbackResponse.body.actions.defaultAction, 'wave')
  assert.equal(readbackResponse.body.actions.clickAction, 'idle')
  assert.equal('sprite' in presetResponse.body.actions.items[0], false)
})
```

- [ ] **Step 2: Run the new command preset test to verify it fails**

Run:

```bash
node --test tests/services/plugin-service.test.js --test-name-pattern "declaration-only command bridge applies action presets through the host save path"
```

Expected: FAIL because `POST /pet/actions/preset` does not exist yet.

- [ ] **Step 3: Add command-bridge partial-update and invalid-action tests**

Add two more focused tests near the same section:

```js
test('declaration-only command bridge preset update preserves omitted fields', async () => {
  const spawned = []
  const child = createFakeServiceProcess()
  let snapshot = {
    settings: { petPacks: { activePackId: 'legacy-cat' } },
    actions: {
      defaultAction: 'idle',
      clickAction: 'wave',
      actions: [
        { id: 'idle', label: 'Idle' },
        { id: 'wave', label: 'Wave' }
      ]
    }
  }
  const service = createPluginService({
    settingsService: createSettingsService({
      plugins: { enabled: { 'weather-declaration': true } }
    }),
    petService: {
      getSnapshot: () => snapshot
    },
    actionImportService: {
      updateActionConfig: async (payload) => {
        snapshot = {
          ...snapshot,
          actions: {
            ...snapshot.actions,
            defaultAction: payload.defaultAction ?? snapshot.actions.defaultAction,
            clickAction: payload.clickAction ?? snapshot.actions.clickAction
          }
        }
        return snapshot.actions
      }
    },
    officialPlugins: [],
    pluginDirs: [createDeclarationOnlyPluginDir()],
    spawnCommandProcess: (file, args, options) => {
      spawned.push({ file, args, options })
      return child
    }
  })

  const commandRun = service.runCommand('weather-declaration', 'announce')
  await waitFor(() => spawned.length === 1)
  const baseUrl = spawned[0].options.env.OPENPET_BRIDGE_URL
  const token = spawned[0].options.env.OPENPET_BRIDGE_TOKEN
  const presetResponse = await requestBridge(`${baseUrl}/pet/actions/preset`, {
    method: 'POST',
    token,
    body: { defaultAction: 'wave' }
  })

  child.stdout.write('{"ok":true}\n')
  child.emit('exit', 0, null)
  await commandRun

  assert.equal(presetResponse.body.actions.defaultAction, 'wave')
  assert.equal(presetResponse.body.actions.clickAction, 'wave')
})

test('declaration-only command bridge rejects unknown preset action ids without mutation', async () => {
  const spawned = []
  const child = createFakeServiceProcess()
  const presetCalls = []
  const service = createPluginService({
    settingsService: createSettingsService({
      plugins: { enabled: { 'weather-declaration': true } }
    }),
    petService: createBridgeAwarePetService(),
    actionImportService: {
      updateActionConfig: async (payload) => {
        presetCalls.push(payload)
        return payload
      }
    },
    officialPlugins: [],
    pluginDirs: [createDeclarationOnlyPluginDir()],
    spawnCommandProcess: (file, args, options) => {
      spawned.push({ file, args, options })
      return child
    }
  })

  const commandRun = service.runCommand('weather-declaration', 'announce')
  await waitFor(() => spawned.length === 1)
  const baseUrl = spawned[0].options.env.OPENPET_BRIDGE_URL
  const token = spawned[0].options.env.OPENPET_BRIDGE_TOKEN
  const presetResponse = await requestBridge(`${baseUrl}/pet/actions/preset`, {
    method: 'POST',
    token,
    body: { defaultAction: 'storm-idle' }
  })

  child.stdout.write('{"ok":true}\n')
  child.emit('exit', 0, null)
  await commandRun

  assert.equal(presetResponse.status, 400)
  assert.deepEqual(presetCalls, [])
})
```

The second test intentionally proves there is no partial mutation when the action id does not exist.

## Task 2: Add failing service-bridge preset tests

**Files:**
- Modify: `tests/services/plugin-service.test.js`

- [ ] **Step 1: Add a service bridge preset-write test**

Insert a service-focused test near the existing Phase 66 and 67 service bridge tests:

```js
test('plugin service bridge applies action presets and keeps readback in sync', async () => {
  const spawned = []
  const child = createSlowStoppingServiceProcess()
  const presetCalls = []
  let snapshot = {
    settings: { petPacks: { activePackId: 'legacy-cat' } },
    actions: {
      defaultAction: 'idle',
      clickAction: 'wave',
      actions: [
        { id: 'idle', label: 'Idle' },
        { id: 'wave', label: 'Wave' }
      ]
    }
  }
  const service = createPluginService({
    settingsService: createSettingsService({
      plugins: { enabled: { 'weather-declaration': true } }
    }),
    petService: {
      getSnapshot: () => snapshot
    },
    actionImportService: {
      updateActionConfig: async (payload) => {
        presetCalls.push(payload)
        snapshot = {
          ...snapshot,
          actions: {
            ...snapshot.actions,
            defaultAction: payload.defaultAction ?? snapshot.actions.defaultAction,
            clickAction: payload.clickAction ?? snapshot.actions.clickAction
          }
        }
        return snapshot.actions
      }
    },
    officialPlugins: [],
    pluginDirs: [createDeclarationOnlyPluginDir()],
    spawnServiceProcess: (file, args, options) => {
      spawned.push({ file, args, options, child })
      return child
    }
  })

  await service.startService('weather-declaration', 'companion')
  const baseUrl = spawned[0].options.env.OPENPET_BRIDGE_URL
  const token = spawned[0].options.env.OPENPET_BRIDGE_TOKEN
  const presetResponse = await requestBridge(`${baseUrl}/pet/actions/preset`, {
    method: 'POST',
    token,
    body: { clickAction: 'idle' }
  })
  const readbackResponse = await requestBridge(`${baseUrl}/pet/actions`, { token })

  child.emit('exit', 0, null)

  assert.deepEqual(presetCalls, [{ clickAction: 'idle' }])
  assert.equal(presetResponse.status, 200)
  assert.equal(presetResponse.body.actions.defaultAction, 'idle')
  assert.equal(presetResponse.body.actions.clickAction, 'idle')
  assert.equal(readbackResponse.body.actions.clickAction, 'idle')
})
```

- [ ] **Step 2: Add invalid-token and expired-run coverage for the preset route**

Extend service bridge rejection coverage with:

```js
  const wrongPresetToken = await requestBridge(`${baseUrl}/pet/actions/preset`, {
    method: 'POST',
    token: 'wrong-token',
    body: { defaultAction: 'wave' }
  })
```

and assert:

```js
  assert.equal(wrongPresetToken.status, 401)
```

Then add a dedicated expiration assertion:

```js
test('plugin service bridge preset route expires when the service exits', async () => {
  const spawned = []
  const child = createSlowStoppingServiceProcess()
  const service = createPluginService({
    settingsService: createSettingsService({
      plugins: { enabled: { 'weather-declaration': true } }
    }),
    petService: createBridgeAwarePetService(),
    actionImportService: {
      updateActionConfig: async (payload) => payload
    },
    officialPlugins: [],
    pluginDirs: [createDeclarationOnlyPluginDir()],
    spawnServiceProcess: (file, args, options) => {
      spawned.push({ file, args, options, child })
      return child
    }
  })

  await service.startService('weather-declaration', 'companion')
  const baseUrl = spawned[0].options.env.OPENPET_BRIDGE_URL
  const token = spawned[0].options.env.OPENPET_BRIDGE_TOKEN

  child.emit('exit', 0, null)
  const expired = await requestBridge(`${baseUrl}/pet/actions/preset`, {
    method: 'POST',
    token,
    body: { defaultAction: 'wave' }
  })

  assert.equal(expired.status, 401)
})
```

- [ ] **Step 3: Run the new service preset tests to verify they fail**

Run:

```bash
node --test tests/services/plugin-service.test.js --test-name-pattern "plugin service bridge applies action presets and keeps readback in sync|plugin service bridge preset route expires when the service exits|plugin service bridge rejects invalid tokens and missing permissions"
```

Expected: FAIL because `POST /pet/actions/preset` does not exist yet.

## Task 3: Implement the bridge write path

**Files:**
- Modify: `main.js`
- Modify: `src/main/services/plugin-service.js`

- [ ] **Step 1: Inject the existing action config save service into `PluginService`**

Update the `createPluginService(...)` call in `main.js`:

```js
  const pluginService = createPluginService({
    settingsService,
    petService,
    petPackService,
    aiService,
    actionImportService,
    pluginDirs: [pluginDir],
    officialPlugins: [createBasicBehaviorPlugin()],
    openExternal: (url) => shell.openExternal(url),
    getPluginBlockStatus: (candidate) => catalogService?.getPluginBlockStatus(candidate) || { blocked: false, reasons: [] }
  })
```

This keeps the write path aligned with the host’s existing action-config persistence.

- [ ] **Step 2: Accept the new injected dependency in `createPluginService(...)`**

Update the service factory signature in `src/main/services/plugin-service.js`:

```js
const createPluginService = ({
  settingsService,
  petService,
  aiService,
  actionImportService,
  fetchImpl = globalThis.fetch,
  serviceHealthTimeoutMs,
  healthCheckTimeoutMs = serviceHealthTimeoutMs ?? PLUGIN_SERVICE_HEALTH_TIMEOUT_MS,
  commandProcessTimeoutMs = LOCAL_PLUGIN_COMMAND_TIMEOUT_MS,
  openExternal = async () => { throw new Error('Dashboard opener is not available') },
  spawnServiceProcess = spawn,
  spawnSetupProcess = spawnServiceProcess,
  spawnCommandProcess = spawnServiceProcess,
  killServiceProcess = process.kill,
  pluginDirs = [],
  officialPlugins = [],
  getPluginBlockStatus = () => ({ blocked: false, reasons: [] })
}) => {
```

No other behavior should change in this step.

- [ ] **Step 3: Add a bounded preset payload validator and write helper**

Near `createPluginBridgeActionCatalog()`, add:

```js
  const normalizePluginBridgeActionPresetPayload = (payload = {}) => {
    const hasDefaultAction = Object.prototype.hasOwnProperty.call(payload, 'defaultAction')
    const hasClickAction = Object.prototype.hasOwnProperty.call(payload, 'clickAction')
    if (!hasDefaultAction && !hasClickAction) {
      throw new Error('Action preset update must include defaultAction or clickAction')
    }

    const snapshot = petService.getSnapshot?.() || {}
    const actions = snapshot.actions || {}
    const availableActionIds = new Set(
      Array.isArray(actions.actions)
        ? actions.actions.map((action) => String(action.id || '')).filter(Boolean)
        : []
    )

    const normalized = {}

    if (hasDefaultAction) {
      if (typeof payload.defaultAction !== 'string' || !payload.defaultAction.trim()) {
        throw new Error('defaultAction must be a non-empty string')
      }
      const actionId = payload.defaultAction.trim()
      if (!availableActionIds.has(actionId)) {
        throw new Error(`Unknown action preset: ${actionId}`)
      }
      normalized.defaultAction = actionId
    }

    if (hasClickAction) {
      if (typeof payload.clickAction !== 'string' || !payload.clickAction.trim()) {
        throw new Error('clickAction must be a non-empty string')
      }
      const actionId = payload.clickAction.trim()
      if (!availableActionIds.has(actionId)) {
        throw new Error(`Unknown action preset: ${actionId}`)
      }
      normalized.clickAction = actionId
    }

    return normalized
  }

  const applyPluginBridgeActionPreset = async (payload = {}) => {
    if (!actionImportService?.updateActionConfig) {
      throw new Error('Action preset updates are not available')
    }
    const normalized = normalizePluginBridgeActionPresetPayload(payload)
    await actionImportService.updateActionConfig(normalized)
    petService.reloadAnimations?.()
    return createPluginBridgeActionCatalog()
  }
```

This keeps bridge validation separate from the route handler and prevents partial writes on bad input.

- [ ] **Step 4: Add the new handler, route match, and dispatch**

Extend `createPluginBridgeHandlers(...)`:

```js
    petActionPreset: async (payload = {}) => {
      appendLog({ pluginId: plugin.manifest.id, commandId: entryId, level: 'info', message: 'Bridge pet.actions.preset requested' })
      const actions = await applyPluginBridgeActionPreset(payload)
      appendLog({
        pluginId: plugin.manifest.id,
        commandId: entryId,
        level: 'info',
        message: `Bridge pet.actions.preset applied: ${actions.defaultAction}/${actions.clickAction}`.slice(0, 240)
      })
      return { ok: true, actions }
    },
```

Update the route matcher:

```js
const match = url.pathname.match(/^\/plugins\/bridge\/([^/]+)\/([^/]+)\/([^/]+)(\/context|\/pet\/actions|\/pet\/actions\/preset|\/pet\/say|\/pet\/action|\/pet\/event)$/)
```

Then dispatch before the generic JSON route handlers:

```js
        if (route === '/pet/actions/preset') {
          if (!isJsonRequest(request)) {
            sendJson(response, 415, { ok: false, error: 'Content-Type must be application/json' })
            return
          }
          const payload = await readJsonBody(request)
          sendJson(response, 200, await runtime.handlers.petActionPreset(payload))
          return
        }
```

- [ ] **Step 5: Preserve the current error contract for invalid preset requests**

Do not add a new permission gate in this phase.

Keep the existing `catch` mapping, but make sure invalid preset payloads still surface as `400`:

```js
      } catch (error) {
        const statusCode = /does not have/.test(String(error.message || '')) ? 403 : 400
        sendJson(response, statusCode, { ok: false, error: error.message || 'Bridge request failed' })
      }
```

This should already be sufficient once the new helper throws ordinary validation errors.

## Task 4: Verify the runtime behavior before docs

**Files:**
- Modify: `tests/services/plugin-service.test.js`
- Modify: `src/main/services/plugin-service.js`
- Modify: `main.js`

- [ ] **Step 1: Run the focused bridge suite**

Run:

```bash
node --test tests/services/plugin-service.test.js --test-name-pattern "declaration-only command bridge applies action presets through the host save path|declaration-only command bridge preset update preserves omitted fields|declaration-only command bridge rejects unknown preset action ids without mutation|plugin service bridge applies action presets and keeps readback in sync|plugin service bridge preset route expires when the service exits|plugin service bridge rejects invalid tokens and missing permissions|declaration-only command bridge exposes bounded action catalog|plugin service bridge exposes bounded action catalog"
```

Expected: PASS.

- [ ] **Step 2: Run syntax checks on touched runtime files**

Run:

```bash
node --check main.js
node --check src/main/services/plugin-service.js
node --check tests/services/plugin-service.test.js
```

Expected: all PASS.

- [ ] **Step 3: Commit the runtime change once the focused suite is green**

```bash
git add main.js src/main/services/plugin-service.js tests/services/plugin-service.test.js
git commit -m "feat: add plugin action preset bridge"
```

## Task 5: Update docs, phase record, and review stub

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `docs/plugin-development.md`
- Modify: `docs/plugin-ecosystem-rules.md`
- Modify: `docs/HANDOFF.md`
- Modify: `docs/development-summary.md`
- Modify: `docs/project-status-review.md`
- Modify: `docs/productization-v1.1-todo-design.md`
- Modify: `docs/project-context.json`
- Create: `docs/phases/phase-68-plugin-authoring-bridge-action-preset.md`
- Create: `docs/reviews/phase-68-plugin-authoring-bridge-action-preset-review.md`

- [ ] **Step 1: Update live docs with the new bounded capability**

Apply wording that says explicit command and service bridge runs can now:

- discover actions through `GET /pet/actions`;
- apply preset pairings through `POST /pet/actions/preset`;
- change only `defaultAction` and `clickAction`;
- avoid any implication of sprite editing, image generation, or arbitrary file access.

Keep the wording aligned with these example lines:

```md
... short-lived bridge access for `pet.say`, `pet.action`, `pet.event`, read-only context, read-only action discovery, and bounded action preset updates ...
```

and:

```md
... explicit bridge runs can safely choose and apply existing action presets without gaining sprite, atlas, or filesystem mutation powers ...
```

- [ ] **Step 2: Add the Phase 68 phase record**

Create `docs/phases/phase-68-plugin-authoring-bridge-action-preset.md` with this structure:

```md
# Phase 68: Plugin Authoring Bridge Action Preset

> Date: 2026-06-17
> Branch: `codex/plugin-service-bridge-phase66`
> Status: implemented locally

## Goal

Let explicit declaration-only plugin commands and services safely apply installed action presets through the existing loopback bridge.

## What Changed

- `PluginService` now exposes `POST /pet/actions/preset` for explicit bridge runs.
- The route only updates `defaultAction` and `clickAction`.
- Requested action ids must already exist in the current action catalog.
- Writes flow through the existing host action config save path.
- Successful responses reuse the bounded action-catalog summary from Phase 67.

## Boundaries Preserved

- No new action creation, deletion, label editing, sprite generation, or filesystem access.
- Bridge access remains loopback-only, token-gated, per-entry-run scoped, and token-free in logs.
- `PetService` remains the single source of truth for pet-facing state.

## Verification Status

Targeted verification completed during implementation:

```bash
node --test tests/services/plugin-service.test.js --test-name-pattern "declaration-only command bridge applies action presets through the host save path|declaration-only command bridge preset update preserves omitted fields|declaration-only command bridge rejects unknown preset action ids without mutation|plugin service bridge applies action presets and keeps readback in sync|plugin service bridge preset route expires when the service exits|plugin service bridge rejects invalid tokens and missing permissions|declaration-only command bridge exposes bounded action catalog|plugin service bridge exposes bounded action catalog"
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
```

- [ ] **Step 3: Add the Phase 68 review document**

Create `docs/reviews/phase-68-plugin-authoring-bridge-action-preset-review.md` with this structure:

```md
# Phase 68 Production Code Quality Review

> Date: 2026-06-17
> Branch: `codex/plugin-service-bridge-phase66`
> Scope: action preset bridge route, targeted tests, and live docs

## Scope

- Base: current working tree on `codex/plugin-service-bridge-phase66`
- Scope mode: Phase 68 diff
- Risk level: medium because the change adds a write route to the local bridge while staying bounded to existing action ids and host save paths
- Assumption: action creation, deletion, sprite editing, setup bridge access, background polling, and hard process-tree guarantees remain out of scope

## Findings

No blocking production findings remain after review.

## Review Optimizations Applied

- preset writes are validated against the current action catalog before mutation;
- preset writes delegate through the existing host action config save path instead of direct file edits;
- command and service bridge tests prove readback, invalid action rejection, token rejection, and expiry;
- live docs keep the feature framed as bounded action preset control rather than generic pet-pack editing.

## Architecture Assessment

`PluginService` still owns the bridge boundary while host-managed action services still own config persistence, so the behavior remains in the right layer.

## Robustness Assessment

The new route inherits the same token, expiry, and per-run scoping as the existing bridge routes. Invalid action ids fail before mutation, which avoids partial writes.

## Test Assessment

Strong coverage:

- command and service bridge runs can update presets;
- omitted fields preserve the current paired value;
- unknown action ids are rejected without mutation;
- invalid token and expired runs are rejected;
- `GET /pet/actions` reflects successful preset writes.

## Verification

Targeted verification completed during implementation:

```bash
node --test tests/services/plugin-service.test.js --test-name-pattern "declaration-only command bridge applies action presets through the host save path|declaration-only command bridge preset update preserves omitted fields|declaration-only command bridge rejects unknown preset action ids without mutation|plugin service bridge applies action presets and keeps readback in sync|plugin service bridge preset route expires when the service exits|plugin service bridge rejects invalid tokens and missing permissions|declaration-only command bridge exposes bounded action catalog|plugin service bridge exposes bounded action catalog"
# pass
```

Planned full verification before merge:

```bash
npm run check:syntax
npm test
npm run test:control-center
git diff --check
node -e "JSON.parse(require('node:fs').readFileSync('docs/project-context.json','utf8')); console.log('project-context ok')"
```

## Final Recommendation

Safe to merge.
```

- [ ] **Step 4: Commit the documentation batch**

```bash
git add README.md README.zh-CN.md docs/HANDOFF.md docs/development-summary.md docs/plugin-development.md docs/plugin-ecosystem-rules.md docs/productization-v1.1-todo-design.md docs/project-context.json docs/project-status-review.md docs/phases/phase-68-plugin-authoring-bridge-action-preset.md docs/reviews/phase-68-plugin-authoring-bridge-action-preset-review.md
git commit -m "docs: record phase 68 action preset bridge"
```

## Task 6: Production review, full verification, and publish

**Files:**
- No new files beyond the file map.

- [ ] **Step 1: Run the required production review context collection**

Run:

```bash
python3 /Users/mango/.agents/skills/production-code-quality-review/scripts/collect-review-context.py --repo /Users/mango/.config/superpowers/worktrees/OpenPet/codex-plugin-service-hard-cleanup-phase65
```

Focus the review on:

- write-path correctness for `POST /pet/actions/preset`;
- accidental widening into file/path/sprite mutation;
- invalid action-id rejection before mutation;
- command/service bridge auth and expiry behavior;
- doc honesty around “preset update” versus “resource editing”.

- [ ] **Step 2: Apply any review-driven optimizations**

If the review surfaces a real issue, fix it before final verification and update the Phase 68 review doc so it reflects the final state rather than the first draft.

- [ ] **Step 3: Run the full verification suite**

Run:

```bash
npm run check:syntax
npm test
npm run test:control-center
git diff --check
node -e "JSON.parse(require('node:fs').readFileSync('docs/project-context.json','utf8')); console.log('project-context ok')"
```

Expected: all PASS.

- [ ] **Step 4: Update the phase/review docs with final verification outcomes**

Replace the “Planned full verification” blocks in:

- `docs/phases/phase-68-plugin-authoring-bridge-action-preset.md`
- `docs/reviews/phase-68-plugin-authoring-bridge-action-preset-review.md`

with the actual command outcomes, mirroring the truthful wording used in the Phase 67 cleanup.

- [ ] **Step 5: Create the final Phase 68 publish commit and push**

Run:

```bash
git add main.js src/main/services/plugin-service.js tests/services/plugin-service.test.js README.md README.zh-CN.md docs/HANDOFF.md docs/development-summary.md docs/plugin-development.md docs/plugin-ecosystem-rules.md docs/productization-v1.1-todo-design.md docs/project-context.json docs/project-status-review.md docs/phases/phase-68-plugin-authoring-bridge-action-preset.md docs/reviews/phase-68-plugin-authoring-bridge-action-preset-review.md
git commit -m "feat: add plugin action preset bridge"
git push -u origin codex/plugin-service-bridge-phase66
```

## Self-Review

- Spec coverage: route addition, payload validation, host-save-path delegation, bounded response shape, command/service bridge support, docs, review, and full verification are all covered.
- Placeholder scan: no `TBD`, `TODO`, or “implement later” placeholders remain; each code-changing step includes concrete snippets and commands.
- Type consistency: the plan uses `actionImportService.updateActionConfig()` as the sole write path, `POST /pet/actions/preset` as the route name, and `defaultAction` / `clickAction` as the only mutable fields in every task.
