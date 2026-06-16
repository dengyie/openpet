# Phase 41 开发文档：AI Behavior Decision Viewer

> 阶段目标：让 AI 行为编排从“服务内部可运行”推进到“用户可解释、可重放、可导出诊断”。
> 范围约束：不暴露 API Key，不把完整 replay 输入导出到诊断文件，不改变 PetService 作为宠物状态唯一入口的约束。

## 1. 背景

Phase 40 补齐了 pet pack 资产生命周期。下一处产品短板是 AI 行为编排的可解释性：服务端已有 rule matching、cooldown、fallback 和 dry-run，但用户只能看到一次 dry-run 结果，不能从 Control Center 解释真实聊天为什么触发、未触发或被 cooldown 拦截。

Phase 41 的目标是把行为决策变成可审计的产品能力。

## 2. 实现记录

- 扩展 `src/main/services/behavior-orchestrator-service.js`：
  - 决策记录新增 `type`、`label`、`kind`、`event`、`inputSummary`、`cooldown`、`fallback`、`blockedReason`、`replay`
  - `evaluate()` 持久化可解释决策摘要
  - 新增 `replayDecision(decisionId)`，基于已存 replay 输入执行 dry-run
  - 新增 `exportDiagnostics()`，导出脱敏 JSON，不包含完整 replay 输入
  - 新增 `clearDecisions()`
- 扩展 IPC / preload：
  - `ai-behavior:replay-decision`
  - `ai-behavior:export-diagnostics`
  - `ai-behavior:clear-decisions`
- 更新 Control Center AI 页：
  - Decisions 列表展示最近行为决策
  - 支持按 decision id replay
  - 支持导出诊断 JSON
  - 支持清空行为决策记录
  - AI 聊天触发行为后会刷新 Decisions 列表，无需重载页面
- 更新 TypeScript 共享契约：
  - `AiBehaviorDecision`
  - `AiBehaviorConfig.decisions`
- 更新 demo API 与 Playwright UI 回归，覆盖 replay/export/clear 和聊天后决策刷新。

## 3. 行为设计

### 3.1 决策记录

记录内容只保留解释和 replay 所需的最小字段：

- 是否命中
- 决策类型
- rule id
- action id / event
- intent
- reason
- input summary
- cooldown / fallback 标记
- blocked reason
- 本地 replay 输入

### 3.2 Replay

Replay 使用服务端已保存的 replay 输入重新执行 dry-run，不触发宠物动作，也不写入新的决策记录。

### 3.3 诊断导出

诊断导出仅包含脱敏决策摘要。完整 replay 输入会被移除，并写入 `replayRedacted: true`，避免导出完整 prompt、回复或潜在敏感上下文。

## 4. 验证

```bash
node --test tests/services/behavior-orchestrator-service.test.js tests/shared/ipc-channels.test.js
npm test
npm run test:control-center
npm run typecheck
npm run check:syntax
npm run pack
git diff --check
```

## 5. 结果

- 用户可以在 Control Center 的 AI 页看到最近行为决策。
- 用户可以 replay 一条已记录决策，判断当前规则是否仍会得到相同结果。
- 用户可以导出脱敏诊断 JSON。
- 用户可以清空决策记录。
- API Key 和完整 replay 输入不暴露给诊断导出。

## 6. 后续工作

1. 如果后续加入更复杂的行为规则编辑器，优先把 JSON textarea 替换为结构化 rule editor。
2. 如果诊断要用于 issue 模板，可以增加“复制诊断摘要”入口，但必须继续保持 replay 输入脱敏。
3. 如果 AI 行为触发链路扩展到插件，应把 plugin id / command id 纳入决策摘要。
