# Codex Pet Import Design

**Goal:** OpenPet can import a Codex-compatible pet folder directly from Control Center Pet Packs.

**Architecture:** Keep PetPackService as the existing import/install path. Add a pet-pack adapter that detects Codex `pet.json` files with `spritesheetPath`, validates the fixed Codex atlas contract, and normalizes it into the OpenPet manifest shape with atlas row metadata. Extend action normalization and renderers to play rows inside a shared atlas.

**Scope:**
- Accept folders containing `pet.json` and `spritesheet.webp`.
- Validate safe ids, safe sprite path, WebP atlas dimensions `1536x1872`, and the official 8x9, `192x208` cell contract.
- Map official rows to OpenPet actions: `idle`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `running`, and `review`.
- Preserve per-frame timings through `frameDurations`.
- Reuse existing inspect/import/install/activate Control Center flows.
- Do not generate Codex pets, implement visual QA, or change `cat_anime/`.

**Testing:** Add loader tests for valid Codex pets and invalid atlas/path cases, service tests proving inspect/import works, and schema/render metadata tests so legacy pet packs still normalize as before.
