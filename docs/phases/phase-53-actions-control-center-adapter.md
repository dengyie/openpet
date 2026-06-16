# Phase 53 开发文档：Actions Control Center Adapter

## 目标

Phase 53 延续 Phase 49-52 的主进程 `@ts-check` adapter 路线，把动作导入、动作配置保存和动作删除的 Control Center 返回结构从 IPC handler 内联拼装迁到 `src/main/control-center-adapters.js`。

本阶段只收敛 renderer-facing payload shape，不改变帧文件夹检查、sprite 生成、动作 reload 或宠物窗口通知语义，不扩大插件权限，不暴露 API key，也不做主进程 TypeScript/ESM 重写。

## 本阶段完成内容

- 扩展 `src/main/control-center-adapters.js`：
  - 新增 `ActionFrameImportResult` 和 `ActionsMutationResult` JSDoc contract import。
  - 新增 `createActionFrameImportResult(result, animations)`。
  - 新增 `createActionsMutationResult(animations)`。
  - 导入成功时只公开 `result.importedAction`，不继续透传 action import service 的内部生成结果字段。
  - 导入检查失败时保留 `ok: false` 和 `inspectionResult`。
- 更新 `src/main/ipc.js`：
  - `ACTIONS_IMPORT_FRAMES` 使用 adapter 返回导入成功/失败结果。
  - `ACTIONS_SAVE_CONFIG` 使用 adapter 返回 `ActionsMutationResult`。
  - `ACTIONS_DELETE` 使用 adapter 返回 `ActionsMutationResult`。
  - 成功路径仍先调用 `reloadAndSendAnimations`，再读取 preview animations 返回给 Control Center。
- 扩展测试：
  - `tests/main/control-center-adapters.test.js` 覆盖 action adapter shape 和内部字段收敛。
  - `tests/main/ipc-plugin-install.test.js` 覆盖 action import/save/delete IPC handler 返回稳定 contract shape，并验证宠物窗口动画更新通知。

## Review 结论

production review 没有发现需要修复的 P0/P1/P2 问题。

重点复查项：

- Adapter 只做 view-shape 收敛；帧检查、导入、配置更新、删除和 sprite 生成仍由 `actionImportService` 执行。
- save/delete 的历史额外 `result` 字段没有被 Control Center hook、preload 或 shared API contract 消费；收回到 `ActionsMutationResult` 不破坏当前公开契约。
- 导入成功仍返回 `result.importedAction`，保留选中新导入动作和状态文案需要的字段。
- 导入失败仍返回 `inspectionResult`，保留 UI 重新展示检查错误的能力。

## 验收

- `npm run typecheck` 覆盖 action adapter 的 JSDoc contract。
- `ACTIONS_IMPORT_FRAMES` 成功返回 `ok/canceled/result.importedAction/animations`，失败返回 `ok:false/inspectionResult`。
- `ACTIONS_SAVE_CONFIG` 和 `ACTIONS_DELETE` 返回 `ActionsMutationResult`。
- 成功 mutation 继续通知宠物窗口 `PET_ANIMATIONS_CHANGED`。
- `npm run check:syntax`、`npm run test:control-center`、`npm test` 和 `git diff --check` 通过。
- 不改变 API key、插件权限、PetService 单一事实源或 `cat_anime/` 结构。

## 验证

```bash
npm run typecheck
node --test tests/main/control-center-adapters.test.js tests/main/ipc-plugin-install.test.js
npm run check:syntax
npm run test:control-center
npm test
git diff --check
```

当前结果：

- `npm run typecheck`: pass
- targeted adapter/IPC tests: 18/18 pass
- `npm run check:syntax`: pass
- `npm run test:control-center`: 10/10 pass
- `npm test`: 407/407 pass
- `git diff --check`: pass

## 后续约束

1. 下一批 TypeScript 边界应从新的 high-drift service payload 或 evidence/report payload 中选择。
2. Adapter 只能做 view-shape 收敛和安全默认值，业务校验继续留在对应 service。
3. 继续用小型 `@ts-check` islands 扩展覆盖面，避免一次性主进程 TS/ESM rewrite。
