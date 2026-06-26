const test = require('node:test')
const assert = require('node:assert/strict')

const { createPluginCommandRunController } = require('../../src/main/services/plugin-command-run-controller')

const createController = (overrides = {}) => {
  const logs = []
  const state = {
    logs,
    activateCalls: [],
    localCalls: [],
    entryCalls: []
  }

  const controller = createPluginCommandRunController({
    appendLog: (entry) => logs.push(entry),
    createSdk: (plugin) => {
      const registered = {}
      return {
        __registeredCommands: () => registered,
        commands: {
          register: (command) => {
            registered[command.id] = command.handler
          }
        },
        pluginId: plugin.manifest.id
      }
    },
    getConfig: (pluginId) => ({ pluginId, config: true }),
    runLocalCommand: async (args) => {
      state.localCalls.push(args)
      return { ok: true, mode: 'local' }
    },
    runCommandEntryProcess: async (args) => {
      state.entryCalls.push(args)
      return { ok: true, mode: 'entry' }
    },
    getCommandEntry: (plugin, commandId) => ({ id: commandId, command: 'node announce.js', cwd: '.' }),
    getRegisteredCommands: (sdk) => sdk.__registeredCommands?.() || {},
    ...overrides
  })

  return { controller, state }
}

test('command run controller executes activate-based commands', async () => {
  const { controller, state } = createController()
  const plugin = {
    manifest: { id: 'official.basic-behavior', entries: {} },
    activate: (sdk) => {
      state.activateCalls.push(sdk.pluginId)
      sdk.commands.register({
        id: 'greet',
        handler: async (payload) => ({ ok: true, payload, source: 'registered' })
      })
      return {}
    }
  }

  const result = await controller.run({
    plugin,
    pluginId: plugin.manifest.id,
    commandId: 'greet',
    payload: { text: 'hello' }
  })

  assert.deepEqual(result, { ok: true, payload: { text: 'hello' }, source: 'registered' })
  assert.deepEqual(state.activateCalls, ['official.basic-behavior'])
  assert.deepEqual(state.logs.map((entry) => entry.message), ['Command started', 'Command completed'])
})

test('command run controller executes local main-path commands', async () => {
  const { controller, state } = createController()
  const plugin = {
    manifest: { id: 'local-runner', entries: {} },
    mainPath: '/plugins/local-runner/index.js'
  }

  const result = await controller.run({
    plugin,
    pluginId: plugin.manifest.id,
    commandId: 'start',
    payload: { mode: 'focus' }
  })

  assert.deepEqual(result, { ok: true, mode: 'local' })
  assert.equal(state.localCalls.length, 1)
  assert.equal(state.localCalls[0].commandId, 'start')
  assert.deepEqual(state.localCalls[0].config, { pluginId: 'local-runner', config: true })
})

test('command run controller executes declaration command entries', async () => {
  const { controller, state } = createController()
  const plugin = {
    manifest: {
      id: 'weather-declaration',
      entries: { commands: [{ id: 'announce', command: 'node announce.js', cwd: '.' }] }
    }
  }

  const result = await controller.run({
    plugin,
    pluginId: plugin.manifest.id,
    commandId: 'announce',
    payload: { city: 'Shanghai' }
  })

  assert.deepEqual(result, { ok: true, mode: 'entry' })
  assert.equal(state.entryCalls.length, 1)
  assert.equal(state.entryCalls[0].commandEntry.id, 'announce')
  assert.deepEqual(state.entryCalls[0].config, { pluginId: 'weather-declaration', config: true })
})

test('command run controller logs and rethrows command failures', async () => {
  const { controller, state } = createController({
    runLocalCommand: async () => {
      throw new Error('runner failed')
    }
  })
  const plugin = {
    manifest: { id: 'local-runner', entries: {} },
    mainPath: '/plugins/local-runner/index.js'
  }

  await assert.rejects(
    () => controller.run({
      plugin,
      pluginId: plugin.manifest.id,
      commandId: 'start',
      payload: {}
    }),
    /runner failed/
  )

  assert.deepEqual(state.logs.map((entry) => entry.message), ['Command started', 'runner failed'])
  assert.equal(state.logs[1].level, 'error')
})
