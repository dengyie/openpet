# Phase 47 开发文档：TypeScript Hook Boundary Migration

## 目标

Phase 47 的目标是把 TypeScript 从 Control Center API facade 继续推进到 hook 状态和事件边界。范围限制在 renderer 的 Control Center 层，不改变 Electron 主进程、插件沙箱、PetService 状态源或 pet pack runtime。

本阶段同时修复 review 中发现的初始化失败路径：Control Center 各 tab 的首屏数据加载失败时应结束 loading 并展示可读状态，而不是静默卡住或产生未处理 promise rejection。

## 本阶段完成内容

- 将 Control Center 的 7 个 pane hooks 从 `.js` 迁移为 `.ts`：
  - `usePetSettingsPane`
  - `useActionsPane`
  - `useAiPane`
  - `usePluginsPane`
  - `useCatalogPane`
  - `useServicePane`
  - `useAboutPane`
- 将 `downloadTextFile` 从 JS helper 迁移为 typed TS helper。
- 新增 `messageFromError(error, fallback)`，统一 renderer hook 的 `unknown` error 展示。
- 为 hook 状态和 handler 边界接入共享 contracts：
  - settings、actions、pet packs、AI config/behavior、plugin logs/config、catalog selection/blocklist、service status/logs、about/update state。
- 为 action import 的可选返回值和 canceled 分支补上类型收窄与不完整结果保护。
- 为 AI behavior rules 增加 typed parse helper，避免重复的 JSON parse 分支。
- 为 Control Center 首屏加载失败补上状态反馈：
  - Pet、Actions、AI、Plugins、Service、Catalog、About 均可结束 loading 并显示失败原因或 fallback 文案。
- 补充 React 19 类型依赖：
  - `@types/react`
  - `@types/react-dom`

## Review 修复

production review 发现首轮迁移保留了多个初始化 `Promise` 无 catch 的旧模式。若 IPC 或 demo API 初始化失败，页面会停留在 loading，且错误不进入用户可见状态。

已修复：

- Actions、AI、Plugins、Service 初始 `Promise.all` 增加 catch，设置 status 并结束 loading。
- Pet settings 初始加载和保存失败增加 status，Pet pane 复用原状态行展示错误。
- 保持 Pet 保存成功后的既有 UI 文案，避免破坏回归基线。

## 验收

- `npm run typecheck` 必须覆盖迁移后的 hooks。
- `npm run check:syntax` 必须能完成 Node syntax、typecheck 和 Control Center production build。
- Control Center Playwright smoke 仍保持 10/10。
- Node test baseline 仍保持 394/394。
- `git diff --check` 通过。
- 不改变 API key、插件权限、PetService 单一事实源或 `cat_anime/` 结构。

## 验证

```bash
npm run typecheck
npm run check:syntax
npm run test:control-center
npm test
git diff --check
```

当前结果：

- `npm run typecheck`: pass
- `npm run check:syntax`: pass
- `npm run test:control-center`: 10/10 pass
- `npm test`: 394/394 pass
- `git diff --check`: pass

## 后续约束

1. 下一步 TypeScript 迁移应进入 main-process JSDoc adapter、高漂移 service boundary，或更细的 Control Center pane prop typing。
2. 不做一次性主进程 TS/ESM rewrite。
3. 对 renderer 初始化失败路径新增 UI 或 contract 时，必须保持 Playwright baseline 对既有文案的约束。
