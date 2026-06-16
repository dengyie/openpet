# Phase 42 开发文档：Real Packaged Runtime Evidence

> 阶段目标：把 Phase 36 的 packaged runtime smoke 工具链推进到可启动真实 packaged app 的自动证据采集器。
> 范围约束：本阶段自动采集宠物窗口、透明渲染、sprite、speech bubble、动作播放和内置 pack 切换证据；原生 OS picker 成功仍必须来自独立 desktop picker smoke report，不用路径占位替代真实 picker 证据。

## 1. 背景

Phase 36 已经建立 packaged runtime smoke report、runbook、update 和 validator，但它仍依赖人工把每一项 evidence 填入 JSON。OpenPet 此前出现过“只能看到对话框，模型透明”的回归，所以 v1.1 发布前需要一个更接近真实用户路径的自动烟测：启动打包后的 `.app`，让主进程和渲染进程共同报告桌宠窗口是否真的出现、sprite 是否可见、动作是否播放、内置 pet pack 是否能切换。

Phase 42 的重点不是升级发布声明，而是把“真实 packaged runtime 证据”变成可重复命令。

## 2. 实现记录

- 新增 `src/main/packaged-runtime-smoke-runner.js`：
  - 仅在 `OPENPET_PACKAGED_RUNTIME_SMOKE=1` 时运行。
  - 在宠物窗口加载完成后采集主进程窗口状态。
  - 通过 renderer DOM/CSS 检查透明背景、sprite 可见性、speech bubble 和帧推进。
  - 自动播放一个 action 并检查 `backgroundPositionX` 是否推进。
  - 依次切换 `legacy-cat`、`doro`、`duodong`、`chispa`，确认内置 pack 能渲染。
  - 采集窗口截图并写入 smoke evidence JSON。
  - 结束后恢复 `legacy-cat` 并退出 app。
- 更新 `main.js`：
  - 在 pet window `did-finish-load` 后调用 `maybeRunPackagedRuntimeSmoke()`。
  - 正常运行不受影响，入口完全由环境变量控制。
- 新增 `scripts/run-packaged-runtime-smoke.js`：
  - 发现或接收 packaged app 路径。
  - 创建 evidence session 目录。
  - 设置 smoke 环境变量并启动 packaged app executable。
  - 等待 packaged app 写入 evidence JSON。
  - 合并 evidence 到 packaged runtime smoke report。
  - 校验 report；默认要求所有 runtime checks pass。
  - `--allow-pending-picker` 只允许 picker 相关项保持 pending/blocked，不声明 full runtime readiness。
  - `--desktop-picker-report` 会读取并校验 ready desktop picker report；pending 或缺失报告会失败。
- 新增测试：
  - `tests/release/packaged-runtime-smoke-capture.test.js`
  - 覆盖 automated runtime checks、pending picker 门槛、linked ready picker report、session env、透明背景回归、动作帧推进回归和 picker report 链接校验。
- 新增 npm script：
  - `npm run run-packaged-runtime-smoke`

## 3. 行为设计

### 3.1 Runtime 自动证据

自动采集项包括：

- packaged launch pid
- pet BrowserWindow visible / bounds / alwaysOnTop
- transparent window + renderer transparent backgrounds
- sprite DOM 尺寸和 background image
- speech bubble visible while sprite remains visible
- action frame advancement
- built-in pack switching and rendering
- final active pack restore
- screenshot path

### 3.2 Picker 证据边界

packaged runtime runner 不伪造 OS native picker 行为。以下 checks 仍来自 desktop picker smoke：

- `plugin-picker-evidence-linked`
- `pet-picker-evidence-linked`
- `invalid-package-feedback`

如果没有 `--desktop-picker-report`，这些 checks 保持 pending/blocked。传入 picker report 时，脚本会先用 `validate-desktop-picker-smoke-report` 的 ready 规则校验；只有通过后才把它链接到 runtime report。

### 3.3 Release 口径

本阶段可以证明打包产物的自动 runtime smoke 证据链路，但不等于 signed official release readiness。正式发布仍需要 Phase 43 的签名、公证、Gatekeeper、Windows Authenticode 和 clean-machine smoke 证据。

## 4. 验证

```bash
node --test tests/release/packaged-runtime-smoke-capture.test.js
npm test
npm run test:control-center
npm run typecheck
npm run check:syntax
npm run pack
npm run run-packaged-runtime-smoke -- --app release/mac-arm64/OpenPet.app --output-dir docs/release-evidence/packaged-runtime --allow-pending-picker
git diff --check
```

## 5. 结果

- packaged app 可以通过 smoke runner 自动生成 runtime evidence。
- 透明背景必须同时有窗口透明配置和 renderer 透明背景证据。
- 动作播放必须有帧推进证据，不能只靠 action id 通过。
- 内置 pet packs 会在 packaged app 内逐个切换并验证 sprite 可见。
- picker 证据必须链接 ready desktop picker report；缺失或 pending report 会失败。

## 6. 后续工作

1. 在有真实 picker 操作条件时生成 ready desktop picker smoke report，并重新运行 runtime smoke，不使用 `--allow-pending-picker`。
2. Phase 43 继续补签名、公证、Gatekeeper、Windows Authenticode 和 clean-machine evidence。
3. 后续如果增加新的 built-in pack，应同步更新 runtime smoke 的内置 pack 列表和 release evidence fixture。
