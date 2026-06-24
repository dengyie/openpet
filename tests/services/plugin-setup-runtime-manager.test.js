const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createPluginSetupRuntimeKey,
  createPluginSetupRuntimeManager
} = require('../../src/main/services/plugin-setup-runtime-manager')

const createManager = () => {
  const logs = []
  const stops = []
  const manager = createPluginSetupRuntimeManager({
    appendLog: (entry) => logs.push(entry),
    now: () => '2026-06-25T00:00:00.000Z',
    stopRuntimeProcess: (runtime, signal) => stops.push({ runtime, signal })
  })
  return { logs, manager, stops }
}

test('plugin setup runtime manager stores runtimes by plugin and setup id', () => {
  const { manager } = createManager()
  const runtime = { pluginId: 'weather', setupId: 'install-deps', status: 'running' }

  assert.equal(createPluginSetupRuntimeKey('weather', 'install-deps'), 'weather:install-deps')
  assert.equal(manager.setRuntime(runtime), runtime)
  assert.equal(manager.getRuntime('weather', 'install-deps'), runtime)
  assert.equal(manager.size(), 1)
})

test('plugin setup runtime manager rejects active duplicate setup runs', () => {
  const { manager } = createManager()

  manager.setRuntime({ pluginId: 'weather', setupId: 'install-deps', status: 'running' })
  assert.throws(
    () => manager.assertNotActive('weather', 'install-deps'),
    /Plugin setup is already running/
  )

  manager.setRuntime({ pluginId: 'weather', setupId: 'install-deps', status: 'failed' })
  assert.doesNotThrow(() => manager.assertNotActive('weather', 'install-deps'))
})

test('plugin setup runtime manager attaches the standard stop handler', () => {
  const { manager, stops } = createManager()
  const runtime = manager.attachStopHandler({
    pluginId: 'weather',
    setupId: 'install-deps',
    status: 'running',
    error: '',
    exitCode: 0,
    lastRunAt: ''
  })

  assert.equal(runtime.stop({ signal: 'SIGTERM' }), true)
  assert.equal(runtime.status, 'stopping')
  assert.equal(runtime.error, '')
  assert.equal(runtime.exitCode, null)
  assert.equal(runtime.lastRunAt, '2026-06-25T00:00:00.000Z')
  assert.deepEqual(stops, [{ runtime, signal: 'SIGTERM' }])
})

test('plugin setup runtime manager stops one plugin without matching id prefixes', () => {
  const { logs, manager, stops } = createManager()
  const weatherRuntime = manager.attachStopHandler({ pluginId: 'weather', setupId: 'install-deps', status: 'running', error: '' })
  const weatherPlusRuntime = manager.attachStopHandler({ pluginId: 'weather-plus', setupId: 'install-deps', status: 'running', error: '' })
  manager.setRuntime(weatherRuntime)
  manager.setRuntime(weatherPlusRuntime)

  manager.stopPlugin('weather')

  assert.equal(weatherRuntime.status, 'stopping')
  assert.equal(weatherPlusRuntime.status, 'running')
  assert.deepEqual(stops.map((entry) => entry.runtime.pluginId), ['weather'])
  assert.deepEqual(logs.map((entry) => entry.message), ['Setup stop requested'])
})

test('plugin setup runtime manager marks failed stops as logged errors', () => {
  const { logs, manager } = createManager()
  const failedStops = []
  const runtime = {
    pluginId: 'weather',
    setupId: 'install-deps',
    status: 'running',
    stop: () => {
      throw new Error('setup stop failed')
    },
    failStop: (error) => failedStops.push(error)
  }
  manager.setRuntime(runtime)

  manager.stopRuntime('weather', 'install-deps')

  assert.equal(runtime.status, 'failed')
  assert.equal(runtime.error, 'setup stop failed')
  assert.equal(failedStops[0].message, 'setup stop failed')
  assert.deepEqual(logs, [{
    pluginId: 'weather',
    commandId: 'setup:install-deps',
    level: 'error',
    message: 'setup stop failed'
  }])
})

test('plugin setup runtime manager can stop all setup runtimes', () => {
  const { manager, stops } = createManager()
  manager.setRuntime(manager.attachStopHandler({ pluginId: 'weather', setupId: 'install-deps', status: 'running', error: '' }))
  manager.setRuntime(manager.attachStopHandler({ pluginId: 'focus', setupId: 'bootstrap', status: 'running', error: '' }))

  manager.stopAll()

  assert.deepEqual(stops.map((entry) => `${entry.runtime.pluginId}:${entry.runtime.setupId}`), [
    'weather:install-deps',
    'focus:bootstrap'
  ])
})
