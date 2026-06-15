# OpenPet TODO Design

> Date: 2026-06-16
> Baseline: Phase 38 completed on `main`
> Scope: Turn the latest whole-project review TODO into an execution-oriented design document. This document defines what should be built next; it does not change release readiness or platform support claims.

## 1. Design Goal

OpenPet has already reached the intended product shape: an Electron desktop pet runtime with Control Center, pet packs, Codex pet import, bundled pets, plugins, AI behavior orchestration, local HTTP/MCP, release evidence tooling, and a TypeScript migration baseline.

The remaining TODO is not a broad feature expansion. It is a productization closure track:

- prove the packaged desktop app works in real release conditions,
- keep platform support claims tied to signed evidence,
- make third-party plugin and pet-pack ecosystems auditable,
- continue TypeScript migration where it reduces boundary drift,
- make AI behavior explainable from the product UI,
- keep live documentation short, current, and consistent.

## 2. Current Baseline

### Completed

- `PetService` is the single source of truth for pet `say`, `action`, and event state.
- Control Center covers Pet, Actions, AI, Plugins, Catalog, Service, and About.
- Pet pack runtime supports legacy cat assets, OpenPet packs, Codex pet directories, Codex pet zips, and bundled read-only packs.
- Built-in packs include `doro`, `duodong`, and `chispa`.
- Plugin runtime has manifest validation, install/update review, permission checks, isolated execution, private storage, network allowlist, logs, catalog, blocklist, submission tooling, and starter scaffolding.
- Plugin config is intentionally public settings; secret-like config fields are rejected.
- AI provider configuration and API keys remain inside the main-process boundary.
- Local HTTP/MCP is loopback-only, token-gated, logged, and disabled by default.
- TypeScript scaffolding exists for shared IPC and Control Center view contracts.
- Release evidence tooling exists for Windows smoke reports, desktop picker evidence, packaged runtime reports, and release archive manifests.

### Still Open

- macOS signed/notarized release evidence has not been fully captured and archived.
- Windows has tooling and policy, but no real signed Windows smoke evidence; it is not release-ready.
- Packaged pet-window rendering evidence is still pending for transparency, visible sprites, speech bubbles, action playback, and bundled pack switching.
- Native picker smoke evidence still needs real packaged-app runs for plugin zip, pet zip, cancel, and invalid-package paths.
- Plugin sandbox strategy needs a documented comparison of current child-process runner, SES, and Electron `utilityProcess`.
- Pet packs still need export, deterministic version conflict behavior, and provenance/license metadata.
- AI behavior orchestration lacks a user-facing decision viewer and replay/dry-run tool.
- TypeScript migration should expand from scaffold contracts into high-drift product boundaries.
- Live docs still need periodic consolidation so README, handoff, project context, and roadmap do not disagree.

## 3. Non-Goals

- Do not claim Windows release readiness before signed Windows smoke evidence passes.
- Do not move API keys or plugin secrets into renderer code, ordinary plugin storage, plugin config, or bundled examples.
- Do not rewrite the Electron main process to TypeScript/ESM in one large migration.
- Do not replace the plugin runner before a sandbox evaluation produces a concrete migration decision.
- Do not change the existing `cat_anime/` material structure.
- Do not build a remote marketplace backend before local submission, review, blocklist, and provenance workflows are solid.

## 4. Design Principles

1. **Evidence before claims**
   Public docs, release notes, About text, and release checklist must only claim what current evidence supports.

2. **Packaged path before dev path**
   Desktop pet rendering, transparency, pack switching, and native picker behavior must be proven against a packaged app, not only tests or Control Center demo flows.

3. **Contracts before rewrites**
   TypeScript migration should first cover IPC payloads, settings, manifests, catalog entries, evidence summaries, and Control Center API facades.

4. **Ecosystem changes must be reviewable**
   Plugin and pet-pack capabilities must appear in manifests, Control Center review text, validation tools, logs, or evidence artifacts.

5. **Security language stays conservative**
   Plugins can be described as permission-limited and isolated. They should not be described as absolutely safe.

6. **Docs are operating surfaces**
   README is for users, `docs/HANDOFF.md` is for continuation, `docs/project-context.json` is for machine-readable facts, and phase/review docs are historical audit records.

## 5. Workstream Design

### A. Plugin Sandbox Evaluation

**Problem**

The current plugin runner has useful isolation, but the project should not keep expanding third-party trust based on undocumented assumptions.

**Design**

- Document current guarantees from the local plugin runner:
  - child-process execution,
  - Node permission-model flags,
  - narrow filesystem read allowance,
  - VM context without `require`, `process`, or Electron APIs,
  - disabled string/WASM code generation,
  - parent-mediated SDK calls,
  - main-process permission checks for pet, AI, storage, and network calls,
  - command and script timeouts,
  - sensitive network header rejection.
- Compare current runner with SES and Electron `utilityProcess`.
- Score each option on isolation boundary, filesystem/network control, crash isolation, packaging cost, debug cost, dependency cost, migration risk, and runtime fit.
- Produce a recommendation for v1.1 and explicit triggers for re-evaluation.

**Acceptance**

- `docs/plugin-sandbox-evaluation.md` states what the current runner does and does not guarantee.
- The recommendation avoids absolute safety claims.
- Future runner migration has clear triggers, such as long-lived plugins, background workers, stronger crash isolation needs, or higher-risk plugin permissions.

### B. Packaged Runtime Evidence

**Problem**

The core product promise is visible desktop pet behavior. The previous transparent-model issue proved that tests alone are not enough if packaged rendering is not checked.

**Design**

- Run packaged app smoke against a built app bundle.
- Capture evidence for:
  - pet window creation,
  - transparent background,
  - visible sprite pixels,
  - speech bubble visibility,
  - action playback,
  - bundled pack switching for `doro`, `duodong`, and `chispa`,
  - plugin zip picker,
  - pet zip picker,
  - cancel picker path,
  - invalid-package picker path.
- Feed results into existing packaged runtime and desktop picker report validators.
- Store reports under release evidence archives instead of leaving them as pending templates.

**Acceptance**

- Each bundled pet pack has at least one packaged rendering evidence record.
- Transparent model regression is represented as a required smoke check.
- Picker reports distinguish real pass/fail evidence from pending placeholders.

### C. Signed Release Evidence

**Problem**

Release readiness depends on platform-specific signed artifacts, not on local build success.

**Design**

- For macOS, archive:
  - `codesign --verify --deep --strict`,
  - notarization accepted status,
  - Gatekeeper assessment,
  - first launch from downloaded artifact,
  - update-check behavior from About.
- For Windows, archive:
  - Authenticode status for installer and packaged contents,
  - clean-machine install,
  - launch smoke,
  - transparent pet window smoke,
  - native picker smoke,
  - uninstall,
  - SmartScreen/reputation observation without overstating trust.
- Generate release archive manifests that hash and classify all evidence.

**Acceptance**

- macOS release claims link to signed/notarized/Gatekeeper evidence.
- Windows remains explicitly not release-ready until signed Windows smoke evidence passes.
- Stable release docs cannot drift ahead of evidence artifacts.

### D. Pet Pack Lifecycle

**Problem**

Pet packs can be imported and bundled, but they are not yet a full asset lifecycle.

**Design**

- Add `.openpet-pet.zip` export for installed user packs.
- Define deterministic reinstall behavior:
  - same version,
  - upgrade,
  - downgrade,
  - overwrite,
  - duplicate ID,
  - bundled read-only pack conflict.
- Extend pack metadata with:
  - `sourceUrl`,
  - `assetAuthor`,
  - `license`,
  - `licenseUrl`,
  - `importedAt`,
  - `originalFormat`.
- Show provenance and version conflict review in Control Center.
- Keep legacy `cat_anime/` untouched.

**Acceptance**

- An installed user pack can be exported and re-imported.
- Version conflict behavior is visible before destructive overwrite.
- Built-in and imported assets have enough provenance for release review.

### E. AI Behavior Debugging

**Problem**

AI behavior orchestration can trigger pet actions, but users and maintainers cannot easily explain why a response did or did not trigger an action.

**Design**

- Add a behavior decision viewer in Control Center.
- Show recent decisions with:
  - input summary,
  - matched rule,
  - selected `actionId`,
  - cooldown result,
  - fallback path,
  - blocked/disabled reason.
- Add replay/dry-run input for AI reply text or behavior intent.
- Add behavior log export and clear actions.
- Redact API keys and sensitive prompt content from exported diagnostics.

**Acceptance**

- A user can explain one AI-triggered action without reading raw logs.
- Rule edits can be dry-run before saving.
- Redaction tests prove exports do not leak secrets.

### F. TypeScript Boundary Expansion

**Problem**

TypeScript exists, but the highest-risk drift points are still cross-process and data-contract boundaries.

**Design**

- Add or extend shared contracts for:
  - plugin manifest and review summaries,
  - pet pack manifest and provenance,
  - catalog entries,
  - AI behavior settings,
  - local service state,
  - packaged runtime evidence summaries,
  - release archive summaries.
- Consume contracts from Control Center API facades, hooks, fixtures, and UI defaults.
- Keep main-process CommonJS stable; use JSDoc or small typed helper modules where needed.

**Acceptance**

- Control Center cannot silently drift from IPC payload shapes for migrated surfaces.
- `npm run typecheck` validates real product data paths.
- `npm start`, `npm test`, `npm run test:control-center`, and `npm run check:syntax` remain passing.

### G. Documentation Consolidation

**Problem**

The project has strong documentation, but repeated historical summaries create drift risk.

**Design**

- Keep README short and user-facing.
- Keep `docs/HANDOFF.md` focused on current state, commands, next steps, and dirty-worktree warnings.
- Keep `docs/project-context.json` as compact machine-readable truth.
- Treat `docs/phases/` and `docs/reviews/` as historical audit logs.
- Reduce old long-form status documents when they duplicate current live docs.

**Acceptance**

- New contributors can find current state from README -> HANDOFF -> project context -> relevant design doc.
- Test counts, platform support, release readiness, and next-step guidance do not contradict across live docs.
- Human-facing docs read like product/engineering documentation instead of a phase transcript.

## 6. Priority

| Priority | Workstream | Reason |
|----------|------------|--------|
| P0 | Packaged Runtime Evidence | Directly proves the desktop pet experience works after packaging. |
| P0 | Signed Release Evidence | Controls release/support claims and user trust. |
| P1 | Plugin Sandbox Evaluation | Required before expanding third-party trust. |
| P1 | Pet Pack Lifecycle | Required for sustainable asset distribution. |
| P1 | TypeScript Boundary Expansion | Reduces future IPC, manifest, and UI data drift. |
| P2 | AI Behavior Debugging | Improves user control and maintainer diagnostics. |
| P2 | Documentation Consolidation | Reduces handoff and release-claim drift. |

## 7. Execution Sequence

1. Preserve the completed plugin sandbox decision before adding new plugin capabilities.
2. Fill real packaged runtime and native picker evidence for the current packaged app.
3. Close macOS signed/notarized evidence and keep Windows claims gated by signed smoke evidence.
4. Implement pet pack export, conflict policy, and provenance metadata.
5. Expand TypeScript contracts on the boundaries touched by active product work.
6. Add AI behavior viewer and replay once the runtime and evidence tracks are stable.
7. Consolidate live docs after evidence, plugin, and pet-pack facts settle.

## 8. Verification Contract

Every implementation phase should include:

- a phase document under `docs/phases/`,
- a production review document under `docs/reviews/`,
- targeted tests for new behavior,
- live-doc updates only where facts change,
- no unrelated staging or cleanup.

Minimum local verification:

```bash
npm run check:syntax
npm test
npm run test:control-center
```

Additional verification by scope:

```bash
npm run pack
npm run validate-packaged-runtime-smoke-report -- <report>
npm run validate-desktop-picker-smoke-report -- <report>
npm run validate-windows-smoke-report -- <report>
npm run create-release-evidence-archive-manifest -- <archive-dir> --require-signed
```

## 9. Done Definition

This TODO track is complete when:

- packaged pet rendering and native picker paths have filled, validated evidence,
- macOS release claims are backed by signed/notarized/Gatekeeper evidence,
- Windows wording exactly matches signed smoke evidence status,
- plugin sandbox guarantees and limits are documented with a v1.1 recommendation,
- pet packs can be exported, re-imported, version-reviewed, and source-audited,
- AI behavior can be replayed and explained from Control Center,
- TypeScript contracts cover the boundaries most likely to drift,
- live docs are concise, current, and not contradicted by phase history.
