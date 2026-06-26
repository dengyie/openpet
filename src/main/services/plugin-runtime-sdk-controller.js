const REGISTERED_COMMANDS_SYMBOL = Symbol('openpet.registeredCommands')

const createPluginRuntimeSdkController = ({
  getConfig,
  getStorage,
  saveStorage,
  assertPermission,
  assertStorageKey,
  assertStorageValueSize,
  runAiChat,
  runNetworkRequest,
  petService,
  cloneJsonValue
} = {}) => {
  if (typeof getConfig !== 'function') throw new Error('getConfig is required')
  if (typeof getStorage !== 'function') throw new Error('getStorage is required')
  if (typeof saveStorage !== 'function') throw new Error('saveStorage is required')
  if (typeof assertPermission !== 'function') throw new Error('assertPermission is required')
  if (typeof assertStorageKey !== 'function') throw new Error('assertStorageKey is required')
  if (typeof assertStorageValueSize !== 'function') throw new Error('assertStorageValueSize is required')
  if (typeof runAiChat !== 'function') throw new Error('runAiChat is required')
  if (typeof runNetworkRequest !== 'function') throw new Error('runNetworkRequest is required')
  if (!petService) throw new Error('petService is required')
  if (typeof cloneJsonValue !== 'function') throw new Error('cloneJsonValue is required')

  const createSdk = (plugin) => {
    const manifest = plugin.manifest
    const registeredCommands = {}

    return {
      [REGISTERED_COMMANDS_SYMBOL]: () => registeredCommands,
      config: {
        get: (key) => {
          const config = getConfig(manifest.id, plugin.configSchema)
          return key ? config[key] : { ...config }
        }
      },
      storage: {
        get: async (key, fallbackValue) => {
          assertPermission(manifest, 'storage')
          const storage = getStorage(manifest.id)
          if (key == null) return storage
          assertStorageKey(key)
          return Object.prototype.hasOwnProperty.call(storage, key) ? cloneJsonValue(storage[key], 'value') : fallbackValue
        },
        set: async (key, value) => {
          assertPermission(manifest, 'storage')
          assertStorageKey(key)
          const storage = getStorage(manifest.id)
          const nextValue = cloneJsonValue(value, 'value')
          assertStorageValueSize(nextValue)
          saveStorage(manifest.id, { ...storage, [key]: nextValue })
          return nextValue
        },
        remove: async (key) => {
          assertPermission(manifest, 'storage')
          assertStorageKey(key)
          const storage = getStorage(manifest.id)
          delete storage[key]
          saveStorage(manifest.id, storage)
          return true
        },
        clear: async () => {
          assertPermission(manifest, 'storage')
          saveStorage(manifest.id, {})
          return true
        }
      },
      pet: {
        say: async (payload) => {
          assertPermission(manifest, 'pet:say')
          const normalizedPayload = typeof payload === 'string' ? { text: payload } : { ...payload }
          return petService.say({ ...normalizedPayload, source: `plugin:${manifest.id}` })
        },
        playAction: async (actionIdOrPayload) => {
          assertPermission(manifest, 'pet:action')
          const payload = typeof actionIdOrPayload === 'string'
            ? { actionId: actionIdOrPayload }
            : { ...actionIdOrPayload }
          return petService.playAction({ ...payload, source: `plugin:${manifest.id}` })
        },
        setEvent: async (payload) => {
          assertPermission(manifest, 'pet:event')
          return petService.setEvent({ ...payload, source: `plugin:${manifest.id}` })
        }
      },
      ai: {
        chat: async (payload) => runAiChat(manifest, payload)
      },
      network: {
        fetch: async (url, options = {}) => runNetworkRequest(manifest, { url, options })
      },
      commands: {
        register: (command) => {
          if (!command?.id) throw new Error('Plugin command id is required')
          if (typeof command.handler !== 'function') throw new Error(`Plugin command handler is required: ${command.id}`)
          registeredCommands[command.id] = command.handler
          return command.id
        }
      }
    }
  }

  return {
    createSdk,
    registeredCommandsSymbol: REGISTERED_COMMANDS_SYMBOL
  }
}

module.exports = {
  createPluginRuntimeSdkController
}
