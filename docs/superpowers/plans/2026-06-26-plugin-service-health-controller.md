# Plugin Service Health Controller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract plugin service health scheduling and active checks from `PluginService` into a focused controller without changing behavior.

**Architecture:** Keep `PluginService` as the composition root and public API surface. Move health URL normalization, timer scheduling, request timeout handling, runtime health mutation, and health logging into a dedicated CommonJS controller that receives small injected callbacks for policy lookup, runtime view shaping, and fetch.

**Tech Stack:** CommonJS Node services, Node native test runner, existing plugin service integration tests.

---

### Task 1: Health Controller

**Files:**
- Create: `src/main/services/plugin-service-health-controller.js`
- Create: `tests/services/plugin-service-health-controller.test.js`

- [ ] **Step 1: Write the failing test**

Cover URL validation, periodic scheduling preconditions, healthy/unhealthy result shaping, timeout handling, and reschedule behavior.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/services/plugin-service-health-controller.test.js`
Expected: FAIL because the module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement `createPluginServiceHealthController(...)` with `clearSchedule`, `scheduleCheck`, and `checkHealth` methods. Keep runtime mutation and log semantics aligned with the current `PluginService` behavior.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/services/plugin-service-health-controller.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/plugin-service-health-controller.js tests/services/plugin-service-health-controller.test.js
git commit -m "refactor(phase-6): extract plugin service health controller"
```

### Task 2: PluginService Integration

**Files:**
- Modify: `src/main/services/plugin-service.js`
- Modify: `tests/services/plugin-service.test.js`

- [ ] **Step 1: Replace inline health logic**

Instantiate the health controller and delegate schedule/check/cleanup paths from `PluginService`.

- [ ] **Step 2: Preserve public behavior**

Keep `startService`, `stopService`, `saveServiceHealthPolicy`, and the `checkServiceHealth` public API response shape unchanged.

- [ ] **Step 3: Run focused regressions**

Run: `node --test tests/services/plugin-service-health-controller.test.js tests/services/plugin-service.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/services/plugin-service.js tests/services/plugin-service.test.js docs/superpowers/plans/2026-06-26-plugin-service-health-controller.md
git commit -m "refactor(phase-6): wire plugin service health controller"
```

### Task 3: Verification And Review

**Files:**
- Read-only: `src/main/services/plugin-service-health-controller.js`
- Read-only: `src/main/services/plugin-service.js`
- Read-only: `tests/services/plugin-service*.test.js`

- [ ] **Step 1: Run gates**

Run: `npm run check:syntax`
Run: `git diff --check`

- [ ] **Step 2: Run phase-gate review**

Use `production-code-quality-review` in `phase-gate` mode for this milestone increment only.

- [ ] **Step 3: Stop after acceptance**

If no P0/P1 blockers remain, stop the milestone and summarize.
