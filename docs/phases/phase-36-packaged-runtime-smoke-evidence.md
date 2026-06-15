# Phase 36 开发文档：Packaged Runtime Smoke Evidence

> 阶段目标：补齐 packaged app runtime smoke 的结构化证据工具链，覆盖宠物窗口、透明背景、sprite 可见性、speech bubble、动作播放、内置 pet pack 切换，以及与原生 picker smoke 的证据链接。
> 范围约束：本阶段只建立 evidence/report/runbook/update/validator 工具链，不伪造真实 packaged app 通过证据，不改变运行时代码。

## 1. 背景

Phase 18 已建立 packaged desktop native picker smoke evidence 工具链，但它主要覆盖原生 OS 文件选择器。OpenPet 的核心体验还需要独立证明：用户下载并启动 packaged app 后，宠物窗口真实创建、透明模型可见、动作可播放、内置 `legacy-cat` / `doro` / `duodong` / `chispa` 可切换，并且“只看到对话框、模型透明”的回归不会再次无证据地进入 release。

## 2. 实现记录

- 新增 `scripts/create-packaged-runtime-smoke-report.js`：
  - 从 `release/` 发现 macOS `.app` / DMG / ZIP 或 Windows installer / ZIP / feed。
  - 记录版本、平台、机器、签名状态、内置 pet pack fixture、linked evidence。
  - 生成所有 runtime checks 为 `pending` 的 JSON 报告。
- 新增 `scripts/validate-packaged-runtime-smoke-report.js`：
  - 校验 report 结构。
  - 校验 required checks 完整性、状态、evidence。
  - 支持 `--allow-pending` 和 `--require-signed`。
- 新增 `scripts/update-packaged-runtime-smoke-report.js`：
  - 支持逐项填充环境、artifact、fixture、built-in pack、linked evidence、screenshots、recordings 和 check evidence。
  - 支持 `--validate-ready` 和 `--require-signed`。
- 新增 `scripts/create-packaged-runtime-smoke-runbook.js`：
  - 生成人工 packaged runtime smoke 验证 runbook。
  - 每个 check 都带对应 fill command。
- 新增测试：
  - `tests/release/packaged-runtime-smoke-report.test.js`
  - `tests/release/packaged-runtime-smoke-runbook-update.test.js`
- 新增 npm scripts：
  - `create-packaged-runtime-smoke-report`
  - `create-packaged-runtime-smoke-runbook`
  - `update-packaged-runtime-smoke-report`
  - `validate-packaged-runtime-smoke-report`

## 3. Required Checks

- `packaged-launch`
- `pet-window-created`
- `transparent-background`
- `sprite-visible`
- `speech-bubble-rendered`
- `default-action-playback`
- `pack-switch-legacy-cat`
- `pack-switch-doro`
- `pack-switch-duodong`
- `pack-switch-chispa`
- `plugin-picker-evidence-linked`
- `pet-picker-evidence-linked`
- `invalid-package-feedback`
- `state-after-runtime-smoke`

## 4. 行为保持

- 不改 Electron runtime。
- 不改 Control Center UI。
- 不改 pet pack / plugin / AI / MCP 运行逻辑。
- 生成的 runtime smoke report 默认只表示 pending evidence，不能证明 release readiness。

## 5. 验证

```bash
npm run typecheck # PASS, via npm run check:syntax
npm run check:syntax # PASS
node --test tests/release/packaged-runtime-smoke-report.test.js tests/release/packaged-runtime-smoke-runbook-update.test.js # PASS, 23/23
npm test # PASS, 342/342
npm run test:control-center # PASS, 9/9
npm run pack # PASS, unsigned macOS directory pack; signing/notarization skipped without local credentials
git diff --check # PASS
```

## 6. Review 结论

- 本阶段只新增 packaged runtime smoke evidence 工具链，不改变 runtime 行为。
- 生成器默认 pending，不会把工具链误声明为真实 smoke success。
- `--require-signed` gate 已保留 signed official readiness 约束。
- `update-packaged-runtime-smoke-report` 现在先验证再写入，避免失败命令把坏的 ready 状态落盘。
- 真实 macOS / Windows packaged runtime evidence 仍需后续在 packaged app 上填充并归档。

## 7. 后续工作

1. 在 macOS packaged app 上填充真实 runtime smoke report。
2. 将 packaged runtime smoke report 与 desktop picker smoke report 一起归档到 `docs/release-evidence/` 或 release artifact。
3. Windows signed artifact 可用后，在 Windows clean machine 上填充同一 report 结构。
