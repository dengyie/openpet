const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createEmptyPetBubble,
  createPetChatOrchestrationService
} = require('../../src/main/services/pet-chat-orchestration-service')

const createService = (overrides = {}) => {
  const stateChanges = []
  const bubbleMessages = []
  const petWindowMessages = []
  const logs = []
  const utterances = []
  const sayCalls = []
  const timers = []

  let onSayHandler = null
  let onActionHandler = null
  let onEventHandler = null

  const petService = {
    onSay: (handler) => { onSayHandler = handler },
    onAction: (handler) => { onActionHandler = handler },
    onEvent: (handler) => { onEventHandler = handler },
    getAnimations: () => ({ actions: [] }),
    say: (payload) => {
      sayCalls.push(payload)
      return payload
    },
    ...overrides.petService
  }

  const service = createPetChatOrchestrationService({
    petService,
    petPackService: {
      getActivePetPack: () => ({ manifest: { id: 'service-pack' } }),
      ...overrides.petPackService
    },
    aiService: {
      getConfig: () => ({ enabled: true, hasApiKey: true, provider: 'openai-compatible', baseUrl: 'http://127.0.0.1', model: 'gpt-5.5' }),
      getConversation: () => [],
      chat: async () => ({ reply: 'fallback reply' }),
      ...overrides.aiService
    },
    aiTalkService: {
      getPersonaProfile: () => ({ petPackId: 'service-pack', petPackDisplayName: 'Service Pack' }),
      getConversation: () => [],
      chat: async () => ({
        conversationId: 'control-center:service-pack:main',
        reply: 'hello there',
        messages: [{ id: 'a1', role: 'assistant', content: 'hello there', createdAt: '2026-06-28T00:00:00.000Z' }]
      }),
      ...overrides.aiTalkService
    },
    petUtteranceLogService: {
      record: (payload) => {
        utterances.push(payload)
        return payload
      },
      ...overrides.petUtteranceLogService
    },
    petBubbleChatWindowService: {
      showMessage: (payload) => {
        bubbleMessages.push(payload)
        return { visible: true, message: payload }
      },
      syncToPetWindow: () => ({ visible: true }),
      ...overrides.petBubbleChatWindowService
    },
    petChatWindowService: {
      getState: () => ({ visible: true, hasWindow: true, alwaysOnTop: true }),
      sendStateChanged: (payload) => stateChanges.push(payload),
      ...overrides.petChatWindowService
    },
    behaviorOrchestratorService: overrides.behaviorOrchestratorService || { getConfig: () => ({ enabled: false }) },
    appLogService: {
      record: (entry) => logs.push(entry),
      ...overrides.appLogService
    },
    calculateBubbleTtlMs: ({ text }) => Math.max(1200, String(text || '').length * 100),
    triggerAiSemanticAction: overrides.triggerAiSemanticAction || (() => null),
    executeBehaviorDecision: overrides.executeBehaviorDecision || ((_petService, decision) => decision),
    sendToPetWindow: (_getPetWindow, channel, payload) => petWindowMessages.push({ channel, payload }),
    getPetWindow: () => ({ isDestroyed: () => false, webContents: { send: () => {} } }),
    petPlayActionChannel: 'pet:play-action',
    setTimeoutFn: (callback, delay) => {
      const timer = { callback, delay, unref() {} }
      timers.push(timer)
      return timer
    },
    clearTimeoutFn: (timer) => {
      const index = timers.indexOf(timer)
      if (index >= 0) timers.splice(index, 1)
    },
    ...overrides.serviceArgs
  })

  return {
    service,
    stateChanges,
    bubbleMessages,
    petWindowMessages,
    logs,
    utterances,
    sayCalls,
    timers,
    emitSay: (payload) => onSayHandler?.(payload),
    emitAction: (payload) => onActionHandler?.(payload),
    emitEvent: (payload) => onEventHandler?.(payload)
  }
}

test('getPetChatState exposes readiness, bubble, and sanitized messages', () => {
  const { service } = createService({
    aiService: {
      getConfig: () => ({ enabled: false, hasApiKey: false, provider: 'openai-compatible', baseUrl: 'http://127.0.0.1:8317/v1', model: 'gpt-5.5' })
    },
    aiTalkService: {
      getPersonaProfile: () => ({ petPackId: 'service-pack', petPackDisplayName: 'Service Pack' }),
      getConversation: () => [
        { id: 'm1', role: 'assistant', content: 'hello', createdAt: '2026-06-28T00:00:00.000Z' },
        { id: 'm2', role: 'system', content: 'hidden', createdAt: '2026-06-28T00:00:01.000Z' }
      ]
    }
  })

  assert.deepEqual(service.getPetChatState(), {
    available: true,
    visible: true,
    hasWindow: true,
    alwaysOnTop: true,
    petPack: { id: 'service-pack', displayName: 'Service Pack' },
    ai: {
      enabled: false,
      hasApiKey: false,
      ready: false,
      provider: 'openai-compatible',
      baseUrl: 'http://127.0.0.1:8317/v1',
      model: 'gpt-5.5',
      reason: '请先在 Control Center 启用 AI Provider'
    },
    bubble: createEmptyPetBubble(),
    messages: [{ id: 'm1', role: 'assistant', content: 'hello', createdAt: '2026-06-28T00:00:00.000Z' }]
  })
})

test('runAiChatRequest dispatches first bubble immediately and schedules later segments', async () => {
  const conversationMessages = [
    { id: 'u1', role: 'user', content: 'split this', createdAt: '2026-06-28T00:00:00.000Z' },
    { id: 'a1', role: 'assistant', content: '第一句很短。第二句也很短。最后一句收尾。', createdAt: '2026-06-28T00:00:01.000Z' }
  ]
  const { service, sayCalls, timers, stateChanges } = createService({
    aiTalkService: {
      getConversation: () => conversationMessages,
      chat: async () => ({
        conversationId: 'control-center:service-pack:main',
        reply: '第一句很短。第二句也很短。最后一句收尾。',
        bubbleSegments: ['第一句很短。', '第二句也很短。', '最后一句收尾。'],
        messages: conversationMessages
      })
    }
  })

  const result = await service.runAiChatRequest({ message: 'split this' }, { source: 'pet-chat' })

  assert.equal(result.reply, '第一句很短。第二句也很短。最后一句收尾。')
  assert.deepEqual(result.state.messages, conversationMessages)
  assert.equal(result.bubble.text, '第一句很短。')
  assert.deepEqual(sayCalls.map((item) => item.text), ['第一句很短。'])
  assert.equal(timers.length, 2)
  assert.equal(stateChanges.length, 1)

  timers[0].callback()
  timers[1].callback()

  assert.deepEqual(sayCalls.map((item) => item.text), ['第一句很短。', '第二句也很短。', '最后一句收尾。'])
})

test('bindPetServiceListeners records say events and supports legacy getActivePack providers', () => {
  const { service, bubbleMessages, utterances, stateChanges, emitSay } = createService({
    petPackService: {
      getActivePetPack: undefined,
      getActivePack: () => ({ manifest: { id: 'alt-pack' } })
    }
  })

  service.bindPetServiceListeners()
  service.bindPetServiceListeners()
  emitSay({ text: '刚刚打了个招呼', ttlMs: 1800, source: 'pet:event' })

  assert.equal(service.getPetChatState().bubble.text, '刚刚打了个招呼')
  assert.equal(stateChanges.length, 1)
  assert.deepEqual(bubbleMessages, [{
    text: '刚刚打了个招呼',
    ttlMs: 1800,
    source: 'pet:event',
    petPackId: 'alt-pack'
  }])
  assert.deepEqual(utterances, [{
    petPackId: 'alt-pack',
    text: '刚刚打了个招呼',
    source: 'pet:event',
    ttlMs: 1800
  }])
})

