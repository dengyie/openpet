# Phase 37 开发文档：Release Evidence Archive

> 阶段目标：把现有 macOS / Windows release evidence 工具链收口为一个可归档、可校验、可审计的 release-level manifest。
> 范围约束：本阶段只建立 archive manifest 工具链，不伪造真实 signed/notarized evidence，不改变运行时代码，也不把 Windows 写成 release-ready。

## 1. 背景

Phase 36 已把 packaged runtime smoke evidence 工具链补齐，但 release 仍缺一个统一归档入口，能把 macOS signing/notarization/Gatekeeper 证据、Windows smoke report、desktop picker report、packaged runtime report 放在同一个可校验目录里。Phase 37 的目标不是增加新的 smoke 路径，而是把已存在的证据文件组织成一个 release 级 manifest，并把 `releaseReady` 与 `ok` 明确分离。

## 2. 实现记录

- 新增 `scripts/create-release-evidence-archive-manifest.js`：
  - 归档 macOS `codesign` / notarization / Gatekeeper 文本证据。
  - 归档 Windows smoke report、desktop picker report、packaged runtime report。
  - 对三份 report 复用各自的 validator，区分结构有效与 readiness 有效。
  - 计算 archive 文件 hash，并生成 release-level manifest。
  - `--require-signed` 只会在所有证据都满足 signed readiness 时允许 `releaseReady: true`。
- 新增测试：
  - `tests/release/release-evidence-archive-manifest.test.js`
- 新增 npm script：
  - `create-release-evidence-archive-manifest`

## 3. Archive Contract

归档目录默认应包含：

- `windows-smoke-report.json`
- `desktop-picker-smoke-report.json`
- `packaged-runtime-smoke-report.json`
- `macos-codesign.txt`
- `macos-notarization.txt`
- `macos-gatekeeper.txt`

## 4. 行为保持

- 不改 Electron runtime。
- 不改 Control Center UI。
- 不改 Windows 或 macOS release gate 口径。
- archive manifest 可以证明目录结构和证据一致性，但只有签名和 readiness 都通过后才可声明 release-ready。

## 5. 验证

```bash
node --test tests/release/release-evidence-archive-manifest.test.js # PASS, 10/10
npm run check:syntax # PASS
npm test # PASS, 352/352
npm run test:control-center # PASS, 9/9
npm run pack # PASS, unsigned macOS directory pack; signing/notarization skipped without local credentials
git diff --check # PASS
```

## 6. Review 结论

- 本阶段只新增 release-level archive manifest 工具，不改变 runtime 行为。
- 归档目录把 macOS 和 Windows 的现有证据收口为一个 manifest，减少 release 证据漂移。
- `releaseReady` 与 `ok` 分离，避免 pending 证据被误读为已发布就绪。
- `--require-signed` gate 维持了官方发布声明必须具备签名证据的约束。

## 7. 后续工作

1. 为真实 macOS release 产物补齐 codesign / notarization / Gatekeeper 归档文件。
2. 为 Windows clean-machine smoke run 补齐真实 report 和 evidence archive。
3. 将 release archive manifest 接入正式 release checklist 与 release artifact 归档流程。
