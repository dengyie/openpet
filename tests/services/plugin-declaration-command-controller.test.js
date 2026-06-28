const test = require('node:test')
const assert = require('node:assert/strict')

const { createPluginDeclarationCommandController } = require('../../src/main/services/plugin-declaration-command-controller')

const createController = (overrides = {}) => {
  const calls = {
    assertNotActive: [],
    run: [],
    stopPlugin: [],
    stopAll: 0
  }

  const runtimeManager = {
    assertNotActive(pluginId, commandId) {
      calls.assertNotActive.push({ pluginId, commandId })
    },
    stopPlugin(pluginId) {
      calls.stopPlugin.push(pluginId)
      return { ok: true, pluginId }
    },
    stopAll() {
      calls.stopAll += 1
      return { ok: true }
    },
    ...overrides.runtimeManager
  }

  const entryProcessController = {
    async run(args) {
      calls.run.push(args)
      return { ok: true, mode: 'entry', commandId: args.commandId }
    },
    ...overrides.entryProcessController
  }

  const controller = createPluginDeclarationCommandController({
    runtimeManager,
    entryProcessController
  })

  return { controller, calls }
}

test('declaration command controller rejects active duplicate command runs before spawning', async () => {
  const { controller, calls } = createController({
    runtimeManager: {
      assertNotActive() {
        throw new Error('Plugin command is already running')
      }
    }
  })

  await assert.rejects(() => controller.run({
    plugin: { manifest: { id: 'weather-declaration' } },
    commandEntry: { id: 'announce' },
    commandId: 'announce',
    payload: {},
    config: {}
  }), /Plugin command is already running/)

  assert.deepEqual(calls.run, [])
})

test('declaration command controller asserts runtime uniqueness and delegates process run', async () => {
  const { controller, calls } = createController()
  const plugin = { manifest: { id: 'weather-declaration' } }
  const commandEntry = { id: 'announce', command: 'node announce.js', cwd: '.' }

  const result = await controller.run({
    plugin,
    commandEntry,
    commandId: 'announce',
    payload: { city: 'Shanghai' },
    config: { enabled: true }
  })

  assert.deepEqual(result, { ok: true, mode: 'entry', commandId: 'announce' })
  assert.deepEqual(calls.assertNotActive, [{ pluginId: 'weather-declaration', commandId: 'announce' }])
  assert.equal(calls.run.length, 1)
  assert.equal(calls.run[0].plugin, plugin)
  assert.equal(calls.run[0].commandEntry, commandEntry)
})

test('declaration command controller stops one plugin through runtime manager', () => {
  const { controller, calls } = createController()

  const result = controller.stopPlugin('weather-declaration')

  assert.deepEqual(result, { ok: true, pluginId: 'weather-declaration' })
  assert.deepEqual(calls.stopPlugin, ['weather-declaration'])
})

test('declaration command controller stops all runtimes through runtime manager', () => {
  const { controller, calls } = createController()

  const result = controller.stopAll()

  assert.deepEqual(result, { ok: true })
  assert.equal(calls.stopAll, 1)
})

