# Codex Pet Zip Import Design

**Goal:** OpenPet can inspect and import downloaded `.codex-pet.zip` packages from codex-pets.net without requiring users to unzip them manually.

**Architecture:** Keep the Phase 30 Codex pet manifest adapter unchanged. Add a source-normalization layer to `PetPackService` that accepts either a directory or a zip package, validates zip entries before extraction, finds the single `pet.json` root, then reuses the existing directory loader/import flow. Pending zip selections own their temporary extraction directory and clean it up after import, clear, replacement, or expiry.

**Behavior:**
- Directory imports continue to work through `inspectPackDirectory()`.
- Zip imports use `inspectPackSource(sourcePath)` and accept `.zip`, `.codex-pet.zip`, and `.openpet-pet.zip`.
- Zip paths must be safe relative entries. Absolute paths, drive paths, backslashes, NUL bytes, and `..` segments are rejected before extraction.
- A zip package must contain exactly one pet pack root with `pet.json`, either at archive root or one top-level folder.
- Import stores the extracted content under `userData/pet-packs/<pack-id>` and records the downloaded zip hash as `sourcePackageHash`.
- Control Center's Pet Packs picker allows both directories and zip files.

**Testing:**
- Service tests cover zip inspect/import, unsafe zip rejection, single-root enforcement, and extraction cleanup.
- IPC tests cover native picker options and selected zip delegation.
- Existing directory import, catalog install, renderer playback, and Control Center regression tests remain part of full verification.

