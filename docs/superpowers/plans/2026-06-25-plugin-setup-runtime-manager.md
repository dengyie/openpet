# Plugin Setup Runtime Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract plugin setup runtime lifecycle bookkeeping out of `PluginService` without changing setup execution behavior.

**Architecture:** Add a focused CommonJS manager beside the existing command runtime manager. `PluginService` remains the facade for plugin lookup, policy checks, process spawn, stdout/stderr/exit handling, logs, and view shaping, while the manager owns setup runtime storage, active-run rejection, and stop dispatch.

**Tech Stack:** Electron main process services, CommonJS Node modules, Node native test runner, existing production-code-quality-review phase gate.

---

### Task 1: Setup Runtime Manager

**Files:**
- Create: `src/main/services/plugin-setup-runtime-manager.js`
- Create: `tests/services/plugin-setup-runtime-manager.test.js`

- [ ] **Step 1: Write manager tests**

Cover storage by `pluginId:setupId`, duplicate active run rejection, stop handler state transitions, plugin-id exact matching, failed stop logging, and stop-all dispatch.

Run: `node --test tests/services/plugin-setup-runtime-manager.test.js`
Expected: fail before implementation because the module does not exist.

- [ ] **Step 2: Implement manager**

Create `createPluginSetupRuntimeManager({ appendLog, stopRuntimeProcess, now })` with `getRuntime`, `setRuntime`, `assertNotActive`, `attachStopHandler`, `stopRuntime`, `stopPlugin`, `stopAll`, and `size`.

Run: `node --test tests/services/plugin-setup-runtime-manager.test.js`
Expected: pass.

### Task 2: PluginService Integration

**Files:**
- Modify: `src/main/services/plugin-service.js`
- Test: `tests/services/plugin-service.test.js`

- [ ] **Step 1: Replace local setup runtime Map helpers**

Import the new manager, instantiate it after `appendLog`, replace `setupRuntimes` access with manager calls, and keep `runSetup` spawn/result handling unchanged.

- [ ] **Step 2: Preserve cleanup behavior**

Use manager `stopPlugin(pluginId)` when disabling a plugin and `stopAll()` during app shutdown cleanup. Keep setup exit semantics as existing behavior: a stopped setup resolves with runtime `failed` and `error: "Setup stopped"` after child exit.

Run: `node --test tests/services/plugin-setup-runtime-manager.test.js tests/services/plugin-service.test.js --test-name-pattern "setup|plugin setup"`
Expected: setup-related regressions pass.

### Task 3: Verification And Review

**Files:**
- Modify: `src/main/services/plugin-service.js`
- Create: `src/main/services/plugin-setup-runtime-manager.js`
- Create: `tests/services/plugin-setup-runtime-manager.test.js`

- [ ] **Step 1: Run focused tests**

Run: `node --test tests/services/plugin-setup-runtime-manager.test.js tests/services/plugin-command-runtime-manager.test.js tests/services/plugin-service.test.js`
Expected: all tests pass.

- [ ] **Step 2: Run syntax/build gates**

Run: `npm run check:syntax`
Expected: Node syntax check, TypeScript no-emit, and Control Center build pass.

- [ ] **Step 3: Run whitespace gate**

Run: `git diff --check`
Expected: no output and exit code 0.

- [ ] **Step 4: Phase-gate review**

Use `production-code-quality-review` in phase-gate mode. Required pass state: no P0/P1 blockers; non-blocking service-runtime split remains backlog.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/plugin-service.js src/main/services/plugin-setup-runtime-manager.js tests/services/plugin-setup-runtime-manager.test.js docs/superpowers/plans/2026-06-25-plugin-setup-runtime-manager.md
git commit -m "refactor(phase-3): extract plugin setup runtime manager"
```

Self-review:
- Spec coverage: the plan covers setup runtime storage, stop behavior, PluginService integration, verification, and review.
- Placeholder scan: no placeholder tasks are present.
- Type consistency: `pluginId`, `setupId`, and `Plugin setup` log/error strings match current `PluginService` contracts.
