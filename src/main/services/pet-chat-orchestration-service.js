const MAX_PET_BUBBLE_CHARS = 80
const MAX_PET_CHAT_MESSAGES = 100

const normalizeMessageText = (value) => String(value || '').trim().replace(/\s+/g, ' ')

const sanitizeDiagnosticText = (value) => String(value || '')
  .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-secret]')
  .slice(0, 240)

const createEmptyPetBubble = () => ({
  text: '',
  source: '',
  ttlMs: 0,
  updatedAt: ''
})

const normalizePetBubble = (payload = {}) => {
  const text = normalizeMessageText(payload?.text)
  if (!text) return null
  return {
    text,
    source: sanitizeDiagnosticText(payload?.source || ''),
    ttlMs: Number.isFinite(Number(payload?.ttlMs)) ? Number(payload.ttlMs) : 0,
    updatedAt: new Date().toISOString()
  }
}

const createPetBubbleText = (reply, behaviorIntent) => {
  const preferred = normalizeMessageText(behaviorIntent?.bubbleText)
  const text = preferred || normalizeMessageText(reply)
  if (text.length <= MAX_PET_BUBBLE_CHARS) return text
  return `${text.slice(0, MAX_PET_BUBBLE_CHARS - 3)}...`
}

const normalizeBubbleSegments = (segments = [], fallback = '') => {
  const normalized = (Array.isArray(segments) ? segments : [])
    .map((segment) => normalizeMessageText(segment))
    .filter(Boolean)
  if (normalized.length) return normalized
  const fallbackText = normalizeMessageText(fallback)
  return fallbackText ? [fallbackText] : []
}

const sanitizeChatMessages = (messages = []) => (
  (Array.isArray(messages) ? messages : [])
    .filter((message) => ['user', 'assistant'].includes(message?.role) && typeof message?.content === 'string')
    .slice(-MAX_PET_CHAT_MESSAGES)
    .map((message) => ({
      id: typeof message.id === 'string' ? message.id : '',
      role: message.role,
      content: message.content,
      createdAt: typeof message.createdAt === 'string' ? message.createdAt : ''
    }))
)

const createPetChatOrchestrationService = ({
  petService,
  petPackService,
  aiService,
  aiTalkService = null,
  petUtteranceLogService = null,
  petBubbleChatWindowService = null,
  petChatWindowService = null,
  behaviorOrchestratorService = null,
  appLogService = null,
  calculateBubbleTtlMs,
  triggerAiSemanticAction = () => null,
  executeBehaviorDecision = (_petService, decision) => decision,
  sendToPetWindow = () => {},
  getPetWindow = () => null,
  petPlayActionChannel = '',
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
} = {}) => {
  if (!petService) throw new Error('petService is required')
  if (!petPackService) throw new Error('petPackService is required')
  if (!aiService) throw new Error('aiService is required')
  if (typeof calculateBubbleTtlMs !== 'function') throw new Error('calculateBubbleTtlMs is required')

  let lastPetBubble = createEmptyPetBubble()
  let pendingAiBubbleTimers = []
  let petListenersBound = false

  const recordAppLog = (entry) => {
    try {
      appLogService?.record?.(entry)
    } catch (_) {}
  }

  const getActivePetPackId = () => {
    try {
      const activePack = petPackService?.getActivePetPack?.() || petPackService?.getActivePack?.() || {}
      const manifest = activePack?.manifest || {}
      return normalizeMessageText(manifest.id) || 'legacy-cat'
    } catch (_) {
      return 'legacy-cat'
    }
  }

  const recordPetUtterance = (payload = {}) => {
    if (!petUtteranceLogService?.record) return null
    try {
      return petUtteranceLogService.record({
        petPackId: getActivePetPackId(),
        text: payload.text || payload.message || '',
        source: payload.source || '',
        ttlMs: payload.ttlMs
      })
    } catch (error) {
      recordAppLog({
        scope: 'pet-utterance',
        level: 'error',
        actor: 'system',
        event: 'pet-utterance.record.failed',
        message: 'Pet utterance recording failed',
        details: {
          errorName: sanitizeDiagnosticText(error?.name || 'Error'),
          errorMessage: sanitizeDiagnosticText(error?.message)
        }
      })
      return null
    }
  }

  const getPetChatState = () => {
    const windowState = petChatWindowService?.getState?.() || {}
    const config = aiService?.getConfig?.() || {}
    let profile = {}
    let messages = []
    try {
      profile = aiTalkService?.getPersonaProfile?.() || {}
    } catch (_) {}
    try {
      messages = (aiTalkService || aiService)?.getConversation?.('') || []
    } catch (_) {}
    const enabled = Boolean(config.enabled)
    const hasApiKey = Boolean(config.hasApiKey)
    const ready = enabled && hasApiKey
    return {
      available: Boolean(petChatWindowService),
      ...windowState,
      petPack: {
        id: profile.petPackId || '',
        displayName: profile.petPackDisplayName || profile.petPackId || ''
      },
      ai: {
        enabled,
        hasApiKey,
        ready,
        provider: config.provider || '',
        baseUrl: config.baseUrl || '',
        model: config.model || '',
        reason: ready ? '' : (enabled ? '请先在 Control Center 保存 AI API Key' : '请先在 Control Center 启用 AI Provider')
      },
      bubble: lastPetBubble,
      messages: sanitizeChatMessages(messages)
    }
  }

  const notifyPetChatStateChanged = (chatState = getPetChatState()) => {
    petChatWindowService?.sendStateChanged?.(chatState)
  }

  const clearPendingAiBubbleTimers = () => {
    pendingAiBubbleTimers.forEach((timer) => clearTimeoutFn(timer))
    pendingAiBubbleTimers = []
  }

  const dispatchAiBubbleSegments = (segments = []) => {
    clearPendingAiBubbleTimers()
    const normalizedSegments = normalizeBubbleSegments(segments)
    if (!normalizedSegments.length) return null
    let cumulativeDelayMs = 0
    let firstPayload = null
    normalizedSegments.forEach((segment, index) => {
      const ttlMs = calculateBubbleTtlMs({ text: segment })
      const payload = { text: segment, source: 'ai', ttlMs }
      if (index === 0) {
        firstPayload = petService.say(payload)
      } else {
        const timer = setTimeoutFn(() => {
          pendingAiBubbleTimers = pendingAiBubbleTimers.filter((candidate) => candidate !== timer)
          petService.say(payload)
        }, cumulativeDelayMs)
        timer?.unref?.()
        pendingAiBubbleTimers.push(timer)
      }
      cumulativeDelayMs += ttlMs
    })
    return firstPayload
  }

  const capturePetBubble = (payload = {}, { notify = true } = {}) => {
    const bubble = normalizePetBubble(payload)
    if (!bubble) return lastPetBubble
    lastPetBubble = bubble
    if (notify) notifyPetChatStateChanged()
    return lastPetBubble
  }

  const attachPetChatState = (response = {}, bubble = lastPetBubble) => {
    const state = getPetChatState()
    notifyPetChatStateChanged(state)
    return { ...response, bubble, state }
  }

  const assertPetChatReady = () => {
    const config = aiService?.getConfig?.() || {}
    if (!config.enabled) throw new Error('请先在 Control Center 启用 AI Provider')
    if (!config.hasApiKey) throw new Error('请先在 Control Center 保存 AI API Key')
  }

  const runAiChatRequest = async (payload, { source = 'control-center', entrypoint } = {}) => {
    const requestPayload = entrypoint && !payload?.entrypoint ? { ...payload, entrypoint } : payload
    const startedAt = Date.now()
    const messageChars = typeof requestPayload?.message === 'string' ? requestPayload.message.trim().length : 0
    const requestedConversationId = typeof requestPayload?.conversationId === 'string' ? requestPayload.conversationId.slice(0, 160) : ''
    recordAppLog({
      scope: 'ai-chat',
      level: 'info',
      actor: 'user',
      event: 'ai-chat.ipc.received',
      message: 'AI chat IPC request received',
      details: {
        source,
        requestedConversationId,
        messageChars,
        service: aiTalkService ? 'ai-talk' : 'ai'
      }
    })
    try {
      const result = await (aiTalkService || aiService).chat(requestPayload)
      const bubbleSegments = normalizeBubbleSegments(result.bubbleSegments, createPetBubbleText(result.reply, result.behaviorIntent))
      const dispatchedBubble = dispatchAiBubbleSegments(bubbleSegments)
      const currentBubbleText = String(dispatchedBubble?.text || bubbleSegments[0] || '')
      const bubble = currentBubbleText
        ? capturePetBubble({ text: currentBubbleText, source: 'ai', ttlMs: dispatchedBubble?.ttlMs }, { notify: false })
        : lastPetBubble
      if (bubbleSegments.length) {
        recordAppLog({
          scope: 'ai-chat',
          level: 'info',
          actor: 'system',
          event: 'ai-chat.bubble.dispatching',
          message: 'AI chat bubble dispatching to pet service',
          details: { source, textChars: currentBubbleText.length, segmentCount: bubbleSegments.length }
        })
        recordAppLog({
          scope: 'ai-chat',
          level: 'info',
          actor: 'system',
          event: 'ai-chat.bubble.dispatched',
          message: 'AI chat bubble dispatched to pet service',
          details: { source, textChars: currentBubbleText.length, hasTtl: Number.isFinite(Number(dispatchedBubble?.ttlMs)) }
        })
      }
      if (behaviorOrchestratorService?.getConfig?.().enabled) {
        const decision = behaviorOrchestratorService.evaluate({
          reply: result.reply,
          behaviorIntent: result.behaviorIntent,
          actions: petService.getAnimations()?.actions || []
        })
        aiTalkService?.attachBehaviorTrace?.(result.traceId, decision)
        const behavior = executeBehaviorDecision(petService, decision)
        const response = behavior?.matched && behavior.type === 'playAction'
          ? { ...result, behavior, action: behavior }
          : { ...result, behavior }
        recordAppLog({
          scope: 'ai-chat',
          level: 'info',
          actor: 'system',
          event: 'ai-chat.ipc.completed',
          message: 'AI chat IPC request completed',
          details: {
            source,
            requestedConversationId,
            conversationId: result.conversationId || '',
            elapsedMs: Date.now() - startedAt,
            replyChars: String(result.reply || '').length,
            bubbleChars: currentBubbleText.length,
            messageCount: Array.isArray(result.messages) ? result.messages.length : 0,
            behaviorMatched: Boolean(behavior?.matched),
            actionId: behavior?.actionId || ''
          }
        })
        return attachPetChatState(response, bubble)
      }
      const action = triggerAiSemanticAction(petService, result.reply)
      const response = action ? { ...result, action } : result
      recordAppLog({
        scope: 'ai-chat',
        level: 'info',
        actor: 'system',
        event: 'ai-chat.ipc.completed',
        message: 'AI chat IPC request completed',
        details: {
          source,
          requestedConversationId,
          conversationId: result.conversationId || '',
          elapsedMs: Date.now() - startedAt,
          replyChars: String(result.reply || '').length,
          bubbleChars: currentBubbleText.length,
          messageCount: Array.isArray(result.messages) ? result.messages.length : 0,
          actionId: action?.actionId || ''
        }
      })
      return attachPetChatState(response, bubble)
    } catch (error) {
      recordAppLog({
        scope: 'ai-chat',
        level: 'error',
        actor: 'system',
        event: 'ai-chat.ipc.failed',
        message: 'AI chat IPC request failed',
        details: {
          source,
          requestedConversationId,
          elapsedMs: Date.now() - startedAt,
          errorName: sanitizeDiagnosticText(error?.name || 'Error'),
          errorMessage: error?.providerStatus ? 'AI provider returned an error response' : sanitizeDiagnosticText(error?.message),
          providerStatus: error?.providerStatus || 0,
          providerCode: error?.providerCode || ''
        }
      })
      throw error
    }
  }

  const bindPetServiceListeners = () => {
    if (petListenersBound) return
    petListenersBound = true
    petService.onSay?.((payload) => {
      recordPetUtterance(payload)
      capturePetBubble(payload)
      petBubbleChatWindowService?.showMessage?.({
        ...payload,
        petPackId: getActivePetPackId()
      })
    })
    petService.onAction?.((payload) => {
      sendToPetWindow(getPetWindow, petPlayActionChannel, payload)
      petBubbleChatWindowService?.syncToPetWindow?.()
    })
    petService.onEvent?.((payload) => {
      if (payload?.message) {
        const bubble = { text: payload.message, ttlMs: payload.ttlMs, source: payload.source }
        recordPetUtterance(bubble)
        capturePetBubble(bubble)
        petBubbleChatWindowService?.showMessage?.({
          ...bubble,
          petPackId: getActivePetPackId()
        })
      }
    })
  }

  return {
    assertPetChatReady,
    bindPetServiceListeners,
    capturePetBubble,
    getActivePetPackId,
    getPetChatState,
    normalizeMessageText,
    notifyPetChatStateChanged,
    recordAppLog,
    recordPetUtterance,
    runAiChatRequest,
    sanitizeDiagnosticText
  }
}

module.exports = {
  createPetBubbleText,
  createPetChatOrchestrationService,
  createEmptyPetBubble,
  normalizeBubbleSegments,
  normalizeMessageText,
  normalizePetBubble,
  sanitizeChatMessages,
  sanitizeDiagnosticText
}
