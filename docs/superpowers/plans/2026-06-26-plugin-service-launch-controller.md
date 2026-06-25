# Plugin Service Launch Controller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract service declaration resolution and spawn assembly from `PluginService.startService` into a dedicated controller without changing behavior.

**Architecture:** Keep `PluginService` responsible for plugin lookup, runtime manager coordination, lifecycle attachment, and response shaping. Move platform-specific declaration resolution plus command parsing, cwd resolution, env creation, and fixed spawn option assembly into a small injected controller so launch policy is isolated from service lifecycle policy.

**Tech Stack:** CommonJS Node services, Node native test runner, existing plugin service integration tests.

---

### Task 1: Launch Controller

**Files:**
- Create: `src/main/services/plugin-service-launch-controller.js`
- Create: `tests/services/plugin-service-launch-controller.test.js`

- [ ] **Step 1: Write the failing test**

Cover platform override resolution and spawn assembly with injected parser, cwd resolver, env factory, and spawn function.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/services/plugin-service-launch-controller.test.js`
Expected: FAIL because the module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement `createPluginServiceLaunchController(...)` with `resolveRuntimeDeclaration(...)` and `spawnRuntime(...)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/services/plugin-service-launch-controller.test.js`
Expected: PASS.

### Task 2: PluginService Integration

**Files:**
- Modify: `src/main/services/plugin-service.js`

- [ ] **Step 1: Replace inline service launch logic**

Instantiate the launch controller and delegate declaration resolution plus process spawning from `startService`.

- [ ] **Step 2: Run focused regressions**

Run: `node --test tests/services/plugin-service-launch-controller.test.js tests/services/plugin-service.test.js`
Expected: PASS.

### Task 3: Verification And Review

**Files:**
- Read-only: `src/main/services/plugin-service-launch-controller.js`
- Read-only: `src/main/services/plugin-service.js`
- Read-only: `tests/services/plugin-service-launch-controller.test.js`

- [ ] **Step 1: Run gates**

Run: `npm run check:syntax`
Run: `git diff --check`
Run: `npm test`

- [ ] **Step 2: Run phase-gate review**

Use `production-code-quality-review` in `phase-gate` mode for this milestone increment only.

- [ ] **Step 3: Commit and stop**

```bash
git add src/main/services/plugin-service.js src/main/services/plugin-service-launch-controller.js tests/services/plugin-service-launch-controller.test.js docs/superpowers/plans/2026-06-26-plugin-service-launch-controller.md
git commit -m "refactor(phase-8): extract plugin service launch controller"
```
