# Phase 45 开发文档：TypeScript Boundary Expansion

## 目标

Phase 45 的目标是继续扩大 TypeScript 在高漂移边界上的覆盖面，先保护 Control Center 与主进程 IPC 之间的数据契约，而不是把主进程一次性迁到 TypeScript。

本阶段仍保持 CommonJS 主进程稳定，TypeScript 作为 no-emit contract gate 使用。

## 本阶段完成内容

- 将 Control Center API facade 从 `src/control-center/src/api/control-center-api.js` 迁移为 `src/control-center/src/api/control-center-api.ts`。
- 为 `window.controlCenterAPI` 增加全局类型声明，并让 demo API 显式满足 `ControlCenterApi`。
- 更新 Control Center hooks 的 API facade import，去掉 `.js` 后缀，交给 Vite / TS bundler resolution 处理。
- 扩展 `src/shared/openpet-contracts.ts`，覆盖以下边界：
  - 动作帧检查、重新检查、导入、删除和配置保存。
  - Pet pack 检查、导入、导出、启用、删除。
  - 插件 manifest、package review、signature、permission diff、日志和安装结果。
  - Catalog plugin / pet pack 条目、安装选择、blocklist mutation。
  - AI 配置、聊天、行为 dry run、replay 和 diagnostics。
  - Local service 状态、日志过滤和 MCP session 操作。
  - Release evidence archive 与 signed release claim summary。
- 新增 `tests/shared/openpet-contracts-type-fixture.ts`，让 catalog selection、plugin review、release evidence summary 和 signed release claim summary 进入 typecheck。

## Review 中修正的问题

- Catalog pet pack 安装选择的 discriminant 从错误的 `petPack` 对齐为生产实际的 `pet-pack`。
- Catalog 安装选择 contracts 补充 `sourcePackageHash`，对齐 `catalog-service.prepareInstall()` 的真实返回值。
- 将取消和失败路径收紧为更贴近运行时的 union：
  - `PetPackExportResult` 支持 `{ canceled: true }`。
  - `ActionFrameImportResult.animations` 改为可选，因为校验失败路径只返回 `ok: false` 和 `inspectionResult`。
  - Pet pack mutation 和 catalog install result 补充生产返回中的 `pack`、`activePackId`、`plugins`、`petPacks`、`animations` 等字段。

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

1. 下一轮 TS 扩张应优先进入 hooks 的参数/状态类型、main-process JSDoc 或窄 adapter，而不是大规模改写 CommonJS 服务。
2. 新 contract 必须从真实 IPC handler、service 返回值或测试 fixture 反推，避免只为 UI demo 建模。
3. 如果未来引入运行时 schema validation，应独立设计，不把当前 TypeScript contract 误写成 runtime validation。
