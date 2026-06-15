# Phase 36 Packaged Runtime Smoke Evidence Review

## Findings

### P2: Failed ready update could leave a bad report on disk

- Location: `scripts/update-packaged-runtime-smoke-report.js`
- Problem: the CLI wrote the updated JSON before validation, so a failed `--validate-ready` run could still leave a report file containing an invalid "pass" state with missing evidence.
- Impact: operators could inspect a stale/bad report after a failed command and misread the current readiness state.
- Evidence: the original flow called `writeReport(...)` before `validateUpdatedReport(...)`. The fix now validates first and only writes after validation succeeds.
- Suggested fix: validate the updated report first, then persist only on success.
- Confidence: High
- New or pre-existing: Introduced by this change; fixed in the same phase.

## Notes

- 本阶段新增的是 evidence tooling，不是 runtime 行为改动。
- 报告生成器默认生成 pending checks，避免把工具链误写成真实 smoke 通过。
- `--require-signed` 只用于 signed official readiness gate；unsigned 本地 pack 仍只能作为结构验证或预发布检查。

## Verification

```bash
npm run typecheck # PASS, via npm run check:syntax
npm run check:syntax # PASS
node --test tests/release/packaged-runtime-smoke-report.test.js tests/release/packaged-runtime-smoke-runbook-update.test.js # PASS, 23/23
npm test # PASS, 342/342
npm run test:control-center # PASS, 9/9
npm run pack # PASS, unsigned macOS directory pack; signing/notarization skipped without local credentials
git diff --check # PASS
```

## Residual Risk

- The new tooling proves report structure and readiness gating, not actual packaged runtime behavior. Real macOS and Windows reports still need to be filled from packaged app validation runs before any runtime readiness claim.
