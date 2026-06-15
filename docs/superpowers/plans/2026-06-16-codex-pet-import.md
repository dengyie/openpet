# Codex Pet Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native import support for Codex-compatible `pet.json` + `spritesheet.webp` pet folders.

**Architecture:** Add a focused Codex pet adapter under `src/main/pet-pack/`, extend the existing loader to detect Codex manifests, preserve atlas metadata in the normalized manifest, and update the desktop/Control Center preview renderers to support atlas rows and per-frame durations.

**Tech Stack:** Node native test runner, Electron renderer CSS sprites, React Control Center, WebP header parsing.

---

### Task 1: Codex Pet Adapter

**Files:**
- Create: `src/main/pet-pack/codex-pet.js`
- Modify: `src/main/pet-pack/loader.js`
- Modify: `src/main/pet-pack/schema.js`
- Test: `tests/pet-pack/loader.test.js`
- Test: `tests/pet-pack/schema.test.js`

- [ ] Write failing tests for Codex pet normalization and validation.
- [ ] Add Codex atlas constants and WebP dimension parser.
- [ ] Detect `spritesheetPath` manifests in `loadPetPackFromDirectory`.
- [ ] Preserve `frameRow`, `frameColumn`, `frameDurations`, and `atlas` metadata in action normalization.
- [ ] Run targeted pet-pack tests.

### Task 2: Runtime Atlas Playback

**Files:**
- Modify: `renderer.js`
- Modify: `src/control-center/src/panes/ActionsPane.jsx`

- [ ] Update renderer frame positioning to use atlas row/column metadata.
- [ ] Use `frameDurations` when present.
- [ ] Update Control Center preview to crop atlas rows correctly.
- [ ] Run syntax/build checks.

### Task 3: Service And Docs

**Files:**
- Modify: `tests/services/pet-pack-service.test.js`
- Add: `docs/phases/phase-30-codex-pet-import.md`
- Add: `docs/reviews/phase-30-codex-pet-import-review.md`
- Modify relevant live docs with current phase/test counts.

- [ ] Add service coverage for inspecting/importing a Codex pet directory.
- [ ] Document the supported Codex pet contract and limitations.
- [ ] Run full verification.
- [ ] Commit Phase 30 independently.
