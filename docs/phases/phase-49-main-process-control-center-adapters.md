# Phase 49 开发文档：Main Process Control Center Adapters

## 目标

Phase 49 的目标是把 TypeScript 迁移从 renderer 的 Pane props 边界推进到主进程的 Control Center payload 生产侧。范围限制在 IPC handler 附近的小型 adapter，不做主进程 TypeScript/ESM 重写，不改变 PetService 状态源、插件权限、本地 HTTP API 安全模型或 Control Center UI。

本阶段选择 Service status 和 Catalog blocklist result 作为第一批主进程 adapter：它们都是 Control Center 高频读取/变更 payload，已有 shared contracts，但之前在 `src/main/ipc.js` 里以内联 object 形式拼装。

## 本阶段完成内容

- 新增 `src/main/control-center-adapters.js`：
  - 启用 `// @ts-check`
  - 通过 JSDoc import 消费 `src/shared/openpet-contracts.ts`
  - 导出 `createServiceStatusView`
  - 导出 `createLocalHttpConfigView`
  - 导出 `createLocalHttpRuntimeView`
  - 导出 `createCatalogBlocklistResult`
- 更新 `src/main/ipc.js`：
  - `SERVICE_GET_STATUS`
  - `SERVICE_ROTATE_TOKEN`
  - `SERVICE_REVOKE_MCP_SESSIONS`
  - `SERVICE_SAVE_CONFIG`
  - `CATALOG_ADD_BLOCKLIST`
  - `CATALOG_REMOVE_BLOCKLIST`
- 新增 `tests/main/control-center-adapters.test.js`，覆盖 adapter 默认值、数值归一和 catalog/blocklist result shape。
- 扩展 `tests/main/ipc-plugin-install.test.js`，覆盖 Service status IPC 和 Catalog blocklist IPC 返回 Control Center view result。

## Review 结论

production review 没有发现需要修复的 P0/P1/P2 问题。

重点复查项：

- Adapter 只收敛已有 response shape，没有新增 IPC channel 或 renderer capability。
- Local HTTP token 仍来自既有 service config，Phase 49 没有新增 API key 或插件 secret 暴露路径。
- Catalog blocklist mutation 仍由 `catalogService` 执行，adapter 只包装返回结构。
- `@ts-check` 能让 `npm run typecheck` 覆盖主进程 adapter 的 shared contract drift。

## 验收

- `npm run typecheck` 覆盖 `control-center-adapters.js` 的 JSDoc contract。
- `npm run check:syntax` 完成 Node syntax、typecheck 和 Control Center production build。
- `npm run test:control-center` 保持 10/10。
- `npm test` 保持 399/399。
- `git diff --check` 通过。
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
- targeted adapter/IPC tests: 10/10 pass
- `npm run check:syntax`: pass
- `npm run test:control-center`: 10/10 pass
- `npm test`: 399/399 pass
- `git diff --check`: pass

## 后续约束

1. 下一批主进程 adapter 应优先选择 Plugin mutation result、Pet pack mutation result 或 About/update payload 这类 Control Center 高频 payload。
2. Adapter 只能做 view-shape 收敛和安全默认值，业务校验继续留在对应 service。
3. 不做一次性主进程 TS/ESM rewrite；继续用小型 `@ts-check` islands 扩展覆盖面。
