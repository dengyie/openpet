const { ipcMain, BrowserWindow, app, dialog, screen } = require('electron')
const { choosePetContextMenuPoint, estimatePetContextMenuSize } = require('../pet-context-menu')
const { showPetContextMenuWindow } = require('../pet-context-menu-window')
const {
  createIpcContext,
  reloadAndSendAnimations,
  createPetRendererSettings,
  normalizeLocalHttpConfig
} = require('./ipc-context-builder')
const {
  executeBehaviorDecision,
  triggerAiSemanticAction
} = require('./pet-chat-ipc-runtime')
const { registerPetIpc } = require('./register-pet-ipc')
const { registerChatIpc } = require('./register-chat-ipc')
const { registerSettingsIpc } = require('./register-settings-ipc')
const { registerPluginIpc } = require('./register-plugin-ipc')
const { registerSystemIpc } = require('./register-system-ipc')

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
  const context = createIpcContext({
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
    setTimeoutFn,
    clearTimeoutFn
  })

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
