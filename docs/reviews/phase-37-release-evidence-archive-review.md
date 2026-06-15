# Phase 37 Release Evidence Archive Review

## Findings

- No blocking findings remain after the Phase 37 implementation review.

### Fixed During Review: P2 macOS evidence parsing accepted broad failure text

- Location: `scripts/create-release-evidence-archive-manifest.js`
- Problem: the initial notarization/Gatekeeper success checks were broad enough to risk treating strings such as `not accepted` or invalid notarization output as passing evidence.
- Impact: a release archive could have overstated macOS readiness if failed evidence contained a success-like substring.
- Fix: notarization now requires an explicit `status: Accepted` line, and Gatekeeper evidence rejects `not accepted` while accepting standard `spctl` accepted output.
- Verification: negative tests cover `status: Invalid`, `not accepted`, and rejected Gatekeeper output.

### Fixed During Review: P2 releaseReady did not require explicit signed gate

- Location: `scripts/create-release-evidence-archive-manifest.js`
- Problem: the initial readiness calculation could become true whenever macOS and report readiness were true, even if the caller did not opt into `--require-signed`.
- Impact: a structure/archive command could accidentally look like an official release readiness proof.
- Fix: `releaseReady` is now `requireSigned && macosReady && reportsReady`.
- Verification: tests cover an all-pass signed archive without `--require-signed` and assert `releaseReady: false`.

## Notes

- 本阶段新增的是 release evidence archive tooling，不是签名、公证或 runtime smoke 的真实执行结果。
- `create-release-evidence-archive-manifest` 复用现有 Windows smoke、desktop picker、packaged runtime validators，避免维护另一套 release readiness 规则。
- `ok` 表示 archive 可解析且结构有效；`releaseReady` 只有 macOS signing evidence 与全部 report readiness 都满足时才为 true。

## Verification

```bash
node --test tests/release/release-evidence-archive-manifest.test.js # PASS, 10/10
npm run check:syntax # PASS
npm test # PASS, 352/352
npm run test:control-center # PASS, 9/9
npm run pack # PASS, unsigned macOS directory pack; signing/notarization skipped without local credentials
git diff --check # PASS
```

## Residual Risk

- The new manifest proves archive structure, hashes, and validator agreement. It does not create real signed/notarized macOS evidence, real Windows smoke evidence, or real packaged runtime/picker evidence.
