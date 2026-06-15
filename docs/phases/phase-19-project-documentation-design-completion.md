# Phase 19 开发文档：项目文档设计完善

> 阶段目标：把项目文档设计从规则集合完善为可执行的文档操作模型，确保后续阶段能稳定保持目标、范围、证据和交接一致。
> 范围约束：本阶段只调整文档治理与当前状态指针；不改变运行时代码、测试数量、插件安全边界、macOS release baseline、Windows release-ready 状态或移动端范围。

## 1. 背景

OpenPet 的最初目标已经固定为“可扩展、可分发、可运营的 Electron 桌面宠物平台”。当前项目已有 Control Center、PetService 单一状态源、插件隔离、pet pack、AI、本地 HTTP/MCP、macOS 发布基线，以及 Windows 打包/CI/签名策略/冒烟证据工具链。

在 Phase 15 之后，`docs/project-documentation-design.md` 已经能说明项目目标、文档分层、macOS/Windows 支持口径和 phase/review 模板。但随着后续阶段继续增加 release evidence、IPC 烟测和 UI 自动化，文档本身还需要更明确地回答：一个阶段怎样算完成、哪些文档是 live status、哪些文档是历史记录、什么时候该创建新文档，以及如何避免把 Windows tooling baseline 误写成 release-ready。

## 2. 目标

- 补充文档 operating model，明确每个阶段从目标、实现、phase doc、review、live docs、验证到独立提交的闭环。
- 补充文档生命周期分类，区分 live status、normative rules、technical reference、evidence 和 historical audit。
- 补充仓库文档拓扑，帮助新接手者理解 README、AGENTS、HANDOFF、release docs、phase/review docs 的关系。
- 补充 Phase completion contract、done criteria、anti-patterns 和 documentation decision records。
- 同步当前状态文档，把最新阶段指向 Phase 19，同时保持测试数量和 Windows release 状态不变。

## 3. 非目标

- 不新增或修改运行时代码。
- 不新增测试文件，不改变 `260 Node + 9 UI` 当前测试口径。
- 不宣称 Windows 已 release-ready。
- 不把移动端纳入当前产品范围。
- 不重写历史 phase 文档中的旧验证数字。

## 4. 实现记录

### 4.1 文档设计增强

`docs/project-documentation-design.md` 新增：

- Documentation operating model：定义项目文档作为“项目记忆系统”的阶段闭环。
- 文档生命周期表：live status、normative rules、technical reference、evidence、historical audit。
- Repository documentation topology：说明持久文档目录的职责分布。
- Phase completion contract：列出阶段完成所需的 scope、implementation、verification、review、live docs、handoff 和 commit boundary 证据。
- Phase numbering and naming：约束 Phase N 文件命名和小数 phase 使用场景。
- Documentation done criteria：给文档相关阶段提供收口检查。
- Documentation anti-patterns：列出常见漂移来源。
- Documentation decision records：记录当前长期有效的文档决策。
- Current documentation status：从 Phase 18 更新到 Phase 19。

### 4.2 Live docs 同步

同步更新当前状态入口：

- `README.md` / `README.zh-CN.md`：Phase 列表新增 Phase 19。
- `docs/HANDOFF.md`：当前状态、入口顺序、最近变更和最新阶段指针更新为 Phase 19。
- `docs/project-status-review.md`：状态摘要和阶段表新增 Phase 19。
- `docs/productization-roadmap.md`：收尾状态和阶段表新增 Phase 19。

## 5. 文档更新

本阶段没有新增新的长期文档类别；它增强现有 owner 文档，并用 phase/review pair 记录本次治理变化。文档主事实归属保持不变：

- 原始项目目标与文档治理：`docs/project-documentation-design.md`
- 当前状态：`docs/HANDOFF.md` / `docs/project-status-review.md`
- 产品化阶段历史：`docs/productization-roadmap.md`
- 支持声明和 release gate：`docs/desktop-release-design.md` / `docs/release-checklist.md`

## 6. 验证

本阶段计划执行文档向校验：

```bash
rg -n "Phase 19|phase-19|Windows supported|Windows ready|SmartScreen trusted|Mobile roadmap" README.md README.zh-CN.md AGENTS.md docs
rg -n "260 Node|260/260|9 UI|9/9|release-ready|release ready" README.md README.zh-CN.md AGENTS.md docs/HANDOFF.md docs/project-status-review.md docs/productization-roadmap.md docs/project-documentation-design.md
git diff --check
```

最终结果记录在 paired review 文档中。

## 7. 残留风险

- 本阶段让文档治理更完整，但不替代真实 Windows smoke、签名产物验证或 packaged picker evidence 归档。
- 文档体系仍需要后续阶段持续遵守；如果实现阶段跳过 phase/review/verification/commit boundary，治理文档本身不能自动防止漂移。
- 真实插件生态冷启动仍未解决，后续仍应推进示例插件和插件开发教程。

## 8. 结果

Phase 19 将 OpenPet 的文档设计补成可执行操作模型：后续贡献者可以从目标锚点出发，按固定阶段闭环推进功能、证据、review 和交接，而不会把 Windows evidence baseline、移动端范围或历史 phase 记录写偏。
