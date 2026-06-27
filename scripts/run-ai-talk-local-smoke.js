const fs = require('fs')
const os = require('os')
const path = require('path')
const { LEGACY_USER_DATA_DIR_NAME } = require('../src/main/user-data-path')
const { createAppLogService } = require('../src/main/services/app-log-service')
const { createSecretService } = require('../src/main/services/secret-service')
const { createAiService } = require('../src/main/services/ai-service')
const { createAiTalkStore } = require('../src/main/services/ai-talk-store')
const { createAiTalkService } = require('../src/main/services/ai-talk-service')
const { createPetPackService } = require('../src/main/services/pet-pack-service')
const { createPetUtteranceLogService } = require('../src/main/services/pet-utterance-log-service')

const DEFAULT_OUTPUT_DIR = path.join(__dirname, '..', 'release', 'ai-talk-local-smoke')
const DEFAULT_LOG_LIMIT = 20

const DEFAULT_AI_SETTINGS = {
  enabled: false,
  provider: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  apiKeyRef: 'ai.default',
  systemPrompt: 'You are a friendly desktop pet companion.',
  memory: {
    enabled: false
  },
  behavior: {
    enabled: false,
    useTools: true,
    cooldownMs: 1500,
    rules: [],
    decisions: []
  },
  conversations: {}
}

const DEFAULT_PET_PACK_SETTINGS = {
  activePackId: 'legacy-cat',
  installed: {}
}

const DEFAULT_ECOSYSTEM_SETTINGS = {
  blocklist: {
    pluginIds: [],
    packIds: [],
    sha256: []
  }
}

const usage = () => [
  'Usage: node scripts/run-ai-talk-local-smoke.js --message <text> [options]',
  '',
  'Options:',
  '  --user-data-dir <dir>    OpenPet/ibot userData directory. Defaults to desktop conventions.',
  '  --output-dir <dir>       Directory for smoke session artifacts. Default: release/ai-talk-local-smoke',
  '  --skip-connection-test   Skip aiService.testConnection() and only run chat.',
  '  --log-limit <n>          Number of recent redacted log entries to include. Default: 20',
  '  --help',
  '',
  'This script reuses the host-side AiService + AiTalkService wiring with the current',
  'saved provider config and API key, writes logs into an isolated smoke session,',
  'copies ai-talk-store.json into that session, and emits a redacted JSON summary.'
].join('\n')

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value)

const defaultAppDataDir = ({ platform = process.platform, env = process.env, homedir = os.homedir } = {}) => {
  if (platform === 'darwin') return path.join(homedir(), 'Library', 'Application Support')
  if (platform === 'win32') return env.APPDATA || path.join(homedir(), 'AppData', 'Roaming')
  return env.XDG_CONFIG_HOME || path.join(homedir(), '.config')
}

const defaultUserDataDir = ({ appDataDir = defaultAppDataDir(), legacyDirName = LEGACY_USER_DATA_DIR_NAME } = {}) => (
  path.join(path.resolve(appDataDir), legacyDirName)
)

const sanitizeText = (value, maxChars = 240) => String(value || '')
  .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-secret]')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, maxChars)

const sanitizeError = (error) => ({
  name: sanitizeText(error?.name || 'Error', 80),
  message: error?.providerStatus
    ? 'AI provider returned an error response'
    : sanitizeText(error?.message || 'Unknown error', 240),
  providerStatus: Number(error?.providerStatus) || 0,
  providerCode: sanitizeText(error?.providerCode || '', 80)
})

const readJsonIfExists = (filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return {}
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch (_) {
    return {}
  }
}

const createSmokeSettingsSnapshot = (settings = {}) => ({
  ai: {
    ...DEFAULT_AI_SETTINGS,
    ...(isObject(settings.ai) ? settings.ai : {}),
    memory: {
      ...DEFAULT_AI_SETTINGS.memory,
      ...(isObject(settings.ai?.memory) ? settings.ai.memory : {}),
      enabled: Boolean(settings.ai?.memory?.enabled)
    },
    behavior: {
      ...DEFAULT_AI_SETTINGS.behavior,
      ...(isObject(settings.ai?.behavior) ? settings.ai.behavior : {}),
      rules: Array.isArray(settings.ai?.behavior?.rules) ? settings.ai.behavior.rules : DEFAULT_AI_SETTINGS.behavior.rules,
      decisions: Array.isArray(settings.ai?.behavior?.decisions) ? settings.ai.behavior.decisions : DEFAULT_AI_SETTINGS.behavior.decisions
    },
    conversations: isObject(settings.ai?.conversations) ? settings.ai.conversations : DEFAULT_AI_SETTINGS.conversations
  },
  petPacks: {
    ...DEFAULT_PET_PACK_SETTINGS,
    ...(isObject(settings.petPacks) ? settings.petPacks : {}),
    installed: isObject(settings.petPacks?.installed) ? settings.petPacks.installed : DEFAULT_PET_PACK_SETTINGS.installed
  },
  ecosystem: {
    ...DEFAULT_ECOSYSTEM_SETTINGS,
    ...(isObject(settings.ecosystem) ? settings.ecosystem : {}),
    blocklist: {
      ...DEFAULT_ECOSYSTEM_SETTINGS.blocklist,
      ...(isObject(settings.ecosystem?.blocklist) ? settings.ecosystem.blocklist : {}),
      pluginIds: Array.isArray(settings.ecosystem?.blocklist?.pluginIds) ? settings.ecosystem.blocklist.pluginIds : DEFAULT_ECOSYSTEM_SETTINGS.blocklist.pluginIds,
      packIds: Array.isArray(settings.ecosystem?.blocklist?.packIds) ? settings.ecosystem.blocklist.packIds : DEFAULT_ECOSYSTEM_SETTINGS.blocklist.packIds,
      sha256: Array.isArray(settings.ecosystem?.blocklist?.sha256) ? settings.ecosystem.blocklist.sha256 : DEFAULT_ECOSYSTEM_SETTINGS.blocklist.sha256
    }
  }
})

const createSessionId = (date) => date.toISOString().replace(/[:.]/g, '-')

const createSessionPaths = ({ outputDir = DEFAULT_OUTPUT_DIR, now = () => new Date() } = {}) => {
  const sessionId = createSessionId(now())
  const sessionDir = path.resolve(outputDir, sessionId)
  return {
    sessionId,
    sessionDir,
    resultPath: path.join(sessionDir, 'ai-talk-local-smoke-result.json'),
    aiTalkStorePath: path.join(sessionDir, 'ai-talk-store.json'),
    logDir: path.join(sessionDir, 'logs')
  }
}

const copyFileIfExists = (sourcePath, targetPath) => {
  if (!sourcePath || !fs.existsSync(sourcePath)) return false
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  fs.copyFileSync(sourcePath, targetPath)
  return true
}

const parseArgs = (argv) => {
  const options = {
    message: '',
    userDataDir: defaultUserDataDir(),
    outputDir: DEFAULT_OUTPUT_DIR,
    skipConnectionTest: false,
    logLimit: DEFAULT_LOG_LIMIT,
    help: false
  }

  const readValue = (index, flag) => {
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`)
    return value
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--message') {
      options.message = readValue(index, arg)
      index += 1
    } else if (arg === '--user-data-dir') {
      options.userDataDir = readValue(index, arg)
      index += 1
    } else if (arg === '--output-dir') {
      options.outputDir = readValue(index, arg)
      index += 1
    } else if (arg === '--log-limit') {
      options.logLimit = Number(readValue(index, arg))
      index += 1
    } else if (arg === '--skip-connection-test') {
      options.skipConnectionTest = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new Error(`Unexpected argument: ${arg}`)
    }
  }

  if (!options.help && !String(options.message || '').trim()) {
    throw new Error('--message is required')
  }
  if (!Number.isFinite(options.logLimit) || options.logLimit <= 0) {
    throw new Error('--log-limit must be a positive number')
  }

  options.message = String(options.message || '').trim()
  options.userDataDir = path.resolve(options.userDataDir)
  options.outputDir = path.resolve(options.outputDir)
  options.logLimit = Math.round(options.logLimit)
  return options
}

const createFileBackedSettingsService = ({ settingsPath }) => {
  let currentSettings = createSmokeSettingsSnapshot(readJsonIfExists(settingsPath))
  return {
    get: () => JSON.parse(JSON.stringify(currentSettings)),
    save: (nextSettings) => {
      currentSettings = createSmokeSettingsSnapshot(nextSettings)
      return JSON.parse(JSON.stringify(currentSettings))
    }
  }
}

const readRelevantLogs = ({ appLogService, limit = DEFAULT_LOG_LIMIT } = {}) => (
  appLogService.read({ limit: Math.max(limit * 3, limit) })
    .filter((entry) => ['ai-provider', 'ai-talk', 'ai-settings', 'pet-bubble-chat'].includes(entry.scope))
    .slice(-limit)
)

const runAiTalkLocalSmoke = async ({
  message,
  userDataDir = defaultUserDataDir(),
  outputDir = DEFAULT_OUTPUT_DIR,
  skipConnectionTest = false,
  logLimit = DEFAULT_LOG_LIMIT,
  now = () => new Date(),
  projectRoot = path.join(__dirname, '..'),
  createAppLogServiceImpl = createAppLogService,
  createSecretServiceImpl = createSecretService,
  createAiServiceImpl = createAiService,
  createAiTalkStoreImpl = createAiTalkStore,
  createAiTalkServiceImpl = createAiTalkService,
  createPetPackServiceImpl = createPetPackService,
  createPetUtteranceLogServiceImpl = createPetUtteranceLogService
} = {}) => {
  const content = String(message || '').trim()
  if (!content) throw new Error('Smoke message is required')

  const sessionPaths = createSessionPaths({ outputDir, now })
  fs.mkdirSync(sessionPaths.sessionDir, { recursive: true })

  const settingsPath = path.join(userDataDir, 'settings.json')
  const secretsPath = path.join(userDataDir, 'secrets.json')
  const liveAiTalkStorePath = path.join(userDataDir, 'ai-talk-store.json')
  const userPacksDir = path.join(userDataDir, 'pet-packs')

  copyFileIfExists(liveAiTalkStorePath, sessionPaths.aiTalkStorePath)

  const settingsService = createFileBackedSettingsService({ settingsPath })
  const appLogService = createAppLogServiceImpl({ logDir: sessionPaths.logDir, maxEntries: Math.max(logLimit * 5, 200) })
  const secretService = createSecretServiceImpl({ storePath: secretsPath })
  const aiTalkStore = createAiTalkStoreImpl({ storePath: sessionPaths.aiTalkStorePath, now: () => now().toISOString() })
  const petUtteranceLogService = createPetUtteranceLogServiceImpl({ aiTalkStore, appLogService })
  const petPackService = createPetPackServiceImpl({
    settingsService,
    userPacksDir,
    projectRoot
  })
  const aiService = createAiServiceImpl({ settingsService, secretService, appLogService })
  const aiTalkService = createAiTalkServiceImpl({
    aiService,
    aiTalkStore,
    petPackService,
    appLogService,
    petUtteranceLogService
  })

  const config = typeof aiService.getConfig === 'function' ? aiService.getConfig() : {}
  const activePack = typeof petPackService.getActivePetPack === 'function' ? petPackService.getActivePetPack() : null
  const summary = {
    ok: false,
    generatedAt: now().toISOString(),
    source: 'scripts/run-ai-talk-local-smoke.js',
    userDataDir,
    sessionId: sessionPaths.sessionId,
    sessionDir: sessionPaths.sessionDir,
    copiedLiveAiTalkStore: fs.existsSync(liveAiTalkStorePath),
    liveAiTalkStorePath,
    tempAiTalkStorePath: sessionPaths.aiTalkStorePath,
    logPath: appLogService.logPath,
    config: {
      enabled: Boolean(config.enabled),
      provider: sanitizeText(config.provider || '', 80),
      baseUrl: sanitizeText(config.baseUrl || '', 200),
      model: sanitizeText(config.model || '', 120),
      hasApiKey: Boolean(config.hasApiKey)
    },
    activePetPack: {
      id: sanitizeText(activePack?.manifest?.id || '', 80),
      displayName: sanitizeText(activePack?.manifest?.displayName || '', 120)
    },
    connectionTest: {
      ok: false,
      skipped: Boolean(skipConnectionTest)
    },
    chat: {
      ok: false,
      messageChars: content.length
    },
    traces: [],
    logs: []
  }

  try {
    if (!skipConnectionTest && typeof aiService.testConnection === 'function') {
      const connection = await aiService.testConnection()
      summary.connectionTest = {
        ok: Boolean(connection.ok),
        skipped: false,
        code: sanitizeText(connection.code || '', 80),
        message: sanitizeText(connection.message || '', 160),
        elapsedMs: Number(connection.elapsedMs) || 0,
        replyPreview: connection.ok ? sanitizeText(connection.reply || '', 120) : ''
      }
    }

    const result = await aiTalkService.chat({ message: content, entrypoint: 'control-center' })
    summary.chat = {
      ok: true,
      conversationId: sanitizeText(result.conversationId || '', 160),
      replyChars: String(result.reply || '').length,
      replyPreview: sanitizeText(result.reply || '', 200),
      bubbleSegments: Array.isArray(result.bubbleSegments) ? result.bubbleSegments.map((segment) => sanitizeText(segment, 120)) : [],
      messageCount: Array.isArray(result.messages) ? result.messages.length : 0,
      behaviorIntentIntent: sanitizeText(result.behaviorIntent?.intent || '', 80),
      behaviorActionId: sanitizeText(result.behaviorIntent?.actionId || '', 80)
    }

    if (typeof aiTalkService.flushMemoryJobs === 'function') {
      await aiTalkService.flushMemoryJobs()
    }
    if (typeof aiTalkService.getTraceExport === 'function') {
      const traceExport = aiTalkService.getTraceExport({ limit: 5 })
      summary.traces = Array.isArray(traceExport.traces)
        ? traceExport.traces.map((trace) => ({
            id: sanitizeText(trace.id || '', 120),
            type: sanitizeText(trace.type || '', 80),
            success: Boolean(trace.success),
            provider: sanitizeText(trace.provider || '', 80),
            model: sanitizeText(trace.model || '', 120),
            messagesCount: Number(trace.messagesCount) || 0,
            memoryContextCount: Number(trace.memoryContextCount) || 0,
            recentPetActivityCount: Number(trace.recentPetActivityCount) || 0,
            replyChars: Number(trace.replyChars) || 0,
            bubbleSegmentCount: Number(trace.bubbleSegmentCount) || 0,
            errorCode: sanitizeText(trace.errorCode || '', 80)
          }))
        : []
    }

    summary.logs = readRelevantLogs({ appLogService, limit: logLimit })
    summary.ok = summary.chat.ok && (summary.connectionTest.skipped || summary.connectionTest.ok)
  } catch (error) {
    summary.error = sanitizeError(error)
    summary.logs = readRelevantLogs({ appLogService, limit: logLimit })
    summary.ok = false
  }

  fs.writeFileSync(sessionPaths.resultPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf-8')
  summary.resultPath = sessionPaths.resultPath
  return summary
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }
  const result = await runAiTalkLocalSmoke(options)
  console.log(JSON.stringify({
    ok: result.ok,
    resultPath: result.resultPath,
    logPath: result.logPath,
    connectionOk: result.connectionTest?.ok || false,
    chatOk: result.chat?.ok || false,
    conversationId: result.chat?.conversationId || '',
    replyPreview: result.chat?.replyPreview || '',
    error: result.error || null
  }, null, 2))
  if (!result.ok) process.exitCode = 1
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error)
    process.exit(1)
  })
}

module.exports = {
  DEFAULT_OUTPUT_DIR,
  createSmokeSettingsSnapshot,
  createSessionPaths,
  defaultAppDataDir,
  defaultUserDataDir,
  parseArgs,
  runAiTalkLocalSmoke
}
