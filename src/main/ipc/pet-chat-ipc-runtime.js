const { IPC } = require('../../shared/ipc-channels')
const { calculateBubbleTtlMs } = require('../pet-bubble-chat-window')
const { findSemanticAction } = require('../services/ai-action-orchestrator')
const { createPetChatOrchestrationService } = require('../services/pet-chat-orchestration-service')

const sendToPetWindow = (getPetWindow, channel, data) => {
  const petWindow = getPetWindow()
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send(channel, data)
  }
}

const triggerAiSemanticAction = (petService, reply) => {
  const action = findSemanticAction(reply, petService.getAnimations()?.actions || [])
  if (!action) return null
  try {
    return { ...action, ...petService.playAction({ actionId: action.actionId, source: 'ai' }) }
  } catch (error) {
    return { ...action, error: error.message }
  }
}

const executeBehaviorDecision = (petService, decision) => {
  if (!decision?.matched) return decision
  if (decision.type === 'say') return { ...decision, result: petService.say({ text: decision.text, source: 'ai:behavior' }) }
  if (decision.type === 'setEvent') return { ...decision, result: petService.setEvent({ event: decision.event, message: decision.message, source: 'ai:behavior' }) }
  if (decision.type === 'playAction') return { ...decision, ...petService.playAction({ actionId: decision.actionId, source: 'ai:behavior' }) }
  return decision
}

const sanitizeDiagnosticText = (value) => String(value || '')
  .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-secret]')
  .slice(0, 240)

const createPetChatIpcRuntime = ({
  petService,
  petPackService,
  aiService,
  aiTalkService = null,
  petUtteranceLogService = null,
  petBubbleChatWindowService = null,
  petChatWindowService = null,
  behaviorOrchestratorService,
  appLogService,
  getPetWindow,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
}) => {
  const petChatOrchestrationService = createPetChatOrchestrationService({
    petService,
    petPackService,
    aiService,
    aiTalkService,
    petUtteranceLogService,
    petBubbleChatWindowService,
    petChatWindowService,
    behaviorOrchestratorService,
    appLogService,
    calculateBubbleTtlMs,
    triggerAiSemanticAction,
    executeBehaviorDecision,
    sendToPetWindow,
    getPetWindow,
    petPlayActionChannel: IPC.PET_PLAY_ACTION,
    setTimeoutFn,
    clearTimeoutFn
  })

  petChatOrchestrationService.bindPetServiceListeners()

  return {
    assertPetChatReady: petChatOrchestrationService.assertPetChatReady,
    capturePetBubble: petChatOrchestrationService.capturePetBubble,
    getActivePetPackId: petChatOrchestrationService.getActivePetPackId,
    getPetChatState: petChatOrchestrationService.getPetChatState,
    normalizeMessageText: petChatOrchestrationService.normalizeMessageText,
    notifyPetChatStateChanged: petChatOrchestrationService.notifyPetChatStateChanged,
    recordPetUtterance: petChatOrchestrationService.recordPetUtterance,
    runAiChatRequest: petChatOrchestrationService.runAiChatRequest,
    sanitizeDiagnosticText: petChatOrchestrationService.sanitizeDiagnosticText
  }
}

module.exports = {
  createPetChatIpcRuntime,
  executeBehaviorDecision,
  sanitizeDiagnosticText,
  sendToPetWindow,
  triggerAiSemanticAction
}
