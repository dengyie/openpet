# OpenPet 全流程日志系统补全开发文档

日期：2026-06-29
适用 Milestone：全流程日志系统补全
适用分支：`codex/provider-smoke-live-docs-context`
当前基线：`e75621fd` (`feat(phase-1): normalize ai talk adapter boundary`)

## 目标

本 milestone 的目标不是“再多打一批日志”，而是把 OpenPet 现有多条产品链路收口成一套可调试、可回放、可验证、可长期演进的结构化日志系统。

这套日志系统需要满足四个核心目标：

1. 出问题时，能快速回答“哪条链路出错了”。
2. 用户反馈模糊现象时，能快速回答“当前 active pet-pack / persona / conversation / requestId 到底是什么”。
3. 自动化 smoke、人工验收、后续 release evidence 都能复用同一套日志字段，而不是每次重新拼装证据。
4. 不把 API key、完整 prompt、隐藏人格提示词、原始 provider 回包、原始本地路径等敏感内容写进默认日志。

## 非目标

- 本阶段不做远程日志上报。
- 本阶段不做日志可视化后台。
- 本阶段不做多文件分流、日志轮转归档系统重写。
- 本阶段不为了日志补全而改 AI Talk、Bubble Chat、Plugin Host 的产品行为。
- 本阶段不引入埋点平台、OpenTelemetry、Sentry 或第三方 observability SDK。

## 当前现状

当前 OpenPet 已有结构化 JSONL 日志基础：

- 主日志文件通过 `AppLogService` 写入 `openpet-app.jsonl`
- 每条日志包含：
  - `id`
  - `timestamp`
  - `level`
  - `actor`
  - `scope`
  - `event`
  - `message`
  - `details`

当前已覆盖的主要范围：

- `app`: 生命周期与退出请求
- `settings`: 部分设置变更、cursor import
- `ai-provider`: provider 请求与 connection test
- `ai-chat`: IPC 收到、完成、失败、bubble dispatch
- `ai-talk`: chat 开始/完成/失败，memory extraction，memory 删除/清空
- `pet-bubble-chat`: message started/completed/displayed、window 状态、interaction/hit-test
- `pet-chat`: message started/completed、window opened/hidden/focused
- `pet-renderer`: 部分动作与 passthrough 变化
- `actions`: trigger proposal / trigger rule 变更
- `image-generation`: provider request / health / queue

这说明系统并不是“没有日志”，而是已经有一套基础骨架，但覆盖仍然是局部的，调试体验不连续。

## 当前核心问题

### 1. 链路连续性不够

很多功能点有局部日志，但缺少“同一条用户动作在多个模块中的完整事件链”。

典型例子：

- AI persona profile 读取、draft 生成、override 保存没有形成完整日志链。
- active pet-pack 切换对 chat/persona/memory 刷新的影响缺少统一日志。
- 插件触发、HTTP 触发、MCP 触发进入 `PetService.say()` 后，来源链路不够完整。

结果是：

- 看到现象，但不能快速定位是 UI、IPC、service、store、provider 还是 pet surface 层出了问题。

### 2. 核心业务实体缺少稳定摘要

当前不少日志能看到 `requestId`，但缺少其它调试必需的稳定摘要：

- `petPackId`
- `petPackDisplayName`
- `conversationId`
- `personaHash`
- `effectivePersonaName`
- `messageCount`
- `sourceSurface`
- `actionId`
- `displayMode`

这导致某些问题只能靠猜，而不能直接从日志回答。

### 3. Persona / Memory / Pack 切换调试能力不足

这是当前最明确的缺口：

- `getPersonaProfile()`
- `generatePersonaDraft()`
- `savePersonaOverride()`
- active pack changed -> persona reload
- active pack changed -> conversation rebound
- active pack changed -> memory profile reload

这些操作现在缺少明确、稳定、可对账的日志事件。

### 4. 事件命名和字段口径还不完全统一

当前事件命名大致可用，但还没有一份“系统级规范”约束：

- 哪些事件必须有 `requestId`
- 哪些事件必须有 `petPackId`
- 哪些事件要打 started/completed/failed 三联
- 哪些事件只记录摘要，哪些允许记录计数

没有统一规范，后续继续加日志时容易再次漂移。

### 5. 默认脱敏规则还不够覆盖 AI Talk 新场景

当前 `sanitizeDetails()` 只过滤部分 path 类型字段，仍然不足以覆盖以下高风险场景：

- 完整 `compiledSystemPrompt`
- `rawProviderReply`
- persona draft 原始模型返回
- memory 原始候选文本
- 本地文件绝对路径
- token / secret-like 字段

本 milestone 需要把“日志字段设计”本身纳入脱敏边界，而不是依赖最后一层兜底。

## 设计原则

### 1. 结构化优先

日志必须优先服务排障和自动化，而不是服务肉眼阅读。

要求：

- 事件名稳定
- 字段名稳定
- 计数和枚举优先
- message 只做简短摘要，不承载关键调试数据

### 2. 一条动作，一条链路

对用户可感知动作，尽量形成：

- `started`
- `completed`
- `failed`

三段式事件链。

如果没有必要，不要在链路中间堆过多近义事件；但关键 owner 交接点必须有日志。

### 3. 摘要优先，不写敏感原文

默认日志只写摘要，不写原文。

例如：

- 写 `messageChars`
- 不写完整用户消息
- 写 `effectivePersonaName`
- 不写完整 `compiledSystemPrompt`
- 写 `memoryContextCount`
- 不写完整 memory 内容

### 4. 以 requestId / conversationId / petPackId 为主键

多模块排障时，默认用以下键关联：

- `requestId`
- `conversationId`
- `petPackId`

对于非聊天链路，再补：

- `pluginId`
- `commandId`
- `sessionId`
- `runId`
- `actionId`

### 5. 日志必须服务真实人工调试

每新增一组日志，都应该能直接回答以下问题之一：

- 当前激活的是谁？
- 当前请求走到了哪一步？
- 结果有没有真正保存？
- UI 看到的数据是哪一版？
- 为什么这次行为和上一次不同？

如果回答不了，就不是高价值日志。

## 统一事件模型

所有日志继续使用现有 entry shape：

```json
{
  "id": "uuid",
  "timestamp": "2026-06-29T12:00:00.000Z",
  "level": "info",
  "actor": "system",
  "scope": "ai-talk",
  "event": "ai-talk.chat.started",
  "message": "AI talk chat started",
  "details": {}
}
```

### 建议字段分层

`details` 内字段按三层组织：

1. 关联键
   - `requestId`
   - `petPackId`
   - `conversationId`
   - `pluginId`
   - `commandId`
   - `runId`

2. 状态摘要
   - `messageChars`
   - `replyChars`
   - `messageCount`
   - `bubbleChars`
   - `bubbleSegmentCount`
   - `memoryContextCount`
   - `historyCount`
   - `actionId`
   - `displayMode`

3. 调试摘要
   - `provider`
   - `model`
   - `personaHash`
   - `effectivePersonaName`
   - `packPersonaName`
   - `overrideFieldCount`
   - `elapsedMs`
   - `status`
   - `errorCode`

### 事件命名规范

- 格式：`{scope}.{entity}.{action}.{state}`
- 例子：
  - `ai-talk.persona.profile.loaded`
  - `ai-talk.persona.override.saved`
  - `ai-talk.memory.profile.loaded`
  - `pet-bubble-chat.message.displayed`
  - `plugin.command.run.failed`

例外：

- 已经稳定存在且外部脚本依赖的事件，优先兼容，不强行改名。

## 全流程覆盖矩阵

### A. App 与窗口生命周期

Owner：

- `main.js`
- `app-lifecycle-logger.js`
- `pet-chat-window.js`
- `pet-bubble-chat-window.js`

需要覆盖：

- app ready / before-quit / will-quit
- settings window open/close
- pet chat window open/focus/hide/bounds-save/topmost-change
- bubble chat window open-requested/opened/open-skipped/hidden
- single-instance second-launch 聚焦行为

### B. Active Pet-Pack 主链路

Owner：

- `PetPackService`
- `ipc.js`
- `AiTalkService`
- `useAiPane.ts`

需要新增或补强：

- active pet-pack changed
- pack list loaded
- active pack applied to AI pane
- active pack rebound to conversation
- active pack rebound to memory profile
- active pack rebound to persona profile

关键字段：

- `previousPetPackId`
- `nextPetPackId`
- `nextPetPackDisplayName`
- `conversationId`
- `personaHash`

### C. Persona 全链路

Owner：

- `AiTalkService`
- `AiTalkStore`
- `ipc.js`
- Control Center AI pane

必须新增：

- `ai-talk.persona.profile.loaded`
- `ai-talk.persona.override.saved`
- `ai-talk.persona.override.cleared`
- `ai-talk.persona.draft.started`
- `ai-talk.persona.draft.completed`
- `ai-talk.persona.draft.failed`

建议字段：

- `petPackId`
- `petPackDisplayName`
- `packPersonaName`
- `effectivePersonaName`
- `overrideFieldCount`
- `overrideFields`
- `instructionChars`
- `provider`
- `model`
- `elapsedMs`

禁止写入：

- 完整 persona prompt
- 完整 system prompt
- raw provider reply
- hidden prompt

### D. Memory 全链路

Owner：

- `AiTalkService`
- `AiTalkStore`
- Control Center AI pane

当前已有部分日志，但仍需补足：

- `ai-talk.memory.profile.loaded`
- `ai-talk.memory.deleted`
- `ai-talk.memory.delete-missed`
- `ai-talk.memory.pet-pack-cleared`
- `ai-talk.memory.extraction.scheduled`
- `ai-talk.memory.extraction.completed`
- `ai-talk.memory.extraction.failed`
- `ai-talk.memory.context-used`

建议字段：

- `petPackId`
- `conversationId`
- `memoryId`
- `scope`
- `globalMemoryCount`
- `petPackMemoryCount`
- `recentJobsCount`
- `appliedCount`
- `filteredCount`
- `errorCode`

禁止写入：

- 原始 memory 文本正文
- 原始 memory extraction 模型输出
- 原始 filtered candidate 文本

### E. AI Chat 与 Provider 全链路

Owner：

- `ipc.js`
- `AiTalkService`
- `AiService`
- `pet-bubble-chat-window.js`
- `pet-chat-window.js`

现有覆盖较好，但需要统一字段口径：

- `requestId`
- `source`
- `entrypoint`
- `petPackId`
- `conversationId`
- `messageChars`
- `replyChars`
- `providerLatencyMs`
- `elapsedMs`
- `bubbleChars`
- `bubbleSegmentCount`
- `actionId`
- `displayMode`

特别需要保留：

- `ai-chat.ipc.received`
- `ai-talk.chat.started`
- `ai-provider.request.started`
- `ai-provider.request.completed|failed`
- `ai-talk.chat.completed|failed`
- `ai-chat.bubble.dispatching`
- `pet-bubble-chat.message.displayed`
- `ai-chat.ipc.completed|failed`

### F. Bubble / Pet Chat 桌面交互链路

Owner：

- `pet-bubble-chat-window.js`
- `pet-chat-window.js`
- 对应 renderer

需要补强：

- mini input expand/collapse
- pin/unpin
- auto-hide scheduled / canceled / expired
- user interaction freezes ttl
- open full chat from bubble
- full chat reopen from double click

关键字段：

- `requestId`
- `source`
- `interactive`
- `pinned`
- `ttlMs`
- `reason`
- `itemCount`

### G. Pet 动作与说话汇总链路

Owner：

- `PetService`
- `ActionService`
- `PetUtteranceLogService`
- `pet renderer`

目标：

- 所有 `petService.say()` 都能有一致的 source summary
- 所有 `playAction()` 都能带 source 与 result
- bubble chat / pet chat / plugin / http / mcp / ai behavior 的说话来源可以统一追踪

建议新增或补强：

- `pet.say.requested`
- `pet.say.applied`
- `pet.action.requested`
- `pet.action.applied`
- `pet.event.set`

### H. Plugin / HTTP / MCP / Creator Studio 外部入口

Owner：

- `PluginService`
- `LocalHttpService`
- `McpTransportService`
- Creator Studio host bridge

本 milestone 要求的不是把所有外部入口都重写，而是补足“进入主流程时的入口摘要日志”。

关键目标：

- 能知道这次 `say` / `chat` / `action` / `generate` 是谁触发的
- 能知道是哪条 bridge/command/session 在调用

建议字段：

- `sourceSurface`
- `pluginId`
- `commandId`
- `bridgePermission`
- `httpRoute`
- `mcpMethod`
- `sessionId`
- `runId`

## 脱敏与安全规则

### 默认禁止写入日志的内容

- API key
- Bearer token
- secret ref 原文
- 完整 prompt
- 完整 system prompt
- hidden prompt
- raw provider reply
- 本地绝对路径
- 原始 memory 文本
- 原始消息正文
- 任何用户可能误贴进来的长段敏感信息

### 允许写入的摘要内容

- 字符数
- 数组长度
- 布尔状态
- 枚举值
- pack / conversation / request 标识
- 脱敏后的 provider endpoint
- hash
- 截断后的错误码和失败类型

### `sanitizeDetails()` 增强方向

- 扩展敏感 key 黑名单：
  - `rawProviderReply`
  - `compiledSystemPrompt`
  - `compiledPersonaPrompt`
  - `hiddenPrompt`
  - `apiKey`
  - `authorization`
  - `token`
  - `memoryText`
- 对可疑长字符串增加最大长度限制
- 对 URL 保留 host/path 摘要，去掉 query/hash/userinfo

## 日志字段版本化

为避免后续 smoke 脚本和 release evidence 因字段漂移而断裂，本 milestone 引入轻量日志 contract 约束：

- 保持顶层 entry shape 不变
- 对关键事件建立“必填字段最小集合”
- 在测试中校验这些字段存在且类型稳定

不单独新增大而重的日志 schema version 字段；当前阶段优先通过测试和文档维持 contract。

## 分阶段开发建议

### Phase 1: 日志 contract 与 AI Talk 核心缺口补全

范围：

- `AppLogService` 脱敏增强
- AI persona / memory / active pack 日志补齐
- AI chat / provider 字段统一
- 对应单测与 IPC 测试

验收：

- 能从日志直接回答“当前是谁、保存了什么、当前会话是谁、为什么这次结果不同”

### Phase 2: Bubble / Pet Chat / PetService 行为链路补全

范围：

- bubble 显示/隐藏/定格/过期
- pet chat open/hide/reopen
- `PetService.say()` / `playAction()` / `setEvent()` 统一来源摘要

验收：

- 任意一条桌面对话都能从发送到气泡展示串起完整链路

### Phase 3: 外部入口与证据工具对齐

范围：

- plugin / HTTP / MCP / Creator Studio 的入口摘要日志
- smoke / release evidence 对日志字段的依赖固化

验收：

- 外部入口问题可通过日志快速判定来源与调用链

## 测试策略

### 单元测试

- `tests/services/app-log-service.test.js`
  - 脱敏 key 过滤
  - 长字符串截断
  - JSONL 写入 contract

- `tests/services/ai-talk-service.test.js`
  - persona profile / override / draft / memory profile 事件
  - active pack 切换事件

- `tests/services/pet-service.test.js`
  - `say` / `playAction` / `setEvent` 日志摘要

### IPC / 主进程测试

- `tests/main/ipc-plugin-install.test.js`
  - persona / memory / AI chat IPC 事件链断言

- 新增或扩展：
  - `tests/main/pet-chat-ipc.test.js`
  - `tests/main/pet-bubble-chat-window.test.js`

### Smoke 与手动验证

- 真实 provider chat smoke 继续复用 `requestId`
- 增加 persona save / draft / active-pack 切换的日志人工检查 runbook
- 明确 bubble displayed / persona saved / memory cleared 的日志证据入口

## 验收标准

满足以下条件，才能认为“日志系统补全”达标：

1. persona / memory / active-pack 切换问题可以仅靠日志定位到 service owner。
2. AI chat 从 UI 到 provider 到 bubble/pet-chat surface 的链路能靠 `requestId` 串起来。
3. `PetService.say()` 的来源可以区分 AI / plugin / http / mcp / user interaction。
4. 默认日志不出现完整 prompt、API key、hidden prompt、raw provider reply、原始 memory 文本。
5. 关键日志字段有测试守护，不因后续重构悄悄漂移。

## 停止条件

本轮文档阶段在以下条件达成后停止：

1. 日志系统目标、范围、事件模型、脱敏规则、阶段拆分、测试策略已经明确落文。
2. 文档能直接作为下一轮代码实现的执行依据。
3. 不在文档阶段顺手扩展到代码实现。

