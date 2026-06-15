# Phase 31 开发文档：Codex Pet Zip 原生导入

> 阶段目标：让 OpenPet 可以直接从 Control Center → Actions → Pet Packs 选择并导入 codex-pets.net 下载的 `.codex-pet.zip` 包。
> 范围约束：不改变 Phase 30 的 Codex pet loader 适配器，不新增生成流程，不放宽 pet pack 安全校验，不修改 `cat_anime/` 结构。

## 1. 背景

codex-pets.net 提供的公开宠物资产实际是 `.codex-pet.zip` 包，内部通常只有 `pet.json` 与 `spritesheet.webp`。Phase 30 已让 OpenPet 能识别 Codex pet manifest，但 Control Center 的 Pet Packs 选择器仍只接受目录，用户需要先手工解压。

Phase 31 把“下载包”这一步补齐：主进程可以直接接收 zip 源，安全解压到临时目录，找到唯一 pet root，再复用现有 pet-pack inspect/import/activate 流程。

## 2. 目标

- Pet Packs 选择器直接支持目录和 zip。
- zip 包在提取前先做安全路径校验，拒绝绝对路径、驱动器路径、`..` 与 NUL 路径。
- 选择后的临时解压目录只保留到导入/清除/过期时刻，避免留下垃圾。
- 导入后保留 `sourcePackageHash`，便于后续生态治理和溯源。

## 3. 实现记录

- 扩展 `src/main/services/pet-pack-service.js`：
  - 新增 `inspectPackSource(sourcePath)`。
  - 支持目录与 zip 源。
  - 新增 zip 安全校验、临时解压、单 root 查找与 pending 清理。
  - `importPack()` 复用 pending 的 `sourcePackageHash`。
- 更新 `src/main/ipc.js`：
  - Pet Packs 选择器允许 `openFile` + `openDirectory`。
  - 对 zip 也走 `inspectPackSource()`。
- 扩展测试：
  - `tests/services/pet-pack-service.test.js` 覆盖 zip inspect/import、unsafe entry、多个 root、清理与过期。
  - `tests/main/ipc-plugin-install.test.js` 覆盖 Pet Packs 原生文件选择器行为。

## 4. 验证

```bash
node --test tests/services/pet-pack-service.test.js tests/main/ipc-plugin-install.test.js
npm test
npm run check:syntax
npm run test:control-center
git diff --check
```

结果：

- `node --test tests/services/pet-pack-service.test.js tests/main/ipc-plugin-install.test.js` 通过，18/18 pass。
- `npm test` 通过，311/311 Node tests pass。
- `npm run check:syntax` 通过。
- `npm run test:control-center` 通过，9/9 Playwright tests pass。
- `git diff --check` 通过。
- 真实 codex-pets.net 样例 `clawd.codex-pet.zip` 通过 `inspectPackSource()` 检查，识别为 `source = "codex-pet"`，`actionCount = 9`，并生成 `sourcePackageHash`。
