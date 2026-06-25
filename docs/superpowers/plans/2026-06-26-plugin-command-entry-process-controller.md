# Plugin Command Entry Process Controller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract declaration command child-process execution from `PluginService` into a dedicated controller without changing runtime behavior.

**Architecture:** Keep `PluginService` responsible for high-level command routing and config lookup. Move bridge run creation, spawn assembly, runtime registration, timeout/stop/error/exit reconciliation, stdin payload writing, and bounded stdout/stderr collection into an injected command-entry controller that works against the existing command runtime manager and bridge service contracts.

**Tech Stack:** CommonJS Node services, Node native test runner, existing plugin service command regressions.

---

### Task 1: Command Entry Process Controller

**Files:**
- Create: `src/main/services/plugin-command-entry-process-controller.js`
- Create: `tests/services/plugin-command-entry-process-controller.test.js`

- [ ] **Step 1: Write the failing test**

Cover success path with bridge env and stdin payload, stop/timeout cleanup, and non-zero exit structured error propagation.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/services/plugin-command-entry-process-controller.test.js`
Expected: FAIL because the module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement `createPluginCommandEntryProcessController(...)` with a `run(...)` method that preserves current declaration command semantics.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/services/plugin-command-entry-process-controller.test.js`
Expected: PASS.

### Task 2: PluginService Integration

**Files:**
- Modify: `src/main/services/plugin-service.js`

- [ ] **Step 1: Replace inline declaration command process logic**

Instantiate the new controller and delegate the `runCommandEntryProcess(...)` body to it.

- [ ] **Step 2: Run focused regressions**

Run: `node --test tests/services/plugin-command-entry-process-controller.test.js tests/services/plugin-service.test.js`
Expected: PASS.

### Task 3: Verification And Review

**Files:**
- Read-only: `src/main/services/plugin-command-entry-process-controller.js`
- Read-only: `src/main/services/plugin-service.js`
- Read-only: `tests/services/plugin-command-entry-process-controller.test.js`

- [ ] **Step 1: Run gates**

Run: `npm run check:syntax`
Run: `git diff --check`
Run: `npm test`

- [ ] **Step 2: Run phase-gate review**

Use `production-code-quality-review` in `phase-gate` mode for this milestone increment only.

- [ ] **Step 3: Commit and stop**

```bash
git add src/main/services/plugin-service.js src/main/services/plugin-command-entry-process-controller.js tests/services/plugin-command-entry-process-controller.test.js docs/superpowers/plans/2026-06-26-plugin-command-entry-process-controller.md
git commit -m "refactor(phase-9): extract command entry process controller"
```
