# Phase 30 开发文档：Codex Pet 原生导入

> 阶段目标：让 OpenPet 可以通过现有 Control Center → Actions → Pet Packs 流程原生导入 Codex-compatible `pet.json` + `spritesheet.webp` 宠物目录。
> 范围约束：不生成 Codex pet，不复制 hatch-pet 生成流水线，不改变 `cat_anime/` 素材结构，不放宽 pet pack 路径安全校验。

## 1. 背景

官方 hatch-pet 工作流输出的宠物目录包含 `pet.json` 和 `spritesheet.webp`。其中 atlas 固定为 8 列、9 行、单格 `192x208`，总尺寸 `1536x1872`；9 行分别对应 `idle`、`running-right`、`running-left`、`waving`、`jumping`、`failed`、`waiting`、`running` 和 `review`。

OpenPet Phase 2 已具备 pet pack inspect/import/activate 生命周期，但原生 manifest 要求每个 action 自带 sprite、frameCount、frameMs、frameWidth、frameHeight。Phase 30 在不新增 UI 分支的前提下，让 loader 自动识别 Codex pet manifest 并归一化为 OpenPet runtime action。

## 2. 目标

- 识别 `pet.json` 中的 `spritesheetPath`，走 Codex pet adapter。
- 校验 `spritesheetPath` 是安全相对路径，且 WebP atlas 尺寸为 `1536x1872`。
- 将 9 行 Codex 状态映射为 OpenPet actions，并保留 `frameRow`、`frameColumn`、`frameDurations` 和 `atlas` 元数据。
- 桌宠 renderer 和 Control Center action preview 支持二维 atlas 裁切和逐帧时长播放。
- 复用现有 PetPackService inspect/import/install/activate 流程。

## 3. 非目标

- 不实现 Codex pet 图片生成、repair、contact sheet QA 或 hatch-pet deterministic pipeline。
- 不支持任意 atlas 尺寸或用户自定义行表。
- 不把 Codex pet 导入与插件权限、AI key、MCP、本地 HTTP 暴露面混在一起。
- 不声明所有第三方 Codex pet 视觉质量都已验证；本阶段只验证格式和运行时导入播放能力。

## 4. 实现记录

- 新增 `src/main/pet-pack/codex-pet.js`：
  - 定义 Codex atlas 常量和 9 行状态表。
  - 解析 WebP `VP8X` / `VP8 ` / `VP8L` 尺寸头。
  - 校验 `spritesheetPath` 安全性和固定 atlas 尺寸。
  - 归一化 Codex manifest 为 OpenPet manifest。
- 扩展 `src/main/pet-pack/loader.js`：
  - `pet.json` 带 `spritesheetPath` 时返回 `source.type = "codex-pet"`。
  - 旧 OpenPet pet pack manifest 仍走原路径。
- 扩展 `src/main/pet-pack/schema.js`：
  - 保留 atlas row/column 和 per-frame duration metadata。
- 扩展 `renderer.js`：
  - 支持 `frameRow` / `frameColumn` / `atlas` 计算 `background-position-x/y`。
  - 使用 `frameDurations` 进行逐帧 `setTimeout` 调度。
- 扩展 `src/control-center/src/panes/ActionsPane.jsx`：
  - Action preview 支持 atlas row crop 和逐帧 duration。
- 扩展测试：
  - `tests/pet-pack/loader.test.js` 覆盖 Codex pet 识别、unsafe path、错误尺寸。
  - `tests/pet-pack/schema.test.js` 覆盖 atlas metadata normalization。
  - `tests/services/pet-pack-service.test.js` 覆盖 Codex pet inspect/import。

## 5. 验证

```bash
node --test tests/pet-pack/schema.test.js tests/pet-pack/loader.test.js tests/services/pet-pack-service.test.js
npm test
npm run check:syntax
npm run test:control-center
git diff --check
```

结果：

- `node --test tests/pet-pack/schema.test.js tests/pet-pack/loader.test.js tests/services/pet-pack-service.test.js` 通过，23/23 pass。
- `npm test` 通过，305/305 Node tests pass。
- `npm run check:syntax` 通过。
- `npm run test:control-center` 通过，9/9 Playwright tests pass。
- `git diff --check` 通过。

## 6. 残留风险

- 当前只支持官方 hatch-pet 固定 atlas contract；如果未来 Codex pet contract 改成可变尺寸或新增状态，需要更新 adapter。
- 测试使用最小 WebP header fixture 校验尺寸解析与导入路径，不等同于真实视觉 QA。
- Control Center 仍显示通用 pet pack 信息，没有专门展示 Codex atlas 行表；这是可用性增强项，不阻塞原生导入。
