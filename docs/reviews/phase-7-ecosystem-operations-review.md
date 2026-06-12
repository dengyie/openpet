# Phase 7 Production Code Quality Review

> Scope: static ecosystem catalog, catalog download/install flow, local blocklist governance, Control Center Catalog pane, and plugin / pet pack policy enforcement.

## Review Scope

- `src/main/services/catalog-service.js`
- `src/main/services/ecosystem-policy.js`
- plugin install / enable / run blocklist integration
- pet pack import / activate blocklist integration
- Catalog IPC / preload / Control Center UI
- catalog documentation and tests

## Findings

### Fixed During Review

- **P1: Catalog downloads could hang indefinitely.**
  - `CatalogService.downloadPackage()` originally awaited `fetch()` and `arrayBuffer()` without timeout.
  - Impact: a slow or stalled catalog host could leave Control Center in a permanent install-preparing state.
  - Fix: added `downloadTimeoutMs`, `AbortController`, and timeout wrappers around fetch and package body reads.
  - Regression: `catalog service times out stalled package downloads`.

- **P1: Pet pack preview metadata was not surfaced in the Catalog UI.**
  - Phase acceptance expects pet pack catalog entries to show preview information.
  - Fix: sanitized `previewImage` as HTTPS-only metadata and rendered a fixed-size preview image in Catalog rows.
  - Verification: `npm run check:syntax` confirmed the React/Vite build.

- **P2: Blocklist type validation accepted unknown types as sha256.**
  - `addBlocklistEntry()` / `removeBlocklistEntry()` mapped any non-plugin/non-pack type to `sha256`.
  - Impact: UI or future callers could silently create the wrong governance rule.
  - Fix: explicit `pluginId` / `packId` / `sha256` mapping with errors for unknown types.

- **P2: Pet pack catalog prepare failures could leave stale pending selections.**
  - If `PetPackService.inspectPackDirectory()` created a selection and a later catalog id/hash check failed, the pending selection could remain until overwritten or expired.
  - Fix: clear the pet pack pending selection in the prepare error path.

- **P2: Catalog-installed pet packs only retained the downloaded zip hash.**
  - The Catalog review UI exposed the inspected content hash, but installed metadata only kept the catalog package sha256.
  - Impact: adding the inspected content hash to the blocklist after installation would not block later activation.
  - Fix: store `packageHash` for inspected content and `sourcePackageHash` for downloaded package bytes, and check both during catalog annotation and pet pack activation.

- **P2: Catalog item IDs were not validated before being used as package filenames.**
  - Plugin and pet pack manifests validate safe IDs, but catalog metadata itself was only stringified.
  - Impact: a malformed bundled/future remote catalog could feed unsafe IDs into temp package filenames before manifest mismatch checks run.
  - Fix: validate plugin catalog IDs with plugin-safe rules and pet pack catalog IDs with pet-pack-safe rules while normalizing catalog entries.

## Architecture Assessment

- `CatalogService` owns catalog metadata, downloads, hash matching, install preparation, and local blocklist management.
- Plugin and pet pack execution surfaces consume the same policy callback rather than duplicating blocklist logic.
- Catalog install still delegates to `PluginInstallService` / `PetPackService`, preserving existing permission review and manifest validation boundaries.

## Security Assessment

- Downloadable catalog entries require HTTPS plus sha256.
- Downloaded bytes must match catalog sha256 before inspect/install.
- Package id must match plugin/pet pack manifest id.
- Zip extraction rejects traversal entries before extraction.
- Blocklist checks cover catalog install, manual plugin install/update, plugin enable/run, pet pack import/activate, and both downloaded-package and installed-content hashes where both exist.
- Renderer receives summaries only; temp paths and package contents remain in main-process services.

## Test Assessment

- Added `tests/services/catalog-service.test.js` covering catalog annotation, hash mismatch, timeout, plugin install, pet pack install, unsafe catalog IDs, dual pet pack hashes, and blocklist management.
- Extended plugin and pet pack service tests for policy denial on runtime and activation paths.

## Verification

```bash
npm test              # 165 tests, all pass
npm run check:syntax  # Node syntax + Control Center build pass
npm run pack          # electron-builder directory package pass
```

## Recommendation

Safe to merge.
