# Phase 40 开发文档：Pet Pack Export and Provenance

> 阶段目标：把 Pet pack 从“可导入”推进到“可导出、可审计、可重新导入”，并把版本冲突与来源溯源显式展示给 Control Center。
> 范围约束：本阶段不改变 `cat_anime/` 结构，不引入远端 marketplace，不把 built-in pack 当作可导出的用户资产。

## 1. 背景

Phase 39 已完成插件 sandbox 评估，当前插件 trust model 不再处于未定义状态。接下来，OpenPet 的资产侧短板更明显：pet packs 已能导入和切换，但还不能形成完整生命周期。用户无法清楚知道 pack 从哪里来、是什么许可、当前版本与已安装版本如何冲突，也不能把已安装的用户 pack 导出后重新导入。

Phase 40 的目标是把 pet pack 做成可携带、可审计、可复用的资产，而不是只能单向落盘的安装产物。

## 2. 实现记录

- 新增 provenance 规范化：
  - `src/main/pet-pack/schema.js`
  - `src/main/pet-pack/codex-pet.js`
  - `src/shared/openpet-contracts.ts`
- 新增版本冲突判断：
  - `new-install`
  - `upgrade`
  - `downgrade`
  - `same-version`
- 更新 `src/main/services/pet-pack-service.js`：
  - import 时保存 `sourceUrl` / `assetAuthor` / `license` / `licenseUrl` / `importedAt` / `originalFormat`
  - inspection 结果中显式返回 `conflict`
  - 新增 `exportPack(packId, outputDir)`，导出已安装用户 pack 为 `.openpet-pet.zip`
  - built-in pack 禁止导出
- 更新 Control Center：
  - `src/control-center/src/panes/ActionsPane.jsx`
  - `src/control-center/src/hooks/useActionsPane.js`
  - `src/control-center/src/api/control-center-api.js`
  - `control-center-preload.js`
  - `src/main/ipc.js`
  - `src/shared/ipc-channels.js`
  - `src/shared/ipc-channels.ts`
- 补充测试：
  - `tests/services/pet-pack-service.test.js`
  - `tests/pet-pack/schema.test.js`
  - `tests/pet-pack/loader.test.js`
  - `tests/main/ipc-plugin-install.test.js`

## 3. 行为设计

### 3.1 导出行为

- 仅允许导出用户安装的 pet pack。
- 导出格式为 `<pack-id>-<version>.openpet-pet.zip`。
- 导出目录由 Control Center 调用原生目录选择器确认。
- built-in pack 和 bundled pack 不参与用户导出流程。

### 3.2 冲突行为

- 新安装：显示 `new-install`。
- 已安装且版本更高：显示 `downgrade`。
- 已安装且版本更低：显示 `upgrade`。
- 版本相同：显示 `same-version`。
- 所有非新安装冲突都要求复核提示，不直接假定覆盖安全。

### 3.3 溯源行为

pack manifest 与安装 metadata 共同保存：

- `sourceUrl`
- `assetAuthor`
- `license`
- `licenseUrl`
- `importedAt`
- `originalFormat`

Control Center 在检查整包时展示这些字段，供用户确认来源和许可。

## 4. 验证

```bash
node --test tests/main/ipc-plugin-install.test.js
node --test tests/services/pet-pack-service.test.js
node --test tests/pet-pack/schema.test.js tests/pet-pack/loader.test.js tests/shared/ipc-channels.test.js
npm test
npm run test:control-center
npm run typecheck
npm run check:syntax
npm run pack
```

## 5. 结果

- 用户安装的 pack 可以导出并重新导入。
- provenance 字段在 import / list / inspection 流程中保持可见。
- Control Center 能显示冲突决策和导出入口。
- built-in pack 仍然只读。

## 6. 后续工作

1. 如果后续要支持更细的 overwrite 确认流程，再把冲突决策拆成 UI 二次确认。
2. 如果 catalog 继续扩展，优先补 pack provenance 与 license metadata 的展示规范。
3. 如果导出路径未来扩展为批量或云端同步，先重新审视 pack provenance 的可信边界。
