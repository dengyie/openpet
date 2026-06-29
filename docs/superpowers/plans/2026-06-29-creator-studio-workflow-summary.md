# Creator Studio Workflow Summary Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose a stable workflow summary, next-action hint, and import-readiness view for Creator Studio dashboard runs.

**Architecture:** Keep the workflow state derived in the Creator Studio service, not scattered across the dashboard renderer. The dashboard should consume one public `run.dashboard` view model for workflow and import readiness rather than inferring product state from raw run fields.

**Tech Stack:** Node.js native test runner, static dashboard HTML/JS, Creator Studio loopback service

---

### Task 1: Add failing service-route coverage for workflow summary

**Files:**
- Modify: `tests/examples/creator-studio-plugin.test.js`
- Modify: `examples/plugins/creator-studio/service/studio-service.js`

- [ ] **Step 1: Write the failing test**

Add a service-route test that verifies `GET /api/runs/:id` returns:
- `run.dashboard.workflow.phase`
- `run.dashboard.workflow.headline`
- `run.dashboard.workflow.nextActionLabel`
- `run.dashboard.importReadiness`

Cover one `needs_input` run and one `approved` single-action run so the route proves both early-stage and import-ready states.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/examples/creator-studio-plugin.test.js`
Expected: FAIL because the current public run shape does not include workflow/import-readiness fields.

- [ ] **Step 3: Write minimal implementation**

In `examples/plugins/creator-studio/service/studio-service.js`, add helpers that derive:
- workflow phase/headline/next action from `status`, `taskStatus`, `currentStep`, `reviewStatus`, `importStatus`
- import readiness from `artifacts.actionFrames`, `status`, and `importStatus`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/examples/creator-studio-plugin.test.js`
Expected: PASS for the new service-route assertions.

### Task 2: Add failing dashboard asset coverage for workflow summary labels

**Files:**
- Modify: `tests/examples/creator-studio-plugin.test.js`
- Modify: `examples/plugins/creator-studio/web/dashboard/index.html`

- [ ] **Step 1: Write the failing test**

Extend dashboard asset coverage to require:
- a `Workflow` panel
- an `Import Readiness` panel

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/examples/creator-studio-plugin.test.js`
Expected: FAIL because the dashboard HTML does not contain the new workflow/import-readiness sections yet.

- [ ] **Step 3: Write minimal implementation**

Update `examples/plugins/creator-studio/web/dashboard/index.html` to:
- add `Workflow` and `Import Readiness` panels
- render the derived `run.dashboard.workflow` and `run.dashboard.importReadiness` values
- keep existing task/question/action review panels intact

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/examples/creator-studio-plugin.test.js`
Expected: PASS for the dashboard label assertions.

### Task 3: Verify bounded milestone behavior

**Files:**
- Modify: none unless verification uncovers a bug

- [ ] **Step 1: Run targeted verification**

Run: `node --test tests/examples/creator-studio-plugin.test.js`
Expected: PASS

- [ ] **Step 2: Run syntax/type/build verification**

Run: `npm run check:syntax`
Expected: PASS

- [ ] **Step 3: Review diff for scope drift**

Run: `git diff -- examples/plugins/creator-studio/service/studio-service.js examples/plugins/creator-studio/web/dashboard/index.html tests/examples/creator-studio-plugin.test.js`
Expected: only workflow-summary-related changes.
