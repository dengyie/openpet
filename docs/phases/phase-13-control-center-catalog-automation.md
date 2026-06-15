# Phase 13 开发文档：Control Center Catalog 自动化

> 阶段目标：把 Control Center 前端自动化继续推进到 Catalog 生态入口，覆盖目录插件安装、目录插件更新和目录 Pet Pack 安装流程。  
> 范围约束：仍运行在 React + Vite demo API 模式；不改变 Electron IPC、主进程 catalog service、真实下载校验或 Windows release-ready 口径。

## 1. 背景

Phase 12 已经把 Pet、AI 与 Service 的保存配置流程纳入 UI 回归。剩余 Control Center 深层流程中，Catalog 是用户发现生态能力的第一入口，且包含“目录项状态 → 安装审查 → 确认安装 → 状态回写 → reload 后保留”的完整闭环。

本阶段优先覆盖 Catalog install/update，是因为它既能验证目录列表和审查面板的连接，也能验证安装完成后的状态回写，不需要引入真实 zip 下载或 Electron 对话框。

## 2. 交付范围

本阶段交付：

- 扩展 demo API fallback，使 Catalog 在 demo 模式下提供可交互样本：
  - 一个可安装插件 `Demo Weather`。
  - 一个可更新插件 `Demo Pomodoro`。
  - 一个可安装 Pet Pack `Demo Pixel Cat`。
- demo Catalog 状态写入 `sessionStorage`，支持 Playwright 在 `page.reload()` 后验证已安装/已更新状态。
- 新增 2 个 Playwright 用例：
  - Catalog 插件安装：从目录项进入审查面板，确认安装，验证状态变为 `Installed 1.0.0`，reload 后仍保留。
  - Catalog 插件更新 + Pet Pack 安装：验证 `Update 1.0.0 → 1.1.0`、审查面板、安装回写和 reload 后状态。
- 将 `npm run test:control-center` 当前基线从 5 个 UI 测试扩展到 7 个 UI 测试。
- 同步 README、HANDOFF、路线图、状态评估、技术文档和文档设计中的测试口径与剩余自动化缺口。

本阶段不交付：

- 不启动 Electron BrowserWindow，不验证 preload IPC 或真实主进程 service 注入。
- 不下载真实 Catalog package，不验证 HTTPS、sha256、zip 解包或真实插件文件写入。
- 不覆盖手动插件包安装 review，也不覆盖 AI/MCP session 管理。
- 不改变 Windows 分发支持声明。

## 3. 设计决策

### 3.1 demo Catalog 样本

`src/control-center/src/api/control-center-api.js` 原先在 demo 模式返回空 Catalog，适合 shell 冒烟，但无法验证 Catalog 交互。本阶段新增 `createDemoCatalog()`，提供稳定、无网络依赖的目录样本。

样本覆盖三种常见状态：

- `Available`：新插件安装。
- `Update old → new`：已安装插件更新。
- `Available` Pet Pack：宠物包安装。

安装完成后仅更新 demo catalog item 的 `installed`、`installedVersion` 和 `updateAvailable` 字段，保持逻辑局限在前端回归所需状态。

### 3.2 审查面板模拟

本阶段新增 `createDemoPluginReview()` 与 `createDemoPetPackReview()`：

- 插件审查包含权限 diff、网络 allowlist diff、签名标签、包摘要和命令列表。
- 更新审查保留 `existingVersion`，UI 展示 `更新 1.0.0 → 1.1.0`。
- Pet Pack 审查包含默认动作、点击动作、包摘要和治理状态。

这能验证当前 pane 的可见审查信息，但不冒充真实安全校验。真实校验仍由主进程 `CatalogService`、`PluginInstallService` 和 `PetPackService` 覆盖。

### 3.3 选择器策略

测试继续优先使用用户可见语义：

- 通过 `Catalog` tab 进入目标页面。
- 通过目录项可见标题定位目标 item。
- 通过按钮文案触发 `Install` / `Update` / `确认安装` / `安装 Pet Pack`。
- 通过审查面板文本和 status line 验证状态变化。

## 4. 实施记录

### 4.1 demo API Catalog 状态

更新 `src/control-center/src/api/control-center-api.js`：

- 引入 `cloneCatalog`。
- 新增 `createDemoCatalog()`、`createDemoPluginReview()`、`createDemoPetPackReview()`。
- `createDefaultDemoState()` 增加 `catalog`。
- `readDemoState()` 支持旧 session state 缺少 catalog 时回退到 demo catalog。
- `getCatalog()` 返回当前 demo catalog clone。
- `prepareCatalogInstall()` 生成 plugin / pet-pack selection。
- `installCatalogSelection()` 更新 demo catalog item 的安装状态并写入 `sessionStorage`。
- `addCatalogBlocklistEntry()` / `removeCatalogBlocklistEntry()` 在 demo catalog 的 local blocklist 上回写。

### 4.2 Playwright 用例扩展

更新 `tests/control-center/control-center-smoke.spec.js`：

- 保留既有 5 个 Control Center UI 回归用例。
- 新增 Catalog 插件安装审查与确认安装用例。
- 新增 Catalog 插件更新与 Pet Pack 安装用例。

所有用例继续收集 `pageerror` 与 console error，并在 `afterEach` 断言为空。

### 4.3 文档同步

同步更新：

- README 双语：Phase 13 链接、测试数量、覆盖说明、v1.1 剩余自动化项。
- `docs/HANDOFF.md`：当前最新阶段、指标和命令更新为 7 UI 测试。
- `docs/productization-roadmap.md`：Catalog 安装/更新从缺口移动到已覆盖范围。
- `docs/project-status-review.md`：测试指标和剩余风险同步。
- `docs/project-documentation-design.md`：阶段治理推进到 Phase 13。
- `docs/jishuwendang.md`：技术栈与开发命令同步。

## 5. 验收

- `node --check src/control-center/src/api/control-center-api.js` 通过。
- `node --check tests/control-center/control-center-smoke.spec.js` 通过。
- `npm run test:control-center` 通过，当前 7/7 Playwright UI tests pass。
- `npm run check:syntax` 通过。
- `npm test` 通过，当前 236/236 Node tests pass。
- `git diff --check` 通过。

## 6. 残留风险

- 测试仍运行在 Vite demo API 模式，不覆盖 Electron IPC、preload bridge、真实 package 下载、真实 sha256 校验、真实 zip 解包或文件写入。
- demo API 使用 `sessionStorage`，适合前端回归，不代表真实 Catalog 持久化机制。
- 当前 Playwright 仍只跑 Chromium desktop project。
- 手动插件包安装 review 和 AI/MCP session 管理仍需后续阶段补齐。
