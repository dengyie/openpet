const test = require('node:test')
const assert = require('node:assert/strict')

class SessionStorageShim {
  constructor() {
    this.store = new Map()
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null
  }

  setItem(key, value) {
    this.store.set(key, String(value))
  }

  removeItem(key) {
    this.store.delete(key)
  }

  clear() {
    this.store.clear()
  }
}

const listeners = new Map()
global.window = {
  sessionStorage: new SessionStorageShim(),
  addEventListener(eventName, listener) {
    const existing = listeners.get(eventName) || []
    listeners.set(eventName, [...existing, listener])
  },
  removeEventListener(eventName, listener) {
    const existing = listeners.get(eventName) || []
    listeners.set(eventName, existing.filter((candidate) => candidate !== listener))
  },
  dispatchEvent(event) {
    for (const listener of listeners.get(event.type) || []) listener(event)
  }
}

global.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type
    this.detail = init.detail
  }
}

let demoControlCenterAPI

test.before(async () => {
  ;({ demoControlCenterAPI } = await import('../../src/control-center/src/api/demo-control-center-api.ts'))
})

test('demo API saves and returns settings from session-backed state', async () => {
  const previousSettings = await demoControlCenterAPI.getSettings()

  const savedSettings = await demoControlCenterAPI.saveSettings({
    ...previousSettings,
    scale: 1.35,
    grounded: false,
    home: {
      ...previousSettings.home,
      enabled: true
    }
  })

  assert.equal(savedSettings.scale, 1.35)
  assert.equal(savedSettings.grounded, false)
  assert.equal(savedSettings.home.enabled, false)
  assert.deepEqual(await demoControlCenterAPI.getSettings(), savedSettings)
})

test('demo API installs a fixture plugin and returns command mock output', async () => {
  const review = await demoControlCenterAPI.inspectPluginPackage()
  const installResult = await demoControlCenterAPI.installPlugin(review.selectionId)
  const plugins = await demoControlCenterAPI.getPlugins()

  assert.equal(installResult.ok, true)
  assert.ok(plugins.some((plugin) => plugin.id === review.plugin.id))

  const commandResult = await demoControlCenterAPI.runPluginCommand(review.plugin.id, 'hello', { greeting: 'hi' })

  assert.equal(commandResult.ok, true)
  assert.equal(commandResult.pluginId, review.plugin.id)
  assert.equal(commandResult.commandId, 'hello')
  assert.equal(commandResult.result.message, 'Demo command completed')
  assert.deepEqual(commandResult.result.payload, { greeting: 'hi' })
})

test('demo API chat mock appends user and assistant messages', async () => {
  const response = await demoControlCenterAPI.chat({ message: 'hello demo cat' })

  assert.equal(response.reply, 'OpenPet: hello demo cat')
  assert.equal(response.behavior.actionId, 'wave')
  assert.deepEqual(response.messages.slice(-2).map((message) => message.role), ['user', 'assistant'])
  assert.deepEqual(response.messages.slice(-2).map((message) => message.content), ['hello demo cat', response.reply])
})
