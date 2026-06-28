# Real Provider Chat UX Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate and harden the transparent bubble chat against a real provider-backed conversation flow so mini input, reply cadence, bubble dwell time, and desktop feel all meet the current product direction.

**Architecture:** Keep `AiTalkService` as the single chat brain, `ipc.js` as the single request/bubble dispatch path, and `PetService.say()` as the only speech ingress. This milestone adds provider-backed verification hooks, tightens bubble timing behavior only where evidence shows friction, and captures manual acceptance evidence without introducing a second chat surface or new product scope.

**Tech Stack:** Electron, Node native test runner, React + Vite Control Center, OpenAI-compatible provider bridge, JSONL app logs, local smoke scripts

## Execution Closeout

状态：Closed on 2026-06-28

本计划对应的 milestone 已按 3 个阶段收口：

- Phase 1 完成：真实 provider bubble acceptance telemetry 已落地。
  - commit: `c13f6e9b`
- Phase 2 完成：AI dialogue bubble dwell time 已根据证据延长。
  - commit: `95c230dc`
- Phase 3 完成：人工验收 runbook 已补齐，并完成真实 provider 烟测与桌面交互验收。
  - commit: `827cac0b`

关键证据：

- 真实 provider 烟测结果已验证 `requestId` / `providerLatencyMs` / `bubbleStateVisible`。
- 桌面交互已验证双击宠物打开 Bubble Chat、迷你输入可发送、真实回复能回到透明气泡。
- 回归验证已覆盖：
  - `tests/main/pet-chat-ipc.test.js`
  - `tests/main/pet-bubble-chat-window.test.js`
  - `tests/scripts/run-ai-talk-local-smoke.test.js`
  - `npm run check:syntax`

备注：

- 本计划中的 Task 3“失败路径与诊断”在当前分支已有有效覆盖，不需要为本 milestone 再开新阶段。
- 正式人工验收入口文档见：
  - `docs/superpowers/specs/2026-06-28-real-provider-chat-acceptance-runbook.md`

---

## Milestone Contract

Milestone：真实 provider 聊天体验 + 人工交互验收闭环

目标：在真实 provider 环境下把透明 BubbleChatWindow 的迷你输入、回复节奏、气泡停留时间和桌面交互体感收口到可交付状态。

P0/P1 范围：
- 真实 provider 迷你输入发送链路可重复验证。
- BubbleChatWindow 回复开始、完成、失败、停留时长、pin/interaction 的日志和烟测证据完整。
- 根据真实运行证据收紧气泡 TTL / 自动隐藏 / 交互保持策略。
- 形成可执行的人工验收 runbook，并产出最小必要的证据捕获入口。

不做的 P2/P3：
- 流式回复。
- 多会话、多主题、可视化自定义。
- 插件 intent 权限扩展。
- 新的聊天产品形态。

Manual-required：
- 真实 provider API key 与目标模型可用性。
- 人工桌面体验判断，包括跨屏、贴边、长时间驻留、被打扰程度。

阶段上限：3

阶段拆分：
- Phase 1：provider-backed smoke + telemetry completeness
- Phase 2：bubble cadence / dwell tuning from evidence
- Phase 3：manual acceptance runbook + evidence capture closeout

验收标准：
- `npm start` 可启动。
- 真实 provider 下 BubbleChat mini input 能完成一次成功对话并留下结构化日志。
- 失败路径也能给出结构化可定位证据。
- 自动隐藏、pin、交互保持策略与当前产品方向一致。
- `npm run check:syntax` 和本计划涉及的回归测试通过。

停止条件：
- 当前 milestone 的 P0/P1 达成并有代码/日志/手工证据支撑。
- 或外部 provider/人工验收成为唯一剩余项，此时输出有条件可交付并停止。

## File Map

### Runtime / main process

- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/main/ipc.js`
  - Shared send path for bubble mini input, trace/log correlation, and user-facing error propagation.
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/main/pet-bubble-chat-window.js`
  - TTL, pin, interaction, unseen state, dwell-time behavior, and bubble item refresh rules.
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/main/services/ai-talk-service.js`
  - Provider-backed reply timing metadata and trace correlation, not new product logic.
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/main/services/ai-service.js`
  - Only if needed to expose safe timing/diagnostic fields already implied by provider responses.
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/main/services/app-log-service.js`
  - Keep logs structured and redacted while ensuring acceptance events are queryable.

### Bubble UI / desktop surfaces

- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/main/pet-bubble-chat/renderer.js`
  - Mini input send UX, pending/error feedback, interaction/pin transitions.
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/main/pet-bubble-chat/styles.css`
  - Only if evidence shows readability or click-target problems.
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/main/pet-chat-window.js`
  - Only if the full chat handoff or extended view behavior regresses during provider verification.

### Settings / smoke / docs

- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/control-center/src/panes/PetPane.tsx`
  - Only if a required acceptance toggle or explanatory state is missing from the current UI.
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/control-center/src/panes/AiPane.tsx`
  - Only if real-provider readiness or failure diagnostics are not exposed clearly enough.
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/scripts/run-ai-talk-local-smoke.js`
  - Extend smoke output to capture provider-backed bubble-chat acceptance evidence.
- Create: `/Users/mango/.codex/worktrees/454e/OpenPet/docs/superpowers/specs/2026-06-28-real-provider-chat-acceptance-runbook.md`
  - Manual acceptance checklist and evidence schema.

### Tests

- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/tests/main/pet-chat-ipc.test.js`
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/tests/main/pet-bubble-chat-window.test.js`
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/tests/main/pet-bubble-chat-renderer.test.js`
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/tests/scripts/run-ai-talk-local-smoke.test.js`
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/tests/renderer-bubble-duration.test.js`

---

### Task 1: Provider-Backed Bubble Chat Smoke And Trace Correlation

**Files:**
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/main/ipc.js`
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/main/services/ai-talk-service.js`
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/scripts/run-ai-talk-local-smoke.js`
- Test: `/Users/mango/.codex/worktrees/454e/OpenPet/tests/main/pet-chat-ipc.test.js`
- Test: `/Users/mango/.codex/worktrees/454e/OpenPet/tests/scripts/run-ai-talk-local-smoke.test.js`

- [ ] **Step 1: Write the failing IPC test for provider-backed bubble send evidence**

```js
test('pet bubble chat send records provider timing evidence with correlated request id', async () => {
  const result = await invokeBubbleSend({
    message: '你好',
    providerResult: {
      reply: '我在',
      bubbleSegments: ['我在'],
      trace: { requestId: 'req-1', latencyMs: 820 }
    }
  })

  assert.equal(result.requestId, 'req-1')
  assert.equal(result.state.bubble.text, '我在')
  assert.equal(logEvents.some((entry) => entry.event === 'pet-bubble-chat.message.completed' && entry.details.requestId === 'req-1'), true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/main/pet-chat-ipc.test.js`
Expected: FAIL because the current send path does not yet guarantee the exact correlated acceptance evidence expected by the new assertion.

- [ ] **Step 3: Implement the minimal IPC and AI talk correlation change**

```js
const requestId = result?.requestId || result?.trace?.requestId || createRequestId()
appLogService.info('pet-bubble-chat.message.completed', {
  requestId,
  providerLatencyMs: Number.isFinite(result?.trace?.latencyMs) ? result.trace.latencyMs : null,
  bubbleSegmentCount: Array.isArray(result?.bubbleSegments) ? result.bubbleSegments.length : 0
})
```

- [ ] **Step 4: Extend the smoke script output with bubble acceptance evidence**

```js
const acceptance = {
  requestId: result.requestId || '',
  replyChars: result.reply.length,
  bubbleSegmentCount: Array.isArray(result.bubbleSegments) ? result.bubbleSegments.length : 0,
  providerLatencyMs: Number.isFinite(result.trace?.latencyMs) ? result.trace.latencyMs : null
}
summary.bubbleAcceptance = acceptance
```

- [ ] **Step 5: Run the targeted tests**

Run: `node --test tests/main/pet-chat-ipc.test.js tests/scripts/run-ai-talk-local-smoke.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc.js src/main/services/ai-talk-service.js scripts/run-ai-talk-local-smoke.js tests/main/pet-chat-ipc.test.js tests/scripts/run-ai-talk-local-smoke.test.js
git commit -m "feat: add provider-backed bubble chat acceptance evidence"
```

### Task 2: Bubble Dwell-Time And Reply-Cadence Tuning

**Files:**
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/main/pet-bubble-chat-window.js`
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/main/pet-bubble-chat/renderer.js`
- Test: `/Users/mango/.codex/worktrees/454e/OpenPet/tests/main/pet-bubble-chat-window.test.js`
- Test: `/Users/mango/.codex/worktrees/454e/OpenPet/tests/main/pet-bubble-chat-renderer.test.js`
- Test: `/Users/mango/.codex/worktrees/454e/OpenPet/tests/renderer-bubble-duration.test.js`

- [ ] **Step 1: Write the failing dwell-time tests from current UX rules**

```js
test('bubble chat keeps provider replies visible longer than one-line notices and preserves pin while interacting', () => {
  const state = manager.showMessage({
    text: '这是一条较长的真实回复，会比提示停留更久。',
    source: 'ai',
    ttlMs: undefined
  })

  assert.equal(state.message.kind, 'dialogue')
  assert.equal(state.message.ttlMs >= 9000, true)
  manager.setInteracting(true, { source: 'test-hover' })
  assert.equal(manager.getState().visible, true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/main/pet-bubble-chat-window.test.js tests/renderer-bubble-duration.test.js`
Expected: FAIL because the current TTL heuristic is not yet aligned with the new acceptance thresholds.

- [ ] **Step 3: Implement minimal TTL and interaction tuning**

```js
const ttlMs = item.kind === 'dialogue'
  ? calculateBubbleTtlMs({ text: item.text, minMs: 9000, maxMs: 22000 })
  : calculateBubbleTtlMs({ text: item.text, minMs: 4500, maxMs: 9000 })

if (state.pinned || state.interacting || state.sending) return state
scheduleAutoHide(ttlMs)
```

- [ ] **Step 4: Surface sending / waiting / failure rhythm in the bubble renderer without adding a new mode**

```js
sendButton.disabled = sending || !draft.trim()
statusNode.textContent = error ? error : (sending ? '回复中…' : '')
root.dataset.sending = sending ? 'true' : 'false'
```

- [ ] **Step 5: Run the targeted tests**

Run: `node --test tests/main/pet-bubble-chat-window.test.js tests/main/pet-bubble-chat-renderer.test.js tests/renderer-bubble-duration.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/pet-bubble-chat-window.js src/main/pet-bubble-chat/renderer.js tests/main/pet-bubble-chat-window.test.js tests/main/pet-bubble-chat-renderer.test.js tests/renderer-bubble-duration.test.js
git commit -m "fix: tune bubble chat dwell time and reply cadence"
```

### Task 3: Real Provider Failure Path And Operator-Facing Diagnostics

**Files:**
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/main/ipc.js`
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/main/services/app-log-service.js`
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/src/control-center/src/panes/AiPane.tsx`
- Test: `/Users/mango/.codex/worktrees/454e/OpenPet/tests/main/pet-chat-ipc.test.js`
- Test: `/Users/mango/.codex/worktrees/454e/OpenPet/tests/control-center/control-center-smoke.spec.js`

- [ ] **Step 1: Write the failing failure-path test**

```js
test('pet bubble chat send exposes recoverable provider failure with request id and without leaking raw provider data', async () => {
  const result = await invokeBubbleSendFailure({
    message: '你好',
    providerError: new Error('upstream timeout')
  })

  assert.equal(result.ok, false)
  assert.match(result.error, /timeout/i)
  assert.equal(result.requestId.length > 0, true)
  assert.equal(logEvents.some((entry) => String(entry.details?.rawPrompt || '') !== ''), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/main/pet-chat-ipc.test.js`
Expected: FAIL because the current failure shape is not yet strict enough for acceptance evidence.

- [ ] **Step 3: Implement the minimal failure-shape tightening**

```js
return {
  ok: false,
  requestId,
  error: safeMessage || 'Bubble chat send failed',
  recoverable: true
}
```

- [ ] **Step 4: Expose a concise acceptance-facing diagnostic in the AI pane**

```tsx
<p className="field-hint">
  {chatProviderReady
    ? '已就绪，可用于迷你聊天验收。'
    : 'Provider 未就绪；真实迷你聊天验收前先保存并测试配置。'}
</p>
```

- [ ] **Step 5: Run the targeted tests**

Run: `node --test tests/main/pet-chat-ipc.test.js`
Run: `npm run test:control-center -- --grep "bubble chat"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc.js src/main/services/app-log-service.js src/control-center/src/panes/AiPane.tsx tests/main/pet-chat-ipc.test.js tests/control-center/control-center-smoke.spec.js
git commit -m "fix: harden provider failure diagnostics for bubble chat acceptance"
```

### Task 4: Manual Acceptance Runbook And Evidence Capture

**Files:**
- Create: `/Users/mango/.codex/worktrees/454e/OpenPet/docs/superpowers/specs/2026-06-28-real-provider-chat-acceptance-runbook.md`
- Modify: `/Users/mango/.codex/worktrees/454e/OpenPet/scripts/run-ai-talk-local-smoke.js`
- Test: `/Users/mango/.codex/worktrees/454e/OpenPet/tests/scripts/run-ai-talk-local-smoke.test.js`

- [ ] **Step 1: Write the runbook with exact manual scenarios**

```md
## Scenario 1: Mini input success
1. 启动 `npm start`
2. 双击宠物，打开 `OpenPet Bubble Chat`
3. 输入“你好”，按 Enter
4. 记录：
   - requestId
   - providerLatencyMs
   - bubble 可见时长是否足够读完
   - 是否需要 pin 才能完成复制
```

- [ ] **Step 2: Add smoke output fields for manual evidence attachment**

```js
summary.manualAcceptanceTemplate = {
  bubbleVisibleLongEnough: null,
  inputUsable: null,
  desktopFeelNotes: '',
  requestId: summary.bubbleAcceptance?.requestId || ''
}
```

- [ ] **Step 3: Run the smoke-script test**

Run: `node --test tests/scripts/run-ai-talk-local-smoke.test.js`
Expected: PASS

- [ ] **Step 4: Record the exact manual acceptance commands in the doc**

```bash
npm start
npm run smoke:ai-provider -- --base-url http://127.0.0.1:8317/v1 --api-key-env OPENPET_OPENAI_API_KEY --chat-model gpt-5.5 --output tmp/provider-smoke.json
node scripts/run-ai-talk-local-smoke.js --message "你好" --output-dir tmp/ai-talk-acceptance
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-06-28-real-provider-chat-acceptance-runbook.md scripts/run-ai-talk-local-smoke.js tests/scripts/run-ai-talk-local-smoke.test.js
git commit -m "docs: add real provider bubble chat acceptance runbook"
```

## Self-Review

- Spec coverage: this plan covers provider-backed mini input, structured diagnostics, TTL/cadence tuning, and manual acceptance evidence. It deliberately does not cover streaming, theme customization, or multi-conversation expansion.
- Placeholder scan: no TBD or deferred placeholders remain in the task steps.
- Type consistency: the plan keeps `requestId`, `bubbleSegments`, `providerLatencyMs`, `recoverable`, `pinned`, and `interacting` naming consistent with the current codebase vocabulary.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-28-real-provider-chat-ux-acceptance.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
