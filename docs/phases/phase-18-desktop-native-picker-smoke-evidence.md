# Phase 18 开发文档：Desktop Native Picker Smoke Evidence

> 阶段目标：为 macOS / Windows packaged app 原生 OS 文件选择器烟测建立可生成、可填写、可校验、可审计的证据工具链。
> 范围约束：本阶段不宣称真实 packaged app 原生文件选择器已经通过；不改变插件权限、安全边界、Control Center UI 或 Windows release-ready 状态。

## 1. 背景

Phase 16 已覆盖 Control Center demo API 模式下的手动插件包 review UI，Phase 17 已覆盖主进程 IPC 到真实 `.openpet-plugin.zip` 的 inspect / install 服务链路。两者共同证明前端 review 流和主进程服务 glue 是可回归的。

但 live docs 中仍保留一个桌面发布缺口：在真实 launched / packaged Electron app 中，macOS 与 Windows 的原生 OS 文件选择器是否能完成取消、选择 zip、选择帧文件夹、选择 pet pack 文件夹，以及操作后状态是否一致。这个缺口不能靠 Node 测试或 Playwright demo API 自动声称完成；它需要真实 packaged app、真实 OS picker 和可追溯证据。

本阶段选择补“证据工具链”，而不是伪造自动点击 OS 原生弹窗。目标是让后续人工或 CI-backed manual 验证有统一 JSON 报告、runbook、更新命令和 readiness 校验。

## 2. 目标

- 新增 desktop picker smoke report schema 和 validator，平台限定为 `darwin` / `win32`。
- 支持生成 pending 报告，自动收集 release artifact、版本、runner 和签名状态线索。
- 支持用命令逐条填写检查项证据，直到 report 可通过 readiness 校验。
- 支持生成 operator runbook，指导 macOS / Windows packaged app 原生 picker 烟测。
- 将工具挂入 `package.json`，并用 Node tests 覆盖报告生成、签名解析、更新、runbook 和 validator 行为。
- 同步 live docs，保持“macOS release baseline complete；Windows baseline exists but not release-ready；真实 packaged picker 证据仍需填写”的措辞。

## 3. 实现内容

### 3.1 报告校验器

新增 `scripts/validate-desktop-picker-smoke-report.js`，定义必须覆盖的 packaged app picker 检查：

- `packaged-launch`
- `control-center-open`
- `plugin-picker-cancel`
- `plugin-picker-zip-review`
- `plugin-install-disabled`
- `action-frame-picker-cancel`
- `pet-pack-picker-cancel`
- `state-after-picker-smoke`

默认 readiness 校验要求所有检查为 `pass` 且有 evidence。`--allow-pending` 只用于生成或填写中的结构校验；`--require-signed` 额外要求 macOS `signatureStatus: Valid` 或 Windows `authenticodeStatus: Valid` 以及签名证据。

### 3.2 Pending 报告生成

新增 `scripts/create-desktop-picker-smoke-report.js`：

- `--platform darwin|win32` 限定目标平台。
- `--release-dir` 扫描 release 目录中的 `.app` / `.dmg` / `.zip` / `.exe` / `latest*.yml` / `.blockmap`。
- macOS 尝试用 `codesign --verify` 采集签名 evidence。
- Windows 在 Windows runner 上尝试用 `Get-AuthenticodeSignature` 采集 Authenticode evidence。
- 默认生成 pending checks，不把报告生成等同于 smoke 成功。

本阶段还修正 artifact 平台 token 匹配，确保带空格的文件名也能正确识别 `mac` / `windows` 分隔 token。

### 3.3 报告填写工具

新增 `scripts/update-desktop-picker-smoke-report.js`：

- `--list-checks` 输出所有 required check id。
- `--check` / `--status` / `--evidence` / `--evidence-file` / `--notes` 填写单项检查。
- `--set-env` / `--set-artifact` / `--set-fixture` 更新环境、产物和 fixture 元数据。
- `--validate-ready` 要求所有检查已经通过。
- `--require-signed` 必须与 `--validate-ready` 一起使用，避免误把未签名 prerelease 当成 official-ready。

### 3.4 Runbook 生成

新增 `scripts/create-desktop-picker-smoke-runbook.js`，从 pending 或 partially-filled report 生成 Markdown 操作手册。runbook 为每个检查项生成对应的 `npm run update-desktop-picker-smoke-report` 命令，并在末尾列出 smoke readiness 和 signed official-readiness 校验命令。

### 3.5 npm scripts

`package.json` 新增：

```bash
npm run create-desktop-picker-smoke-report
npm run create-desktop-picker-smoke-runbook
npm run update-desktop-picker-smoke-report
npm run validate-desktop-picker-smoke-report
```

### 3.6 测试

新增两组 release tests：

- `tests/release/desktop-picker-smoke-report.test.js`
- `tests/release/desktop-picker-smoke-runbook-update.test.js`

覆盖 artifact 选择、带空格平台 token、macOS / Windows 签名状态解析、pending 报告结构校验、all-pass readiness、signed Windows official-readiness、runbook 内容、报告更新、证据文件读取、未知 key / check 拒绝和 pretty JSON 写出。

## 4. 文档同步

本阶段同步更新 live docs：

- `README.md` / `README.zh-CN.md`：测试数量、Phase 18 链接、testing coverage、v1.1 规划与 release scope。
- `AGENTS.md`：Node test count 更新。
- `docs/HANDOFF.md`：当前状态、最新阶段、测试数量、最近变更、待办和工作流。
- `docs/productization-roadmap.md`：当前基线、测试策略、收尾状态、阶段表和剩余 release gates。
- `docs/project-documentation-design.md`：Phase 18 治理记录、当前文档状态和下一优先级。
- `docs/project-status-review.md`：状态评估、测试数量、文档数量、残留风险和发布建议。
- `docs/jishuwendang.md`：技术栈、质量指标和命令。
- `docs/desktop-release-design.md` / `docs/release-checklist.md`：desktop picker smoke evidence 工具链和操作命令。

## 5. 验证

本阶段计划并执行以下验证：

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

最终结果记录在 paired review 文档中。

## 6. 边界与残留风险

- 本阶段提供可审计证据工具链，但不等于真实 OS picker 已经被点击和验证。
- 生成 pending report / runbook 只能证明结构可用；readiness 必须由真实 packaged app smoke evidence 填满后通过 validator。
- macOS official release 仍需要真实签名 / 公证产物证据。
- Windows release-ready 状态不变；仍需要签名 artifact evidence、真实 Windows smoke validation 和 clean-machine / CI-backed manual 证据。
- 插件权限白名单、第三方 runner、SDK、API key 隔离、本地 HTTP/MCP 默认关闭策略均未改变。

## 7. 结果

Phase 18 将“launched / packaged app 原生 OS 文件选择器验证”从文档 TODO 推进为可执行证据流程。后续阶段应使用该工具链生成具体 release 的 pending report，在 macOS / Windows packaged app 上完成真实 picker smoke，填写 evidence，并将通过 validator 的报告作为 release 证据归档。
