# Phase 18 Desktop Native Picker Smoke Evidence Review

## Findings

No blocking issues found.

## Review Notes

- The new desktop picker smoke validator keeps generated reports and successful validation separate: `--allow-pending` validates structure only, while the default readiness path requires every picker check to pass with concrete evidence.
- The required checks cover packaged launch, Control Center access, plugin picker cancel, plugin zip review, disabled-by-default install, action frame folder cancel, pet pack folder cancel, and post-smoke state consistency.
- Signed official-readiness is explicit. macOS requires `artifact.signatureStatus === "Valid"` plus signature evidence; Windows requires `artifact.authenticodeStatus === "Valid"` plus Authenticode/signature evidence.
- The pending report generator records artifact and runner metadata but leaves all runtime checks pending, so it cannot be mistaken for a passed smoke report.
- The update tool limits metadata keys and check ids to known fields, supports evidence files, and requires `--require-signed` to be paired with `--validate-ready`.
- The runbook is generated from a structurally valid report and repeats that it is an operator guide, not proof of picker success.
- A small artifact-selection bug was fixed while reviewing the scripts: platform token matching now treats whitespace as a delimiter, and the behavior is covered by a regression test.
- The change does not alter plugin permissions, plugin runner behavior, API-key handling, renderer exposure, local HTTP/MCP defaults, or Control Center runtime behavior.

## Verification

Commands run for this phase:

```bash
node --check scripts/create-desktop-picker-smoke-report.js
node --check scripts/validate-desktop-picker-smoke-report.js
node --check scripts/create-desktop-picker-smoke-runbook.js
node --check scripts/update-desktop-picker-smoke-report.js
node --test tests/release/desktop-picker-smoke-report.test.js tests/release/desktop-picker-smoke-runbook-update.test.js
npm test
npm run test:control-center
npm run check:syntax
git diff --check
```

Observed result:

- Script syntax checks: passed for all four desktop picker smoke scripts.
- Targeted desktop picker smoke tests: 22/22 passed.
- Full Node test suite: 260/260 passed.
- Full Control Center Playwright suite: 9/9 passed.
- Syntax/build check: passed, including Node syntax validation and Control Center production build.
- Diff whitespace check: passed.

## Residual Risk

- This phase creates the evidence workflow for packaged macOS / Windows native picker smoke validation. It does not itself click OS-native pickers in a packaged app.
- A generated pending report or runbook does not prove native picker success. A release claim requires every required check to be filled with evidence and validated without `--allow-pending`.
- Official desktop release readiness still requires signed artifact evidence. Windows remains not release-ready until signed artifacts and real Windows smoke validation are archived.
