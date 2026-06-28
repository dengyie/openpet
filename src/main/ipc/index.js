const { ipcMain, BrowserWindow, app, dialog, screen } = require('electron')
const { IPC } = require('../../shared/ipc-channels')
const { sanitizeDetails } = require('../services/app-log-service')
const { normalizeCursorSettingsState } = require('../../shared/cursor-library')
const { choosePetContextMenuPoint, estimatePetContextMenuSize } = require('../pet-context-menu')
const { showPetContextMenuWindow } = require('../pet-context-menu-window')
const { calculateBubbleTtlMs } = require('../pet-bubble-chat-window')
const {
  createActionFrameImportResult,
  createActionsMutationResult,
  createAboutInfoView,
  createCatalogBlocklistResult,
  createPetPackMutationResult,
  createPluginMutationResult,
  createServiceStatusView,
  createUpdateCheckView
} = require('../control-center-adapters')
const { findSemanticAction } = require('../services/ai-action-orchestrator')
const { createLocalHttpToken } = require('../services/local-http-service')
const { createPetChatOrchestrationService } = require('../services/pet-chat-orchestration-service')
const { registerPetIpc } = require('./register-pet-ipc')
const { registerChatIpc } = require('./register-chat-ipc')
const { registerSettingsIpc } = require('./register-settings-ipc')
const { registerPluginIpc } = require('./register-plugin-ipc')
const { registerSystemIpc } = require('./register-system-ipc')

const createPetRendererSettings = (settings = {}) => {
  const cursorState = normalizeCursorSettingsState(settings)
  return {
    scale: settings.scale,
    walkSpeed: settings.walkSpeed,
    walkDuration: settings.walkDuration,
    bubbleDuration: settings.bubbleDuration,
    menuPosition: settings.menuPosition || 'auto',
    selectedCursorId: cursorState.selectedCursorId,
    customCursor: cursorState.customCursor,
    customCursors: cursorState.customCursors,
    grounded: Boolean(settings.petBehavior?.grounded),
    home: {
      enabled: Boolean(settings.petBehavior?.home?.enabled),
      radius: settings.petBehavior?.home?.radius || 'medium',
      hasAnchor: Boolean(settings.petBehavior?.home?.anchor)
    },
    petBubbleChat: {
      enabled: settings.petBubbleChat?.enabled !== false,
      autoPopup: settings.petBubbleChat?.autoPopup !== false,
      autoHide: settings.petBubbleChat?.autoHide !== false,
      pinOnInteraction: settings.petBubbleChat?.pinOnInteraction !== false
    }
  }
}

const mergePetSettingsViewIntoHostSettings = (currentSettings = {}, nextSettings = {}) => {
  const currentHome = currentSettings.petBehavior?.home || {}
  const nextHome = nextSettings.home || {}
  const cursorState = normalizeCursorSettingsState({
    selectedCursorId: nextSettings.selectedCursorId ?? currentSettings.selectedCursorId,
    customCursors: nextSettings.customCursors ?? currentSettings.customCursors,
    customCursor: nextSettings.customCursor ?? currentSettings.customCursor
  })
  return {
    ...currentSettings,
    scale: Number(nextSettings.scale ?? currentSettings.scale ?? 1),
    walkSpeed: Number(nextSettings.walkSpeed ?? currentSettings.walkSpeed ?? 2),
    walkDuration: Number(nextSettings.walkDuration ?? currentSettings.walkDuration ?? 15000),
    bubbleDuration: Number(nextSettings.bubbleDuration ?? currentSettings.bubbleDuration ?? 6000),
    menuPosition: nextSettings.menuPosition || currentSettings.menuPosition || 'auto',
    autoStart: Boolean(nextSettings.autoStart ?? currentSettings.autoStart),
    selectedCursorId: cursorState.selectedCursorId,
    customCursors: cursorState.customCursors,
    customCursor: cursorState.customCursor,
    petBubbleChat: {
      ...(currentSettings.petBubbleChat || {}),
      ...(nextSettings.petBubbleChat || {}),
      enabled: nextSettings.petBubbleChat?.enabled ?? currentSettings.petBubbleChat?.enabled ?? true,
      autoPopup: nextSettings.petBubbleChat?.autoPopup ?? currentSettings.petBubbleChat?.autoPopup ?? true,
      autoHide: nextSettings.petBubbleChat?.autoHide ?? currentSettings.petBubbleChat?.autoHide ?? true,
      pinOnInteraction: nextSettings.petBubbleChat?.pinOnInteraction ?? currentSettings.petBubbleChat?.pinOnInteraction ?? true
    },
    petBehavior: {
      ...(currentSettings.petBehavior || {}),
      grounded: Boolean(nextSettings.grounded),
      home: {
        ...(currentHome || {}),
        enabled: Boolean(nextHome.enabled),
        radius: nextHome.radius || currentHome.radius || 'medium',
        anchor: currentHome.anchor || null
      }
    }
  }
}

const normalizeLocalHttpConfig = (currentConfig = {}, nextConfig = {}) => {
  const enabled = Boolean(nextConfig.enabled)
  const token = nextConfig.token || currentConfig.token || (enabled ? createLocalHttpToken() : '')
  return {
    ...currentConfig,
    ...nextConfig,
    host: '127.0.0.1',
    port: Number(nextConfig.port ?? currentConfig.port ?? 0),
    enabled,
    token
  }
}

const sendToPetWindow = (getPetWindow, channel, data) => {
  const petWindow = getPetWindow()
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send(channel, data)
  }
}

const reloadAndSendAnimations = (getPetWindow, petService) => {
  const animations = petService.reloadAnimations()
  sendToPetWindow(getPetWindow, IPC.PET_ANIMATIONS_CHANGED, animations)
  return animations
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

const collectCustomCursorAssetPaths = (cursors = []) => (
  (Array.isArray(cursors) ? cursors : [])
    .map((cursor) => (typeof cursor?.assetPath === 'string' ? cursor.assetPath : ''))
    .filter(Boolean)
)

const sanitizeDiagnosticText = (value) => String(value || '')
  .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-secret]')
  .slice(0, 240)

const registerIpcHandlers = ({
  getPetWindow,
  petService,
  petPackService,
  aiService,
  aiTalkService = null,
  petUtteranceLogService = null,
  petBubbleChatWindowService = null,
  imageGenerationModelService,
  behaviorOrchestratorService,
  pluginService,
  pluginInstallService,
  pluginGithubImportService,
  catalogService,
  localHttpService,
  aboutService,
  actionService,
  actionImportService,
  cursorAssetService,
  appLogService,
  applyWindowScale,
  applyPetViewport = () => {},
  clampToWorkArea,
  getMovementState,
  createSettingsWindow,
  petMovementPolicy,
  petChatWindowService = null,
  browserWindowService = BrowserWindow,
  dialogService = dialog,
  ipcMainService = ipcMain,
  screenService = screen,
  appService = app,
  showContextMenuWindow = showPetContextMenuWindow,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
}) => {
  const state = {
    pendingActionFrameSelection: null
  }

  const sendToControlCenterWindow = (channel, data) => {
    const petWindow = getPetWindow()
    const settingsWindow = petWindow?.settingsWindow
    if (settingsWindow && !settingsWindow.isDestroyed?.()) {
      settingsWindow.webContents?.send?.(channel, data)
    }
  }

  const createSelectionId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

  const showOpenDialogForEvent = (event, options) => {
    const parentWindow = event?.sender && browserWindowService?.fromWebContents?.(event.sender)
    if (parentWindow && !parentWindow.isDestroyed?.()) {
      return dialogService.showOpenDialog(parentWindow, options)
    }
    return dialogService.showOpenDialog(options)
  }

  const recordAppLog = (entry) => {
    try {
      appLogService?.record?.(entry)
    } catch (_) {}
  }

  const requestAppQuit = (source) => {
    recordAppLog({
      scope: 'app',
      level: 'info',
      actor: 'user',
      event: 'app.quit.requested',
      message: 'OpenPet quit requested',
      details: { source }
    })
    appService.quit()
  }

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
  const getActivePetPackId = petChatOrchestrationService.getActivePetPackId
  const recordPetUtterance = petChatOrchestrationService.recordPetUtterance
  const getPetChatState = petChatOrchestrationService.getPetChatState
  const notifyPetChatStateChanged = petChatOrchestrationService.notifyPetChatStateChanged
  const capturePetBubble = petChatOrchestrationService.capturePetBubble
  const assertPetChatReady = petChatOrchestrationService.assertPetChatReady
  const runAiChatRequest = petChatOrchestrationService.runAiChatRequest
  const normalizeMessageText = petChatOrchestrationService.normalizeMessageText
  const chatSanitizeDiagnosticText = petChatOrchestrationService.sanitizeDiagnosticText
  petChatOrchestrationService.bindPetServiceListeners()

  const getPendingActionFrameSelection = (selectionId) => {
    if (!state.pendingActionFrameSelection || state.pendingActionFrameSelection.id !== selectionId) {
      throw new Error('Selected frame folder is no longer available')
    }
    return state.pendingActionFrameSelection
  }

  const inspectPendingActionFrameSelection = async ({ selectionId, actionId }) => {
    const selection = getPendingActionFrameSelection(selectionId)
    const result = await actionImportService.inspectActionFrames({ sourceDir: selection.sourceDir, actionId })
    return { selectionId: selection.id, ...result }
  }

  const context = {
    state,
    getPetWindow,
    petService,
    petPackService,
    aiService,
    aiTalkService,
    petUtteranceLogService,
    petBubbleChatWindowService,
    imageGenerationModelService,
    behaviorOrchestratorService,
    pluginService,
    pluginInstallService,
    pluginGithubImportService,
    catalogService,
    localHttpService,
    aboutService,
    actionService,
    actionImportService,
    cursorAssetService,
    appLogService,
    applyWindowScale,
    applyPetViewport,
    clampToWorkArea,
    getMovementState,
    createSettingsWindow,
    petMovementPolicy,
    petChatWindowService,
    browserWindowService,
    dialogService,
    ipcMainService,
    screenService,
    appService,
    showContextMenuWindow,
    choosePetContextMenuPoint,
    estimatePetContextMenuSize,
    sanitizeDetails,
    helpers: {
      sendToPetWindow,
      sendToControlCenterWindow,
      createSelectionId,
      showOpenDialogForEvent,
      recordAppLog,
      getActivePetPackId,
      recordPetUtterance,
      getPetChatState,
      notifyPetChatStateChanged,
      capturePetBubble,
      assertPetChatReady,
      requestAppQuit,
      runAiChatRequest,
      getPendingActionFrameSelection,
      inspectPendingActionFrameSelection,
      setPendingActionFrameSelection: (selection) => { state.pendingActionFrameSelection = selection },
      clearPendingActionFrameSelection: () => { state.pendingActionFrameSelection = null },
      normalizeMessageText,
      sanitizeDiagnosticText: chatSanitizeDiagnosticText,
      collectCustomCursorAssetPaths,
      createPetRendererSettings,
      mergePetSettingsViewIntoHostSettings,
      normalizeLocalHttpConfig,
      reloadAndSendAnimations,
      createActionFrameImportResult,
      createActionsMutationResult,
      createAboutInfoView,
      createCatalogBlocklistResult,
      createPetPackMutationResult,
      createPluginMutationResult,
      createServiceStatusView,
      createUpdateCheckView,
      createLocalHttpToken
    },
    createPetPackMutationResult
  }

  registerPetIpc(context)
  registerChatIpc(context)
  registerSettingsIpc(context)
  registerPluginIpc(context)
  registerSystemIpc(context)
}

module.exports = {
  createPetRendererSettings,
  normalizeLocalHttpConfig,
  reloadAndSendAnimations,
  registerIpcHandlers,
  triggerAiSemanticAction,
  executeBehaviorDecision
}
