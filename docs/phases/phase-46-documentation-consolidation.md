# Phase 46 开发文档：Documentation Consolidation

## 目标

Phase 46 的目标是把活文档从阶段流水账收敛回“当前事实入口”。README 面向用户，HANDOFF 面向接手维护者，`project-context.json` 面向程序读取，历史细节回到 `docs/phases/` 和 `docs/reviews/`。

本阶段不改变产品运行逻辑，不升级平台支持声明。

## 本阶段完成内容

- 将 `docs/project-status-review.md` 从长篇阶段复述改为当前状态快照：
  - 当前产品形态。
  - 验证基线。
  - macOS / Windows / Linux / mobile 支持口径。
  - 剩余工作和文档地图。
- 收敛 `docs/HANDOFF.md`：
  - 缩短 Read First 列表。
  - 去掉重复的 roadmap 指引。
  - 将下一步改成从真实证据工作或 fresh review 启动。
- 收敛 `docs/development-summary.md`：
  - 把“Latest Delivered Changes”改为当前能力摘要。
  - 保留验证基线和仍需关注的开放项。
- 更新 `docs/project-documentation-design.md`：
  - 当前 release truth 使用一致的 macOS-first / Windows not-ready 口径。
  - 当前文档状态改成阶段区间摘要，不再逐阶段复制长列表。
  - 下一步文档优先级改成证据驱动。
- 更新 roadmap / TODO 文档中的当前事实：
  - Phase 44、45、46 状态对齐。
  - TypeScript、plugin author rehearsal、AI behavior、pet pack lifecycle 等已完成能力不再写成缺口。
- 微调 README：
  - TypeScript 描述对齐 Phase 45。
  - 中文 README 补上 plugin ecosystem rules 入口。

## 验收

- README、HANDOFF、development summary、project status、project context 和 v1.1 TODO 使用一致的测试数与平台支持口径。
- `project-status-review.md` 不再承担历史阶段流水账职责。
- 当前状态可在 README / HANDOFF / project-context / project-status 四个入口内快速定位。
- Windows 没有被写成 release-ready。

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

一致性扫描覆盖：

- Phase 46 不再被写成待执行。
- 测试数量保持 `394/394 Node` 和 `10/10 UI`。
- Windows 没有被写成 release-ready。
- Packaged runtime evidence 不再被写成完全缺失。

## 后续约束

1. 后续 live docs 只更新当前事实、命令、支持口径、测试数或下一步。
2. 阶段历史只写入 `docs/phases/` 和 `docs/reviews/`。
3. 新证据产生前，不改变 release readiness wording。
