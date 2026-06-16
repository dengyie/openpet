# Phase 40 Pet Pack Export and Provenance Review

## Findings

- No blocking findings remain after the Phase 40 implementation review.

### Fixed During Review: P1 Control Center build failed on raw JSX arrow text

- Location: `src/control-center/src/panes/ActionsPane.jsx`
- Problem: the initial conflict summary rendered `->` directly inside JSX text mixed with expressions.
- Impact: Vite / TypeScript could not parse the Control Center, which broke `npm run test:control-center`, `npm run typecheck`, `npm run check:syntax`, and `npm run pack`.
- Fix: the arrow is now rendered as `{'->'}` inside JSX.
- Verification: `npm run test:control-center`, `npm run typecheck`, `npm run check:syntax`, and `npm run pack` all pass after the fix.

## Notes

- Pet pack provenance is normalized at manifest load time and merged with installed metadata for list/inspection summaries.
- Imported packs now retain source/license metadata plus install-time metadata (`originalFormat`, `importedAt`).
- Version conflict summaries are deterministic and visible to the Control Center before import.
- Export is available through the main-process service, IPC, preload API, and Actions pane. Built-in packs remain read-only and cannot be exported.
- Exported packs now receive a refreshed manifest provenance payload before zipping, so provenance survives round-trip export/import instead of only living in installed metadata.
- The change preserves the legacy `cat_anime/` material structure.

## Verification

```bash
node --test tests/main/ipc-plugin-install.test.js # PASS, 5/5
node --test tests/services/pet-pack-service.test.js # PASS, 24/24
node --test tests/pet-pack/schema.test.js tests/pet-pack/loader.test.js tests/shared/ipc-channels.test.js # PASS, 14/14
npm test # PASS, 370/370
npm run test:control-center # PASS, 9/9
npm run typecheck # PASS
npm run check:syntax # PASS
npm run pack # PASS; unsigned local macOS directory package, signing/notarization skipped because no local Developer ID credentials are configured
```

The production review helper suite was also run:

```bash
python3 /Users/mango/.agents/skills/production-code-quality-review/scripts/collect-review-context.py --repo /Users/mango/project/codex/OpenPet
python3 /Users/mango/.agents/skills/production-code-quality-review/scripts/diff-line-map.py --repo /Users/mango/project/codex/OpenPet
python3 /Users/mango/.agents/skills/production-code-quality-review/scripts/detect-stack.py --repo /Users/mango/project/codex/OpenPet
python3 /Users/mango/.agents/skills/production-code-quality-review/scripts/run-safe-checks.py --repo /Users/mango/project/codex/OpenPet
```

## Residual Risk

- Export currently writes a local zip through the host `zip` binary, matching the project’s existing zip test/tooling pattern. If OpenPet later needs deterministic archive byte-for-byte output across OSes, a dedicated zip writer should replace the shell tool.
- Version conflict is surfaced and reviewable, but final import still overwrites the installed pack once the user confirms import. A later UI phase can add an explicit second confirmation for downgrade/same-version replacement.
- Exported provenance now round-trips through the package manifest, but release tooling still depends on shell zip/unzip binaries; if that dependency needs to vanish, this phase should be revisited with a native archive writer/reader pair.
