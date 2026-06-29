# Creator Studio Prompt Provenance And Failure Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface safe host prompt-builder provenance in the Creator Studio dashboard and make failed generation runs easier to understand and retry.

**Architecture:** Keep all provider-facing data host-owned and expose a sanitized dashboard-only detail contract from the Creator Studio service. Reuse existing run detail routes and dashboard rendering instead of inventing a second state model.

**Tech Stack:** Node.js native test runner, static dashboard HTML/JS, Creator Studio loopback service

---

### Task 1: Add failing service-route coverage for prompt provenance

**Files:**
- Modify: `tests/examples/creator-studio-plugin.test.js`
- Modify: `examples/plugins/creator-studio/service/studio-service.js`

- [ ] **Step 1: Write the failing test**

Add a service-route test that verifies:
- `/api/runs/:id` returns safe prompt provenance metadata for a host-generated run
- prompt preview is omitted by default
- `/api/runs/:id?developer=1` returns the sanitized prompt preview

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/examples/creator-studio-plugin.test.js`
Expected: FAIL because the current route does not return prompt provenance fields.

- [ ] **Step 3: Write minimal implementation**

In `examples/plugins/creator-studio/service/studio-service.js`, add a helper that derives a safe `promptProvenance` object from:
- `run.artifacts.generatedImage.promptBuilder`
- `run.artifacts.generatedImage.modelSnapshot`
- `run.backendStatus`

Only include the full prompt preview when developer mode is explicitly requested.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/examples/creator-studio-plugin.test.js`
Expected: PASS for the new route-contract assertions.

### Task 2: Add failing dashboard coverage for failed-run recovery rendering

**Files:**
- Modify: `tests/examples/creator-studio-plugin.test.js`
- Modify: `examples/plugins/creator-studio/web/dashboard/index.html`

- [ ] **Step 1: Write the failing test**

Add a dashboard-oriented service test that confirms failed runs expose enough public state for the client to render:
- failed backend state/message
- retryable status (`failed`)
- prompt provenance presence for host-generated runs

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/examples/creator-studio-plugin.test.js`
Expected: FAIL because the current public run shape does not expose the recovery/provenance fields.

- [ ] **Step 3: Write minimal implementation**

Update `examples/plugins/creator-studio/web/dashboard/index.html` to:
- add a `Prompt Builder` panel
- render model/backend/warnings and optional developer-mode prompt preview
- render failed backend state/message
- change the generate button label to a retry-oriented label when `run.status === 'failed'`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/examples/creator-studio-plugin.test.js`
Expected: PASS for the expanded public shape assertions.

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

Run: `git diff --stat`
Expected: only Creator Studio service/dashboard/tests and any tiny supporting contract changes if strictly required.
