# Phase 12 开发文档：Control Center 保存配置自动化

> 阶段目标：把 Control Center 前端自动化从基础冒烟推进到关键保存配置流程，覆盖 Pet、AI 与 Service 三个用户高频配置面。  
> 范围约束：仍运行在 React + Vite demo API 模式；不改变 Electron IPC、主进程 service 契约或 Windows release-ready 口径。

## 1. 背景

Phase 11 建立了 Playwright 基线，证明 Control Center shell、tab 切换、Pet 基础交互和 About 更新检查可以在仓库内自动验证。后续产品化工作继续依赖 Control Center 承载配置操作，因此只验证“页面能打开”还不够。

本阶段选择保存配置流程作为下一层 UI 回归面，原因是它横跨表单输入、保存按钮、状态提示、只读回写和 reload 后重新读取配置，能够更早发现 pane / hook / api facade 之间的漂移。

## 2. 交付范围

本阶段交付：

- 扩展 demo API fallback，使 Pet settings、AI config / behavior 和 Service config 在同一浏览器 session 中可保存、可回读。
- demo API 状态写入 `sessionStorage`，支持 Playwright 在 `page.reload()` 后验证保存结果。
- 新增 3 个 Playwright 用例：
  - Pet scale / walk speed 保存后，原始配置回写并可还原到已保存状态。
  - AI Base URL / model / system prompt 保存后 reload 可回读；API Key 草稿保存后清空，只保留 `hasApiKey` 状态。
  - Service 端口与启用状态保存后，loopback HTTP 与 MCP endpoint 使用新端口，并在 reload 后保留。
- 将 `npm run test:control-center` 当前基线从 2 个 UI 测试扩展到 5 个 UI 测试。
- 同步 README、HANDOFF、路线图、状态评估、技术文档和文档设计中的测试口径。

本阶段不交付：

- 不启动 Electron BrowserWindow，不验证 preload IPC 或真实主进程 service 注入。
- 不保存或模拟真实 API key 明文；demo API 只保存 `hasApiKey` 状态。
- 不覆盖插件安装 review、Catalog 安装/更新或 AI/MCP session 管理。
- 不改变 Windows 分发支持声明。

## 3. 设计决策

### 3.1 demo API session 状态

`src/control-center/src/api/control-center-api.js` 原先对保存操作直接返回传入值或默认值。这样适合冒烟测试，但无法验证 reload 后的配置回读。本阶段新增一个轻量 `demoState`：

- 使用 `cloneSettings`、`cloneAiConfig`、`cloneServiceStatus` 归一化默认值和回读值。
- 使用 `sessionStorage` 保存 demo 状态，范围限制在当前浏览器 session。
- 解析失败时回退到默认状态，避免坏数据导致 Control Center 空白。

这保持了 demo API 的无后端特性，同时让前端测试能覆盖真实用户会遇到的“保存再打开仍然是新值”。

### 3.2 API Key 处理

AI API Key 测试只断言：

- 输入草稿可以提交。
- 保存后草稿输入框清空。
- UI 显示 `已保存`。
- reload 后仍显示 `已保存`。

demo state 不保存用户输入的密钥明文，符合项目约束：API keys 不能进入普通 renderer/plugin 可见状态。真实 Electron 路径仍由 `SecretService` 负责。

### 3.3 选择器策略

测试优先使用可访问语义：

- tab 和保存按钮使用 role 定位。
- Service 开关使用 `role="switch"`。
- 表单使用 label 定位。

少数只读行使用 class + 文案或精确文本组合定位，原因是当前 UI 还没有为 readonly rows 提供更细的可访问名称。

## 4. 实施记录

### 4.1 demo API 持久化

更新 `src/control-center/src/api/control-center-api.js`：

- 新增 `demoStorageKey`、`createDefaultDemoState()`、`readDemoState()`、`writeDemoState()`。
- `getSettings` / `saveSettings` 使用 `demoState.settings`。
- `getAiConfig` / `saveAiConfig` / `getAiBehavior` / `saveAiBehavior` 使用 `demoState.aiConfig`。
- `saveAiApiKey` 只更新 `hasApiKey` 与 `apiKeyRef`。
- `getServiceStatus` / `saveServiceConfig` / token 和 MCP session 操作使用 `demoState.serviceStatus`。

### 4.2 Playwright 用例扩展

更新 `tests/control-center/control-center-smoke.spec.js`：

- 保留 Phase 11 的 shell/tab 与 Pet/About 冒烟用例。
- 新增 Pet settings 保存用例。
- 新增 AI config + API Key 草稿清空用例。
- 新增 Service config + endpoint 回写用例。

所有用例继续收集 `pageerror` 与 console error，并在 `afterEach` 断言为空。

### 4.3 文档同步

同步更新：

- `AGENTS.md`：Control Center Playwright 从 smoke baseline 更新为 UI regression baseline。
- README 双语：测试说明、Phase 12 链接、路线图剩余 UI 自动化项。
- `docs/HANDOFF.md`：当前状态、指标和命令更新为 5 UI 测试。
- `docs/productization-roadmap.md`：保存配置流程从缺口移动到已覆盖范围，后续缺口保留插件 review、Catalog 和 AI/MCP session。
- `docs/project-status-review.md`：测试指标和剩余风险同步。
- `docs/project-documentation-design.md`：阶段治理推进到 Phase 12。
- `docs/jishuwendang.md`：技术栈与开发命令同步。

## 5. 验收

- `node --check src/control-center/src/api/control-center-api.js` 通过。
- `node --check tests/control-center/control-center-smoke.spec.js` 通过。
- `npm run test:control-center` 通过，当前 5/5 Playwright UI tests pass。
- `npm run check:syntax` 通过。
- `npm test` 通过，当前 236/236 Node tests pass。
- `git diff --check` 通过。

## 6. 残留风险

- 测试仍运行在 Vite demo API 模式，不覆盖 Electron IPC、preload bridge、真实 service 写盘或 packaged app。
- demo API 使用 `sessionStorage`，适合前端回归，不代表真实配置持久化机制。
- 当前 Playwright 仍只跑 Chromium desktop project。
- 插件安装 review、Catalog 安装/更新、AI/MCP session 管理仍需后续阶段补齐。
