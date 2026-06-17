# Phase 76: Plugin Repository Provenance Rehearsal

> Date: 2026-06-18
> Scope: add a repository-snapshot submission rehearsal that records Git provenance together with package, submission-bundle, and maintainer-approval artifacts.

## Goal

Phase 75 proved the full local author-plus-maintainer handoff for an already-authored example plugin directory.

Phase 76 moves the evidence one step closer to a real third-party submission by starting from a Git source instead of a plain directory. The purpose is to record which repository snapshot was reviewed, which ref was requested, which commit was packaged, and which plugin subdirectory was selected, while keeping the rest of the workflow on the same conservative local submission chain.

## Scope

In scope:

- new `create-plugin-repository-provenance-rehearsal` command;
- Git clone-compatible source input, including local bundle fixtures;
- optional ref checkout and plugin subdirectory selection;
- source provenance recording for clone source, requested ref, resolved commit, and plugin subdirectory;
- source validation, package creation, package validation, submission bundle creation, bundle validation, maintainer approval creation, and approval validation;
- README, command list, checklist, provenance JSON, and summary JSON artifacts for the session;
- one deterministic archived session using `examples/community-plugin-sources/weather-status-community.bundle`;
- conservative live-doc updates.

Out of scope:

- claiming live public community adoption;
- network-dependent community repository fixtures in automated tests;
- signing trust, catalog publication, runtime safety, or release readiness claims;
- plugin execution or runtime permission changes;
- remote archive download flows.

## Implementation

Updated files:

- `package.json`
- `docs/HANDOFF.md`
- `docs/development-summary.md`
- `docs/project-status-review.md`
- `docs/project-context.json`
- `docs/productization-v1.1-todo-design.md`
- `docs/project-review-todo-design.md`
- `docs/plugin-development.md`
- `docs/plugin-submission-workflow-playbook.md`

Added files:

- `scripts/create-plugin-repository-provenance-rehearsal.js`
- `tests/scripts/create-plugin-repository-provenance-rehearsal.test.js`
- `examples/community-plugin-sources/weather-status-community.bundle`
- `docs/phases/phase-76-plugin-repository-provenance-rehearsal.md`
- `docs/reviews/phase-76-plugin-repository-provenance-rehearsal-review.md`
- `docs/superpowers/specs/2026-06-17-plugin-repository-provenance-rehearsal-phase76-design.md`
- `docs/superpowers/plans/2026-06-17-plugin-repository-provenance-rehearsal-phase76.md`
- `docs/release-evidence/plugin-repository-provenance-rehearsal/2026-06-17T16-30-00Z/`

Behavior changes:

1. `create-plugin-repository-provenance-rehearsal` now:
   - accepts `--git-source`, `--ref`, `--plugin-subdir`, `--output-dir`, reviewer metadata, decision, notes, and `--json`;
   - clones the source into a temp workspace;
   - optionally checks out the requested ref;
   - safely resolves one plugin subdirectory inside the clone root;
   - validates the source plugin before packaging;
   - packages it into `.openpet-plugin.zip`;
   - validates the packaged artifact;
   - creates and validates a submission bundle;
   - creates and validates maintainer approval artifacts;
   - writes README, checklist, commands, provenance, and summary files.

2. The archived Phase 76 session uses a deterministic Git bundle that contains `examples/plugins/weather-status` under a `plugin/` subdirectory. That exercises repository clone, ref selection, subdirectory resolution, package validation, submission bundle generation, and maintainer approval in one reproducible local archive.

## Decision Record

### Decision 1: make repository provenance the canonical Phase 76 baseline

- Problem: the codebase had two nearby Phase 76 ideas in progress: repository provenance and remote archive provenance.
- Choice: keep repository provenance as the official Phase 76 path.
- Reason: it already had the stronger local fixture, archive, npm script wiring, and a better fit for the documented “community-style provenance” gap without adding network brittleness.

### Decision 2: keep the first archive local and reproducible

- Problem: a real external repository would make tests and rehearsal verification depend on outside availability.
- Choice: accept generic Git clone sources in the command, but archive the first session from an in-repo Git bundle fixture.
- Reason: the command becomes ready for real repository submissions later while the current evidence remains deterministic.

### Decision 3: preserve remote Git source strings in provenance

- Problem: local bundle fixtures should be resolved to absolute paths, but remote Git URLs and scp-like Git sources must stay unchanged in archived provenance and replay commands.
- Choice: normalize only local filesystem sources with `path.resolve`; preserve `scheme://...` and `user@host:path` Git sources as authored.
- Reason: Phase 76 is a source-review evidence step. The archive must faithfully record the reviewed repository source when the command is later used against a real community repository.
- Risk: this does not validate that a remote source is trustworthy; it only records the clone source accurately.

## Validation

Targeted verification:

```bash
node --test tests/scripts/create-plugin-repository-provenance-rehearsal.test.js
node --check scripts/create-plugin-repository-provenance-rehearsal.js
node -e "const { createPluginRepositoryProvenanceRehearsal } = require('./scripts/create-plugin-repository-provenance-rehearsal'); createPluginRepositoryProvenanceRehearsal({ gitSource: 'examples/community-plugin-sources/weather-status-community.bundle', ref: 'refs/heads/main', pluginSubdir: 'plugin', outputDir: 'docs/release-evidence/plugin-repository-provenance-rehearsal/2026-06-17T16-30-00Z', reviewer: 'OpenPet Maintainer', decision: 'approved', notes: 'Repository provenance, manifest, package hash, and submission artifacts reviewed.', now: () => new Date('2026-06-17T16:30:00.000Z') });"
```

Full verification before commit:

```bash
npm run check:syntax
npm test
npm run test:control-center
npm run typecheck
git diff --check
node -e "JSON.parse(require('node:fs').readFileSync('docs/project-context.json','utf8')); console.log('project-context ok')"
```

## Outcome

After Phase 76:

- OpenPet has scaffold-based, existing-plugin, and repository-snapshot submission rehearsals;
- the repository-snapshot rehearsal records clone source, requested ref, resolved commit, and plugin subdirectory beside package/review artifacts;
- the docs still say clearly that this is local repository-style provenance evidence, not proof of public ecosystem trust, signing, publication, runtime safety, or release readiness.
