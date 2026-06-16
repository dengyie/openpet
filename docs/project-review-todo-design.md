# OpenPet Project Review TODO Design

> Date: 2026-06-16
> Baseline: Phase 40 completed; pet pack export, provenance, and conflict summaries are implemented locally
> Scope: Convert the whole-project review TODO into a product and engineering design. This document defines what should be changed next and why; it does not change release-readiness claims.

## 1. Purpose

OpenPet has already reached the original platform direction: an Electron desktop pet runtime with Control Center, pet packs, Codex pet import, bundled pets, plugin runtime, AI behavior orchestration, local HTTP/MCP integration, release tooling, and a TypeScript migration baseline.

The remaining work is no longer about proving that the platform can exist. It is about turning the current implementation into a trustworthy desktop product and a maintainable extension ecosystem.

This design turns the latest review TODO into execution tracks:

- preserve the completed pet-pack lifecycle guarantees,
- make AI behavior explainable,
- prove packaged runtime behavior with real evidence,
- close signed release evidence,
- continue TypeScript migration at high-drift boundaries,
- improve plugin author experience without weakening the sandbox,
- keep documentation short, current, and evidence-based.

## 2. Product Target

OpenPet should present as a local-first desktop pet platform:

- users can see and control a visible transparent desktop pet,
- users can import, switch, audit, and export pet packs,
- users can configure AI behavior from the Control Center without exposing API keys,
- plugin authors can build limited-capability extensions through a repeatable workflow,
- release claims are backed by signed artifacts and smoke evidence,
- developers can continue the project from documented phase records and current-state docs.

The product should not drift into a remote marketplace, mobile runtime, or general automation platform until the desktop runtime and ecosystem lifecycle are evidence-complete.

## 3. Current Gap Summary

| Area | Current State | Gap |
|------|---------------|-----|
| Pet packs | Import, Codex pet directory/zip import, bundled packs, user-pack export, provenance, deterministic conflict summaries | Packaged-runtime smoke evidence for exported/re-imported packs |
| AI behavior | Rule-based orchestration, cooldowns, recent decisions in service logic | User-facing decision viewer, replay, export with redaction |
| Packaged runtime | Tooling exists for reports and validators | Real packaged app evidence still needs capture |
| Release readiness | macOS baseline, Windows tooling and policy | Signed macOS evidence closure and real signed Windows smoke evidence |
| Plugins | Permission-limited runner, scaffolding, review workflow, sandbox evaluation | Stronger author onboarding, real third-party submission rehearsal |
| TypeScript | Shared IPC and Control Center view contracts | API facade, hook, manifest, pet-pack, evidence, and settings boundaries |
| Documentation | Broad phase history and live docs | Consolidated current entry points and reduced duplicated status prose |

## 4. Design Principles

1. **Evidence before claims**
   README, About, release notes, and release checklist must only say what current artifacts prove.

2. **Control Center first**
   New user-facing controls, review text, exports, and diagnostics should be operable from Control Center, not hidden in manual files.

3. **Contracts before rewrites**
   TypeScript migration should harden shared data shapes before changing the Electron main process module system.

4. **Lifecycle over one-off import**
   Pet packs and plugins need inspect, install, update, export, review, and audit paths.

5. **Security language stays precise**
   Plugins are permission-limited and isolated. They are not described as absolutely safe.

6. **Legacy assets remain stable**
   Existing `cat_anime/` structure stays compatible. New pet-pack work layers around it.

## 5. Workstream A: Pet Pack Lifecycle

Status: completed in Phase 40. Keep this section as the product contract and regression checklist for future pet-pack changes.

### Problem

Pet packs need to remain portable, auditable assets. Reinstall and version conflict behavior must stay deterministic and visible.

### Design

- Keep `.openpet-pet.zip` export for installed user packs.
- Refuse export for built-in packs unless a future release explicitly defines built-in redistribution rules.
- Keep provenance metadata:
  - `sourceUrl`,
  - `assetAuthor`,
  - `license`,
  - `licenseUrl`,
  - `importedAt`,
  - `originalFormat`.
- Keep deterministic conflict decisions:
  - new install,
  - same-version reinstall,
  - upgrade,
  - downgrade,
  - duplicate ID,
  - built-in pack conflict.
- Surface provenance and conflict review in Control Center before install/overwrite.
- Add packaged smoke evidence that exported packs can be re-imported and rendered.

### Files

- `src/main/pet-pack/schema.js`
- `src/main/pet-pack/codex-pet.js`
- `src/main/services/pet-pack-service.js`
- `src/main/ipc.js`
- `control-center-preload.js`
- `src/control-center/src/panes/ActionsPane.jsx`
- `src/control-center/src/hooks/useActionsPane.js`
- `src/control-center/src/api/control-center-api.js`
- `src/shared/openpet-contracts.ts`
- `scripts/update-packaged-runtime-smoke-report.js`
- `scripts/validate-packaged-runtime-smoke-report.js`
- `tests/pet-pack/*.test.js`
- `tests/services/pet-pack-service.test.js`
- `tests/control-center/control-center-smoke.spec.js`

### Acceptance

- An installed user pack exports to a re-importable `.openpet-pet.zip`.
- Built-in pack export returns a clear user-facing refusal.
- Same-version, upgrade, downgrade, and duplicate conflicts are stable and tested.
- Control Center shows provenance and conflict decisions.
- Packaged runtime smoke proves at least one exported user pack can be re-imported and rendered.
- `cat_anime/` is unchanged.

## 6. Workstream B: AI Behavior Decision Viewer

### Problem

The behavior orchestrator can trigger actions, but users cannot easily explain why a reply triggered an action, failed cooldown, fell back, or was blocked.

### Design

- Add an AI behavior diagnostics section in Control Center.
- Show recent decisions with:
  - input summary,
  - matched rule,
  - selected `actionId`,
  - cooldown result,
  - fallback path,
  - blocked or disabled reason,
  - timestamp.
- Add replay/dry-run input for AI reply text or behavior intent.
- Add log export and clear actions.
- Redact API keys and sensitive prompt content from exported diagnostics.

### Files

- `src/main/services/behavior-orchestrator-service.js`
- `src/main/services/ai-service.js`
- `src/main/services/settings-service.js`
- `src/main/ipc.js`
- `control-center-preload.js`
- `src/control-center/src/panes/AiPane.jsx`
- `src/control-center/src/hooks/useAiSettings.js`
- `src/shared/openpet-contracts.ts`
- `tests/services/behavior-orchestrator-service.test.js`
- `tests/services/ai-action-orchestrator.test.js`
- `tests/control-center/control-center-smoke.spec.js`

### Acceptance

- A user can explain one AI-triggered action from Control Center.
- Rule edits can be dry-run before saving.
- Exported diagnostics are useful and do not leak API keys.
- Cooldown, fallback, disabled, and blocked paths have test coverage.

## 7. Workstream C: Packaged Runtime Evidence

### Problem

The desktop pet promise depends on the packaged app showing visible transparent sprites. Dev-mode tests do not fully prove that packaged rendering, asset resolution, and native pickers work.

### Design

- Run packaged smoke against a built macOS app bundle.
- Capture evidence for:
  - pet window creation,
  - transparent background,
  - visible sprite pixels,
  - speech bubble visibility,
  - action playback,
  - bundled pack switching,
  - plugin zip picker,
  - pet zip picker,
  - cancel picker path,
  - invalid package path.
- Feed reports into existing validators and release archive manifests.
- Keep reports explicit about pending, pass, and fail states.

### Files

- `scripts/update-packaged-runtime-smoke-report.js`
- `scripts/validate-packaged-runtime-smoke-report.js`
- `scripts/update-desktop-picker-smoke-report.js`
- `scripts/validate-desktop-picker-smoke-report.js`
- `scripts/create-release-evidence-archive-manifest.js`
- `docs/release-evidence/`
- `docs/desktop-release-design.md`
- `docs/release-checklist.md`

### Acceptance

- Each bundled pack has packaged rendering evidence.
- The transparent-model regression is represented by a required smoke check.
- Picker evidence distinguishes real packaged runs from placeholder templates.
- Archive manifest validation fails if required evidence is missing.

## 8. Workstream D: Signed Release Evidence Closure

### Problem

Release readiness is currently stronger in tooling than in captured signed-artifact evidence, especially for Windows.

### Design

- For macOS, archive:
  - `codesign --verify --deep --strict`,
  - notarization accepted status,
  - Gatekeeper assessment,
  - first launch from downloaded artifact,
  - update-check behavior.
- For Windows, archive:
  - Authenticode status for installer and packaged contents,
  - clean-machine install,
  - launch smoke,
  - transparent pet window smoke,
  - native picker smoke,
  - plugin runner smoke,
  - uninstall,
  - SmartScreen/reputation observation without overstating trust.
- Keep Windows public wording as not release-ready until evidence passes.

### Files

- `.github/workflows/release.yml`
- `build/notarize.js`
- `docs/desktop-release-design.md`
- `docs/release-checklist.md`
- `docs/release-evidence/`
- `scripts/create-release-evidence-archive-manifest.js`
- `tests/release/release-evidence-archive-manifest.test.js`

### Acceptance

- macOS claims link to signed, notarized, Gatekeeper, and launch evidence.
- Windows remains gated until real signed Windows smoke evidence passes.
- Release archive manifests hash every required evidence file.
- README and About do not imply unsupported platform readiness.

## 9. Workstream E: Plugin Author Experience

### Problem

The plugin runtime is capable, but third-party authors still need a cleaner path from idea to validated submission. The sandbox decision should remain conservative while onboarding improves.

### Design

- Keep the current child-process + Node permission-model + VM runner for v1.1.
- Add clearer examples for:
  - pet command plugin,
  - network allowlist plugin,
  - private storage plugin,
  - AI-assisted plugin.
- Improve scaffold output with generated README, validation command, and submission checklist.
- Run at least one third-party-style submission rehearsal using the existing workflow bundle tooling.
- Keep secret-like config fields rejected unless a future plugin-secret capability is explicitly designed.

### Files

- `scripts/create-openpet-plugin.js`
- `examples/plugins/`
- `docs/plugin-development.md`
- `docs/plugin-submission-workflow-playbook.md`
- `docs/plugin-sandbox-evaluation.md`
- `scripts/validate-plugin-package.js`
- `scripts/create-plugin-submission-bundle.js`
- `tests/scripts/create-openpet-plugin.test.js`
- `tests/scripts/validate-plugin-package.test.js`

### Acceptance

- A new author can scaffold, run, validate, package, and create a submission bundle from documented commands.
- Example plugins cover the main permission classes.
- Submission rehearsal produces reviewable Markdown and JSON artifacts.
- No docs claim unrestricted plugin safety.

## 10. Workstream F: TypeScript Boundary Expansion

### Problem

TypeScript exists, but the highest-risk drift points are still cross-process payloads, manifests, settings, and Control Center facades.

### Design

- Extend shared contracts for:
  - pet-pack manifest, provenance, and conflict summaries,
  - plugin manifest and review summaries,
  - catalog entries,
  - AI behavior settings and decision logs,
  - local service state,
  - packaged runtime evidence summaries,
  - release archive summaries.
- Consume contracts from:
  - Control Center API facade,
  - hooks,
  - defaults,
  - demo fixtures,
  - tests.
- Keep main process CommonJS stable. Use shared `.ts` contracts and JSDoc where it reduces drift without increasing boot risk.

### Files

- `src/shared/openpet-contracts.ts`
- `src/control-center/src/api/control-center-api.js`
- `src/control-center/src/hooks/*.js`
- `src/control-center/src/lib/defaults.ts`
- `src/main/services/*`
- `tests/shared/*.test.js`
- `tests/control-center/*.spec.js`

### Acceptance

- `npm run typecheck` validates migrated Control Center data paths.
- IPC payload changes require contract updates.
- Demo API fixtures match production payload shapes.
- `npm start`, `npm test`, `npm run test:control-center`, and `npm run check:syntax` remain passing.

## 11. Workstream G: Documentation Consolidation

### Problem

The project has useful documentation, but long phase history and repeated status summaries can make the current truth harder to find.

### Design

- Keep README user-facing and conservative.
- Keep `docs/HANDOFF.md` as the current continuation entry.
- Keep `docs/project-context.json` compact and machine-readable.
- Keep phase and review docs as historical audit records.
- Reduce duplicate status prose in older roadmap/status documents when live docs already own the fact.
- Add links from live docs to this TODO design as the current review-derived backlog.

### Files

- `README.md`
- `README.zh-CN.md`
- `docs/HANDOFF.md`
- `docs/development-summary.md`
- `docs/project-context.json`
- `docs/productization-roadmap.md`
- `docs/project-documentation-design.md`
- `docs/project-review-todo-design.md`

### Acceptance

- A contributor can find current state from README -> HANDOFF -> project context -> relevant design doc.
- Test totals, release readiness, platform support, and next-step guidance do not contradict across live docs.
- Human-facing docs read as maintained product documentation, not generated phase transcripts.

## 12. Execution Order

### P0: Close runtime and release proof

1. Use Phase 40 pet-pack export/provenance as the baseline contract.
2. Capture packaged runtime evidence on macOS.
3. Close macOS signed release evidence.
4. Keep Windows explicitly gated until signed Windows smoke evidence exists.

### P1: Improve ecosystem maintainability

5. Add AI behavior decision viewer and replay.
6. Improve plugin author experience and run a third-party-style submission rehearsal.
7. Expand TypeScript contracts across pet-pack, plugin, AI, and evidence boundaries.

### P2: Reduce long-term drift

8. Consolidate docs after the above behavior changes land.
9. Revisit plugin sandbox only if new plugin capabilities increase trust requirements.
10. Consider remote marketplace only after local submission, audit, provenance, and signed release evidence are solid.

## 13. Verification Baseline

Every implementation phase that touches code should end with:

```bash
npm test
npm run test:control-center
npm run typecheck
npm run check:syntax
git diff --check
```

Release/evidence phases should additionally run the relevant script validators, such as:

```bash
npm run validate-packaged-runtime-smoke-report
npm run validate-desktop-picker-smoke-report
npm run create-release-evidence-archive-manifest
```

Plugin ecosystem phases should additionally run:

```bash
npm run validate:plugin -- <plugin-dir-or-zip>
npm run create-plugin-submission-bundle -- <plugin-dir-or-zip>
npm run validate-plugin-submission-bundle -- <bundle-dir>
```

## 14. Done Criteria

This TODO design is complete when:

- pet packs have import, export, provenance, and conflict review,
- AI behavior can be explained and replayed from Control Center,
- packaged runtime evidence proves visible transparent pet rendering,
- macOS release evidence is archived and Windows claims remain gated,
- plugin authors can complete a documented local submission rehearsal,
- TypeScript covers the highest-risk shared data boundaries,
- live docs agree on current status and release readiness.
