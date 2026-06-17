# OpenPet Plugin Repository Provenance Rehearsal

Generated: 2026-06-17T16:30:00.000Z

This rehearsal starts from a Git source, records repository provenance, packages the reviewed plugin snapshot, and records maintainer approval without installing, enabling, or running plugin code.

## Source Repository

- Clone source: /Users/mango/project/codex/OpenPet/examples/community-plugin-sources/weather-status-community.bundle
- Requested ref: refs/heads/main
- Resolved commit: 08d4301d363e4a0aff3f5a1404b12cb2194fa809
- Plugin subdirectory: plugin

## Source Plugin

- Name: Weather Status
- Id: openpet.example.weather-status
- Version: 1.0.0
- Package: /Users/mango/project/codex/OpenPet/docs/release-evidence/plugin-repository-provenance-rehearsal/2026-06-17T16-30-00Z/packages/openpet.example.weather-status.openpet-plugin.zip
- Submission bundle: /Users/mango/project/codex/OpenPet/docs/release-evidence/plugin-repository-provenance-rehearsal/2026-06-17T16-30-00Z/submission-bundle
- Approval decision: approved

## Commands

```bash
git clone '/Users/mango/project/codex/OpenPet/examples/community-plugin-sources/weather-status-community.bundle' <checkout-dir> && git -C <checkout-dir> checkout 'refs/heads/main'
npm run validate:plugin -- '<checkout-dir>/plugin'
cd '<checkout-dir>/plugin' && zip -qr '/Users/mango/project/codex/OpenPet/docs/release-evidence/plugin-repository-provenance-rehearsal/2026-06-17T16-30-00Z/packages/openpet.example.weather-status.openpet-plugin.zip' .
npm run validate:plugin -- '/Users/mango/project/codex/OpenPet/docs/release-evidence/plugin-repository-provenance-rehearsal/2026-06-17T16-30-00Z/packages/openpet.example.weather-status.openpet-plugin.zip'
npm run create-plugin-submission-bundle -- '/Users/mango/project/codex/OpenPet/docs/release-evidence/plugin-repository-provenance-rehearsal/2026-06-17T16-30-00Z/packages/openpet.example.weather-status.openpet-plugin.zip' --output-dir '/Users/mango/project/codex/OpenPet/docs/release-evidence/plugin-repository-provenance-rehearsal/2026-06-17T16-30-00Z/submission-bundle'
npm run validate-plugin-submission-bundle -- '/Users/mango/project/codex/OpenPet/docs/release-evidence/plugin-repository-provenance-rehearsal/2026-06-17T16-30-00Z/submission-bundle' --require-ready
npm run create-plugin-maintainer-approval -- '/Users/mango/project/codex/OpenPet/docs/release-evidence/plugin-repository-provenance-rehearsal/2026-06-17T16-30-00Z/submission-bundle' --reviewer 'OpenPet Maintainer' --decision approved --notes 'Repository provenance, manifest, package hash, and submission artifacts reviewed.'
npm run validate-plugin-maintainer-approval -- '/Users/mango/project/codex/OpenPet/docs/release-evidence/plugin-repository-provenance-rehearsal/2026-06-17T16-30-00Z/submission-bundle' --require-approved
```

## Boundary

- This is repository-style provenance evidence, not proof of live public community adoption.
- Maintainer approval is a human review artifact.
- The archive does not prove signing trust, catalog publication, runtime safety, or release readiness.
