# Plugin Service Process Tree Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add host-owned descendant verification so requested plugin service stops no longer claim clean completion when known descendants survive root exit.

**Architecture:** Keep `PluginService` as the owner of lifecycle state and logs, but move descendant inspection into a focused helper module. Service stop should keep the existing signal ordering, grace-period force-stop path, and exit-confirmed lifecycle semantics, while tightening the final requested-stop classification after root exit.

**Tech Stack:** Electron main process, CommonJS Node services, Node child-process utilities, Node native test runner.

---

## File Map

- Create: `src/main/services/service-process-tree.js`
  Purpose: host-owned descendant inspection helper for service cleanup verification.
- Modify: `src/main/services/plugin-service.js`
  Purpose: use the helper for requested-stop descendant verification after root exit.
- Create: `tests/services/service-process-tree.test.js`
  Purpose: deterministic unit coverage for POSIX and Windows descendant traversal.
- Modify: `tests/services/plugin-service.test.js`
  Purpose: verify requested-stop completion stays `stopped` only when no visible descendants remain and fails closed otherwise.
- Create: `docs/phases/phase-72-plugin-service-process-tree-hardening.md`
  Purpose: record scope, behavior, verification, and remaining limits.
- Create: `docs/reviews/phase-72-plugin-service-process-tree-hardening-review.md`
  Purpose: record production review findings and disposition.
- Modify: `docs/HANDOFF.md`
- Modify: `docs/development-summary.md`
- Modify: `docs/project-status-review.md`
- Modify: `docs/project-context.json`
- Modify: `docs/productization-v1.1-todo-design.md`
- Modify: `docs/project-review-todo-design.md`
- Modify: `docs/plugin-development.md`
- Modify: `docs/plugin-ecosystem-rules.md`
  Purpose for all live docs: keep the extension cleanup boundary current and conservative.

## Task 1: Write failing tests for descendant verification

**Files:**
- Create: `tests/services/service-process-tree.test.js`
- Modify: `tests/services/plugin-service.test.js`

- [ ] **Step 1: Add helper tests**

Add a POSIX traversal test and a Windows traversal test for the new helper.

- [ ] **Step 2: Add PluginService completion tests**

Add tests showing:

- requested stop stays `stopped` when no descendants remain;
- requested stop becomes `failed` when descendants remain;
- unavailable verification keeps the bounded result and logs the limitation.

- [ ] **Step 3: Run targeted tests and verify RED**

Run:

```bash
node --test tests/services/service-process-tree.test.js tests/services/plugin-service.test.js
```

Expected before implementation:

- helper module does not exist yet;
- `PluginService` still treats root exit as sufficient proof of a clean stop.

## Task 2: Implement the helper and wire it into PluginService

**Files:**
- Create: `src/main/services/service-process-tree.js`
- Modify: `src/main/services/plugin-service.js`

- [ ] **Step 1: Implement the helper**

Add a small CommonJS module that exports a factory or function for:

- recursive descendant discovery from `ps` output on POSIX-like systems;
- recursive descendant discovery from Windows process-table output;
- invalid-PID guardrails.

- [ ] **Step 2: Wire the helper into requested-stop completion**

Update `PluginService` so requested-stop completion becomes:

1. keep existing process-group and child stop behavior;
2. keep existing bounded force-stop escalation behavior;
3. after a non-force-stop requested exit, inspect descendants and fail closed when known survivors remain.

- [ ] **Step 3: Run targeted tests and verify GREEN**

Run:

```bash
node --test tests/services/service-process-tree.test.js tests/services/plugin-service.test.js
```

Expected: all targeted tests pass.

## Task 3: Review and docs

**Files:**
- All docs listed in the file map

- [ ] **Step 1: Run production review context**

Run:

```bash
python3 /Users/mango/.agents/skills/production-code-quality-review/scripts/collect-review-context.py --repo /Users/mango/project/codex/OpenPet
```

- [ ] **Step 2: Record the phase and review**

Write the phase record, review note, and live-doc updates. Keep wording explicit that:

- service cleanup truth is stronger after requested stop completion;
- setup and command cleanup are unchanged;
- OpenPet still does not claim universal hard descendant termination.

## Task 4: Full verification, commit, push

**Files:**
- All changed files

- [ ] **Step 1: Run complete verification**

Run:

```bash
npm run check:syntax
npm test
npm run test:control-center
npm run typecheck
git diff --check
node -e "JSON.parse(require('node:fs').readFileSync('docs/project-context.json','utf8')); console.log('project-context ok')"
```

- [ ] **Step 2: Commit and push**

Run:

```bash
git add src/main/services/service-process-tree.js src/main/services/plugin-service.js tests/services/service-process-tree.test.js tests/services/plugin-service.test.js docs/phases/phase-72-plugin-service-process-tree-hardening.md docs/reviews/phase-72-plugin-service-process-tree-hardening-review.md docs/HANDOFF.md docs/development-summary.md docs/project-status-review.md docs/project-context.json docs/productization-v1.1-todo-design.md docs/project-review-todo-design.md docs/plugin-development.md docs/plugin-ecosystem-rules.md docs/superpowers/specs/2026-06-17-plugin-service-process-tree-hardening-phase72-design.md docs/superpowers/plans/2026-06-17-plugin-service-process-tree-hardening-phase72.md
git commit -m "feat(阶段72): harden plugin service process tree cleanup"
git push -u origin codex/plugin-service-process-tree-hardening-phase72
```
