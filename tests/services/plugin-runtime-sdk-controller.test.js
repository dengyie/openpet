const test = require('node:test')
const assert = require('node:assert/strict')

const { createPluginRuntimeSdkController } = require('../../src/main/services/plugin-runtime-sdk-controller')

const createController = (overrides = {}) => {
  const petCalls = []
  const aiCalls = []
  const networkCalls = []
  const storageState = { count: 1 }

  const controller = createPluginRuntimeSdkController({
    getConfig: () => ({ greeting: 'Focus', rounds: 2 }),
    getStorage: () => structuredClone(storageState),
    saveStorage: (_pluginId, nextStorage) => {
      Object.keys(storageState).forEach((key) => delete storageState[key])
      Object.assign(storageState, structuredClone(nextStorage))
      return structuredClone(storageState)
    },
    assertPermission: (_manifest, permission) => {
      if (permission === 'network' && overrides.blockNetwork) {
        throw new Error('Plugin local-runner does not have network permission')
      }
    },
    assertStorageKey: (key) => {
      if (key === '../bad') throw new Error('Plugin storage key must be valid')
    },
    assertStorageValueSize: (value) => {
      if (value === 'oversized') throw new Error('Plugin storage value exceeds limit')
    },
    runAiChat: async (_manifest, payload) => {
      aiCalls.push(payload)
      return { ok: true, payload }
    },
    runNetworkRequest: async (_manifest, payload) => {
      networkCalls.push(payload)
      return { ok: true, payload }
    },
    petService: {
      say: async (payload) => {
        petCalls.push({ type: 'say', payload })
        return payload
      },
      playAction: async (payload) => {
        petCalls.push({ type: 'action', payload })
        return payload
      },
      setEvent: async (payload) => {
        petCalls.push({ type: 'event', payload })
        return payload
      }
    },
    cloneJsonValue: (value) => structuredClone(value),
    ...overrides
  })

  return { controller, petCalls, aiCalls, networkCalls, storageState }
}

const createPlugin = () => ({
  manifest: {
    id: 'local-runner',
    permissions: ['storage', 'pet:say', 'pet:action', 'pet:event', 'ai:chat', 'network']
  },
  configSchema: {
    properties: [
      { key: 'greeting', default: 'Focus' },
      { key: 'rounds', default: 1 }
    ]
  }
})

test('runtime sdk controller exposes config and storage helpers with cloned values', async () => {
  const { controller, storageState } = createController()
  const sdk = controller.createSdk(createPlugin())

  const config = sdk.config.get()
  const count = await sdk.storage.get('count', 0)
  const stored = await sdk.storage.set('meta', { ok: true })
  stored.ok = false

  config.greeting = 'Changed'

  assert.deepEqual(sdk.config.get(), { greeting: 'Focus', rounds: 2 })
  assert.equal(count, 1)
  assert.deepEqual(storageState, { count: 1, meta: { ok: true } })
  assert.deepEqual(await sdk.storage.get(), { count: 1, meta: { ok: true } })
})

test('runtime sdk controller enforces storage key and size validation', async () => {
  const { controller } = createController()
  const sdk = controller.createSdk(createPlugin())

  await assert.rejects(() => sdk.storage.set('../bad', true), /Plugin storage key must be valid/)
  await assert.rejects(() => sdk.storage.set('blob', 'oversized'), /Plugin storage value exceeds limit/)
})

test('runtime sdk controller forwards pet, ai, and network calls with plugin source semantics', async () => {
  const { controller, petCalls, aiCalls, networkCalls } = createController()
  const sdk = controller.createSdk(createPlugin())

  await sdk.pet.say('hello')
  await sdk.pet.playAction('wave')
  await sdk.pet.setEvent({ type: 'mood', message: 'calm' })
  await sdk.ai.chat({ message: 'ping', conversationId: 'thread-a' })
  await sdk.network.fetch('https://api.example.com/v1/status', { method: 'POST' })

  assert.deepEqual(petCalls, [
    { type: 'say', payload: { text: 'hello', source: 'plugin:local-runner' } },
    { type: 'action', payload: { actionId: 'wave', source: 'plugin:local-runner' } },
    { type: 'event', payload: { type: 'mood', message: 'calm', source: 'plugin:local-runner' } }
  ])
  assert.deepEqual(aiCalls, [{ message: 'ping', conversationId: 'thread-a' }])
  assert.deepEqual(networkCalls, [{
    url: 'https://api.example.com/v1/status',
    options: { method: 'POST' }
  }])
})

test('runtime sdk controller registers command handlers and enforces required shape', () => {
  const { controller } = createController()
  const sdk = controller.createSdk(createPlugin())

  const handler = async () => ({ ok: true })
  assert.equal(sdk.commands.register({ id: 'start', handler }), 'start')
  assert.equal(sdk[controller.registeredCommandsSymbol]().start, handler)
  assert.throws(() => sdk.commands.register({ handler }), /Plugin command id is required/)
  assert.throws(() => sdk.commands.register({ id: 'broken' }), /Plugin command handler is required: broken/)
})
