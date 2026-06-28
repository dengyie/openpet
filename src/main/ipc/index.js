const { ipcMain, BrowserWindow, app, dialog, screen } = require('electron')
const { IPC } = require('../../shared/ipc-channels')
const { sanitizeDetails } = require('../services/app-log-service')
const { choosePetContextMenuPoint, estimatePetContextMenuSize } = require('../pet-context-menu')
const { showPetContextMenuWindow } = require('../pet-context-menu-window')
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
const { createLocalHttpToken } = require('../services/local-http-service')
const {
  collectCustomCursorAssetPaths,
  createPetRendererSettings,
  mergePetSettingsViewIntoHostSettings,
  normalizeLocalHttpConfig
} = require('./pet-settings-adapter')
const {
  createPetChatIpcRuntime,
  executeBehaviorDecision,
  sanitizeDiagnosticText,
  sendToPetWindow,
  triggerAiSemanticAction
} = require('./pet-chat-ipc-runtime')
const { registerPetIpc } = require('./register-pet-ipc')
const { registerChatIpc } = require('./register-chat-ipc')
const { registerSettingsIpc } = require('./register-settings-ipc')
const { registerPluginIpc } = require('./register-plugin-ipc')
const { registerSystemIpc } = require('./register-system-ipc')

const reloadAndSendAnimations = (getPetWindow, petService) => {
  const animations = petService.reloadAnimations()
  sendToPetWindow(getPetWindow, IPC.PET_ANIMATIONS_CHANGED, animations)
  return animations
}

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

  const petChatRuntime = createPetChatIpcRuntime({
    petService,
    petPackService,
    aiService,
    aiTalkService,
    petUtteranceLogService,
    petBubbleChatWindowService,
    petChatWindowService,
    behaviorOrchestratorService,
    appLogService,
    getPetWindow,
    setTimeoutFn,
    clearTimeoutFn
  })

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
      getActivePetPackId: petChatRuntime.getActivePetPackId,
      recordPetUtterance: petChatRuntime.recordPetUtterance,
      getPetChatState: petChatRuntime.getPetChatState,
      notifyPetChatStateChanged: petChatRuntime.notifyPetChatStateChanged,
      capturePetBubble: petChatRuntime.capturePetBubble,
      assertPetChatReady: petChatRuntime.assertPetChatReady,
      requestAppQuit,
      runAiChatRequest: petChatRuntime.runAiChatRequest,
      getPendingActionFrameSelection,
      inspectPendingActionFrameSelection,
      setPendingActionFrameSelection: (selection) => { state.pendingActionFrameSelection = selection },
      clearPendingActionFrameSelection: () => { state.pendingActionFrameSelection = null },
      normalizeMessageText: petChatRuntime.normalizeMessageText,
      sanitizeDiagnosticText: petChatRuntime.sanitizeDiagnosticText,
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
