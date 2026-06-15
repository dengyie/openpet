# Phase 32 开发文档：内置 Codex Pets 基础资产

> 阶段目标：从 codex-pets.net 选取一小组可爱、非 Codex 形象重叠的宠物资产，作为 OpenPet 的内置基础 pet packs。
> 范围约束：不改 `cat_anime/` 结构，不引入生成流水线，不放宽 pet pack 安全校验，内置资产只作为只读 bundled packs 提供。

## 1. 背景

Phase 30 和 Phase 31 已让 OpenPet 可以原生导入 Codex-compatible 宠物目录和 `.codex-pet.zip` 包。但产品缺少一组开箱即用的基础宠物资产，用户首次打开时仍主要看到 legacy cat。

本阶段从 codex-pets.net 的热门资产中挑选了更适合作为产品基础的三只：

- `doro`
- `duodong`
- `chispa`

排除项包括与 Codex/助手形象过近的资产、明显人物/名人风格资产，以及 `celeb` 标签的资产。目标是把“能导入”推进到“产品开箱可用”。

## 2. 目标

- 将精选 Codex pet 资产打包进应用仓库，作为只读 built-in packs。
- Control Center 的 Pet Packs 列表直接显示这些内置资产。
- 内置资产可被启用，但不能删除。
- 内置资产的 blocklist / policy 检查与已安装包保持一致。
- 打包产物包含内置资产。

## 3. 实现记录

- 新增 `assets/pet-packs/`：
  - `doro`
  - `duodong`
  - `chispa`
- 扩展 `src/main/services/pet-pack-service.js`：
  - 扫描 bundled packs
  - 将 bundled packs 暴露为 `source = "built-in"`
  - 允许切换到 bundled pack
  - 阻止删除 bundled pack
  - 激活时补充 content hash policy 检查
- 更新 `package.json`：
  - Electron builder file list 加入 `assets/pet-packs/**/*`
- 扩展测试：
  - `tests/services/pet-pack-service.test.js`
  - `tests/pet-pack/bundled-assets.test.js`

## 4. 验证

```bash
node --test tests/services/pet-pack-service.test.js tests/pet-pack/bundled-assets.test.js
npm test
npm run check:syntax
npm run test:control-center
git diff --check
```

结果将在本次阶段完成后补录。

