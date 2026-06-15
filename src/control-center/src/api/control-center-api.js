import { cloneAiConfig, cloneServiceStatus, cloneSettings, defaultAboutInfo, defaultActionsConfig, defaultAiConfig, defaultCatalog, defaultPetPacks, defaultServiceStatus, defaultSettings, defaultUpdateCheck } from '../lib/defaults.js'

const createDemoInspection = (actionId = 'wave') => ({
  canceled: false,
  selectionId: 'demo-selection',
  folderName: 'demo-wave',
  actionId,
  inspection: {
    valid: true,
    frameCount: 2,
    maxWidth: 8,
    maxHeight: 8,
    frames: [
      { fileName: '01_no_bg.png', width: 8, height: 8, hasAlpha: true },
      { fileName: '02_no_bg.png', width: 8, height: 8, hasAlpha: true }
    ],
    skippedFiles: [],
    errors: [],
    warnings: []
  }
})

const demoStorageKey = 'openpet.controlCenter.demoState'

const createDefaultDemoState = () => ({
  settings: cloneSettings(defaultSettings),
  aiConfig: cloneAiConfig(defaultAiConfig),
  serviceStatus: cloneServiceStatus(defaultServiceStatus)
})

const readDemoState = () => {
  if (typeof window === 'undefined') return createDefaultDemoState()
  try {
    const rawState = window.sessionStorage.getItem(demoStorageKey)
    if (!rawState) return createDefaultDemoState()
    const state = JSON.parse(rawState)
    return {
      settings: cloneSettings(state.settings),
      aiConfig: cloneAiConfig(state.aiConfig),
      serviceStatus: cloneServiceStatus(state.serviceStatus)
    }
  } catch {
    return createDefaultDemoState()
  }
}

const writeDemoState = () => {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(demoStorageKey, JSON.stringify(demoState))
}

const demoState = readDemoState()

const demoApi = {
  getSettings: async () => cloneSettings(demoState.settings),
  saveSettings: async (settings) => {
    demoState.settings = cloneSettings(settings)
    writeDemoState()
    return cloneSettings(demoState.settings)
  },
  previewScale: () => {},
  getActions: async () => defaultActionsConfig,
  inspectActionFrames: async ({ actionId } = {}) => createDemoInspection(actionId),
  reinspectActionFrames: async ({ selectionId, actionId } = {}) => ({ ...createDemoInspection(actionId), selectionId: selectionId || 'demo-selection' }),
  clearActionFrameSelection: async () => ({ ok: true }),
  importActionFrames: async ({ actionId, label } = {}) => ({ ok: true, result: { importedAction: { id: actionId, label: label || actionId } }, animations: defaultActionsConfig }),
  saveActionsConfig: async (config) => ({ animations: config }),
  deleteAction: async () => ({ animations: defaultActionsConfig }),
  listPetPacks: async () => defaultPetPacks,
  inspectPetPackDirectory: async () => ({ canceled: true }),
  clearPetPackSelection: async () => ({ ok: true }),
  importPetPack: async () => ({ petPacks: defaultPetPacks }),
  setActivePetPack: async () => ({ petPacks: defaultPetPacks, animations: defaultActionsConfig }),
  removePetPack: async () => ({ petPacks: defaultPetPacks }),
  getAiConfig: async () => cloneAiConfig(demoState.aiConfig),
  saveAiConfig: async (config) => {
    demoState.aiConfig = cloneAiConfig({ ...demoState.aiConfig, ...config })
    writeDemoState()
    return cloneAiConfig(demoState.aiConfig)
  },
  saveAiApiKey: async () => {
    demoState.aiConfig = cloneAiConfig({ ...demoState.aiConfig, apiKeyRef: 'ai.default', hasApiKey: true })
    writeDemoState()
    return { apiKeyRef: 'ai.default', hasApiKey: true }
  },
  testAiConnection: async () => ({ ok: true, reply: 'ok' }),
  getAiConversation: async () => [],
  chat: async ({ message }) => ({ reply: `Echo: ${message}` }),
  getAiBehavior: async () => cloneAiConfig(demoState.aiConfig).behavior,
  saveAiBehavior: async (config) => {
    demoState.aiConfig = cloneAiConfig({ ...demoState.aiConfig, behavior: config })
    writeDemoState()
    return demoState.aiConfig.behavior
  },
  dryRunAiBehavior: async () => ({ matched: false, reason: 'demo' }),
  getPlugins: async () => [],
  setPluginEnabled: async (pluginId, enabled) => ({ id: pluginId, enabled }),
  savePluginConfig: async (pluginId, config) => ({ id: pluginId, config }),
  runPluginCommand: async () => ({ ok: true }),
  inspectPluginPackage: async () => ({ canceled: true }),
  clearPluginSelection: async () => ({ ok: true }),
  installPlugin: async () => ({ ok: true, plugins: [] }),
  updatePlugin: async () => ({ ok: true, plugins: [] }),
  uninstallPlugin: async () => ({ ok: true, plugins: [] }),
  getPluginLogs: async () => [],
  exportPluginLogs: async () => '[]',
  clearPluginLogs: async () => [],
  clearPluginStorage: async (pluginId) => ({ id: pluginId, storage: { keyCount: 0, byteSize: 2 } }),
  getServiceStatus: async () => cloneServiceStatus(demoState.serviceStatus),
  saveServiceConfig: async (config) => {
    demoState.serviceStatus = cloneServiceStatus({
      config,
      runtime: {
        ...demoState.serviceStatus.runtime,
        host: config.host || '127.0.0.1',
        port: config.port,
        enabled: config.enabled
      }
    })
    writeDemoState()
    return cloneServiceStatus(demoState.serviceStatus)
  },
  getServiceLogs: async () => [],
  exportServiceLogs: async () => '[]',
  clearServiceLogs: async () => [],
  rotateServiceToken: async () => {
    demoState.serviceStatus = cloneServiceStatus({
      ...demoState.serviceStatus,
      config: { ...demoState.serviceStatus.config, token: 'demo-token-rotated' }
    })
    writeDemoState()
    return cloneServiceStatus(demoState.serviceStatus)
  },
  revokeMcpSessions: async () => {
    demoState.serviceStatus = cloneServiceStatus({
      ...demoState.serviceStatus,
      runtime: {
        ...demoState.serviceStatus.runtime,
        mcp: { ...demoState.serviceStatus.runtime.mcp, activeSessions: 0 }
      }
    })
    writeDemoState()
    return cloneServiceStatus(demoState.serviceStatus)
  },
  getAboutInfo: async () => defaultAboutInfo,
  checkForUpdates: async () => ({
    ...defaultUpdateCheck,
    status: 'not-configured',
    message: 'Update feed is not configured.'
  }),
  getCatalog: async () => defaultCatalog,
  prepareCatalogInstall: async () => ({ kind: 'plugin', selectionId: 'demo-catalog-selection', pluginReview: null }),
  installCatalogSelection: async () => ({ ok: true, catalog: defaultCatalog }),
  clearCatalogSelection: async () => ({ ok: true }),
  addCatalogBlocklistEntry: async () => ({ catalog: defaultCatalog, blocklist: defaultCatalog.localBlocklist }),
  removeCatalogBlocklistEntry: async () => ({ catalog: defaultCatalog, blocklist: defaultCatalog.localBlocklist }),
  close: () => {}
}

export const controlCenterAPI = window.controlCenterAPI || demoApi
