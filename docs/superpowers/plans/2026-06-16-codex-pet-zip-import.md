# Codex Pet Zip Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add direct `.codex-pet.zip` package import for downloaded codex-pets.net assets.

**Architecture:** `PetPackService` gains zip source normalization and lifecycle cleanup, while the existing loader/schema/Codex adapter remain the runtime contract. IPC changes only the native picker options and delegates to the new source-aware service method.

**Tech Stack:** Electron main IPC, Node `fs/path/os/crypto/child_process`, Node native test runner, existing pet pack runtime.

---

### Task 1: Service Zip Source Support

**Files:**
- Modify: `src/main/services/pet-pack-service.js`
- Test: `tests/services/pet-pack-service.test.js`

- [x] **Step 1: Write failing tests**

Add tests proving `inspectPackSource(zipPath)` accepts a Codex pet zip, imports it, stores `sourcePackageHash`, rejects unsafe zip entries, rejects ambiguous pet roots, and removes extracted temp directories on clear/import/expiry.

- [x] **Step 2: Run tests to verify failure**

Run: `node --test tests/services/pet-pack-service.test.js`

Expected: FAIL because `inspectPackSource` is not implemented.

- [ ] **Step 3: Implement source normalization**

Add safe zip entry validation, `extractPetPackZipToTemp()`, `findPetPackRoot()`, cleanup helpers, and `inspectPackSource()`.

- [ ] **Step 4: Verify service tests pass**

Run: `node --test tests/services/pet-pack-service.test.js`

Expected: PASS.

### Task 2: IPC Picker Support

**Files:**
- Modify: `src/main/ipc.js`
- Test: `tests/main/ipc-plugin-install.test.js`

- [x] **Step 1: Write failing IPC tests**

Add tests proving the Pet Packs picker allows `openFile` and `openDirectory`, filters zip packages, and delegates the selected path to `inspectPackSource()`.

- [x] **Step 2: Run tests to verify failure**

Run: `node --test tests/main/ipc-plugin-install.test.js`

Expected: FAIL because picker only opens directories and calls `inspectPackDirectory()`.

- [ ] **Step 3: Update IPC handler**

Change title to “选择 Pet Pack 文件夹或 Codex Pet 包”, properties to `['openFile', 'openDirectory']`, filters to zip packages, and call `petPackService.inspectPackSource()`.

- [ ] **Step 4: Verify IPC tests pass**

Run: `node --test tests/main/ipc-plugin-install.test.js`

Expected: PASS.

### Task 3: Documentation and Full Verification

**Files:**
- Add: `docs/phases/phase-31-codex-pet-zip-import.md`
- Add: `docs/reviews/phase-31-codex-pet-zip-import-review.md`
- Modify: `docs/HANDOFF.md`
- Modify: `docs/project-status-review.md`
- Modify: `docs/jishuwendang.md`
- Modify: `docs/development-summary.md`
- Modify: `docs/productization-roadmap.md`

- [ ] **Step 1: Document phase result**

Record codex-pets.net research, implementation scope, tests, and residual risks.

- [ ] **Step 2: Run full verification**

Run:
```bash
node --test tests/services/pet-pack-service.test.js tests/main/ipc-plugin-install.test.js
npm test
npm run check:syntax
npm run test:control-center
git diff --check
```

- [ ] **Step 3: Commit**

Commit with message: `feat: import codex pet zip packages`

