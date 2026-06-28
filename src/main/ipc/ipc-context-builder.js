const { IPC } = require('../../shared/ipc-channels')
const { sanitizeDetails } = require('../services/app-log-service')
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
  sendToPetWindow
} = require('./pet-chat-ipc-runtime')

const reloadAndSendAnimations = (getPetWindow, petService) => {
  const animations = petService.reloadAnimations()
  sendToPetWindow(getPetWindow, IPC.PET_ANIMATIONS_CHANGED, animations)
  return animations
}

const createSendToControlCenterWindow = (getPetWindow) => {
  return (channel, data) => {
    const petWindow = getPetWindow()
    const settingsWindow = petWindow?.settingsWindow
    if (settingsWindow && !settingsWindow.isDestroyed?.()) {
      settingsWindow.webContents?.send?.(channel, data)
    }
  }
}

const createShowOpenDialogForEvent = ({ browserWindowService, dialogService }) => {
  return (event, options) => {
    const parentWindow = event?.sender && browserWindowService?.fromWebContents?.(event.sender)
    if (parentWindow && !parentWindow.isDestroyed?.()) {
      return dialogService.showOpenDialog(parentWindow, options)
    }
    return dialogService.showOpenDialog(options)
  }
}

const createRecordAppLog = (appLogService) => {
  return (entry) => {
    try {
      appLogService?.record?.(entry)
    } catch (_) {}
  }
}

const createRequestAppQuit = ({ appService, recordAppLog }) => {
  return (source) => {
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
}

const createPendingActionFrameSelectionHelpers = ({ state, actionImportService }) => {
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

  return {
    getPendingActionFrameSelection,
    inspectPendingActionFrameSelection,
    setPendingActionFrameSelection: (selection) => { state.pendingActionFrameSelection = selection },
    clearPendingActionFrameSelection: () => { state.pendingActionFrameSelection = null }
  }
}

const createIpcContext = (dependencies) => {
  const {
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
    browserWindowService,
    dialogService,
    ipcMainService,
    screenService,
    appService,
    showContextMenuWindow,
    choosePetContextMenuPoint,
    estimatePetContextMenuSize,
    setTimeoutFn,
    clearTimeoutFn
  } = dependencies

  const state = {
    pendingActionFrameSelection: null
  }

  const sendToControlCenterWindow = createSendToControlCenterWindow(getPetWindow)
  const showOpenDialogForEvent = createShowOpenDialogForEvent({ browserWindowService, dialogService })
  const recordAppLog = createRecordAppLog(appLogService)
  const requestAppQuit = createRequestAppQuit({ appService, recordAppLog })

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

  const actionFrameSelectionHelpers = createPendingActionFrameSelectionHelpers({
    state,
    actionImportService
  })

  return {
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
      createSelectionId: () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
      ...actionFrameSelectionHelpers,
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
}

module.exports = {
  createIpcContext,
  reloadAndSendAnimations,
  createPetRendererSettings,
  normalizeLocalHttpConfig
}
