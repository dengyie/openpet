const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createPluginManagementController
} = require('../../src/main/services/plugin-management-controller')

test('management controller enables plugins through settings persistence and logging', () => {
  const savedSettings = []
  const logs = []
  const controller = createPluginManagementController({
    settingsService: {
      get: () => ({
        theme: 'system',
        plugins: { enabled: { existing: true } }
      }),
      save: (settings) => savedSettings.push(settings)
    },
    assertPluginAllowed: (pluginId) => assert.equal(pluginId, 'official.basic-behavior'),
    stopPluginCommands: () => assert.fail('stopPluginCommands should not run when enabling'),
    stopPluginServices: () => assert.fail('stopPluginServices should not run when enabling'),
    stopPluginSetups: () => assert.fail('stopPluginSetups should not run when enabling'),
    appendLog: (entry) => logs.push(entry),
    listPlugins: () => [{ id: 'official.basic-behavior', enabled: true }]
    ,
    getPlugins: () => [],
    saveConfig: () => {},
    clearStorage: () => {},
    findPluginForService: () => ({}),
    getServiceEntry: () => ({ health: { url: '' } }),
    normalizeServiceHealthPolicy: () => ({ enabled: false, intervalMs: 30000 }),
    getServiceRuntime: () => null,
    clearServiceHealthSchedule: () => {},
    scheduleServiceHealthCheck: () => {}
  })

  const result = controller.setEnabled('official.basic-behavior', true)

  assert.equal(savedSettings.length, 1)
  assert.deepEqual(savedSettings[0].plugins.enabled, {
    existing: true,
    'official.basic-behavior': true
  })
  assert.equal(savedSettings[0].theme, 'system')
  assert.deepEqual(logs, [{
    pluginId: 'official.basic-behavior',
    level: 'info',
    message: 'Plugin enabled'
  }])
  assert.deepEqual(result, { id: 'official.basic-behavior', enabled: true })
})

test('management controller disables plugins by stopping runtimes before saving state', () => {
  const calls = []
  const controller = createPluginManagementController({
    settingsService: {
      get: () => ({ plugins: { enabled: { 'weather-declaration': true } } }),
      save: () => calls.push('save')
    },
    assertPluginAllowed: () => calls.push('assert'),
    stopPluginCommands: (pluginId) => calls.push(`commands:${pluginId}`),
    stopPluginServices: (pluginId) => calls.push(`services:${pluginId}`),
    stopPluginSetups: (pluginId) => calls.push(`setups:${pluginId}`),
    appendLog: (entry) => calls.push(entry.message),
    listPlugins: () => [{ id: 'weather-declaration', enabled: false }]
    ,
    getPlugins: () => [],
    saveConfig: () => {},
    clearStorage: () => {},
    findPluginForService: () => ({}),
    getServiceEntry: () => ({ health: { url: '' } }),
    normalizeServiceHealthPolicy: () => ({ enabled: false, intervalMs: 30000 }),
    getServiceRuntime: () => null,
    clearServiceHealthSchedule: () => {},
    scheduleServiceHealthCheck: () => {}
  })

  const result = controller.setEnabled('weather-declaration', false)

  assert.deepEqual(calls, [
    'commands:weather-declaration',
    'services:weather-declaration',
    'setups:weather-declaration',
    'save',
    'Plugin disabled'
  ])
  assert.deepEqual(result, { id: 'weather-declaration', enabled: false })
})

test('management controller saves config, health policy, and storage through injected collaborators', () => {
  const logs = []
  const clearedSchedules = []
  const scheduledChecks = []
  const savedPolicies = []
  const configSaves = []
  const storageClears = []
  const controller = createPluginManagementController({
    settingsService: {
      get: () => ({
        plugins: {
          serviceHealthPolicies: {}
        }
      }),
      save: (settings) => savedPolicies.push(settings)
    },
    assertPluginAllowed: () => {},
    stopPluginCommands: () => {},
    stopPluginServices: () => {},
    stopPluginSetups: () => {},
    appendLog: (entry) => logs.push(entry),
    listPlugins: () => [
      { id: 'weather-declaration', config: { theme: 'night' }, storage: { keyCount: 0, byteSize: 2, valid: true } }
    ],
    getPlugins: () => [{
      manifest: { id: 'weather-declaration' },
      configSchema: { type: 'object' }
    }],
    saveConfig: (pluginId, schema, config) => configSaves.push({ pluginId, schema, config }),
    clearStorage: (pluginId) => storageClears.push(pluginId),
    findPluginForService: (pluginId) => ({ manifest: { id: pluginId } }),
    getServiceEntry: (_plugin, serviceId) => ({ id: serviceId, health: { url: 'http://127.0.0.1:8787/health' } }),
    normalizeServiceHealthPolicy: (policy) => ({
      enabled: Boolean(policy.enabled),
      intervalMs: Number(policy.intervalMs) || 30000
    }),
    getServiceRuntime: () => ({ status: 'running' }),
    clearServiceHealthSchedule: (runtime) => clearedSchedules.push(runtime.status),
    scheduleServiceHealthCheck: (pluginId, serviceId, runtime, serviceEntry) => {
      scheduledChecks.push({ pluginId, serviceId, runtime: runtime.status, serviceEntry: serviceEntry.id })
    }
  })

  const configResult = controller.saveConfig('weather-declaration', { theme: 'night' })
  const healthResult = controller.saveServiceHealthPolicy('weather-declaration', 'companion', { enabled: true, intervalMs: 15000 })
  const storageResult = controller.clearStorage('weather-declaration')

  assert.deepEqual(configSaves, [{
    pluginId: 'weather-declaration',
    schema: { type: 'object' },
    config: { theme: 'night' }
  }])
  assert.equal(savedPolicies.length, 1)
  assert.deepEqual(clearedSchedules, ['running'])
  assert.deepEqual(scheduledChecks, [{
    pluginId: 'weather-declaration',
    serviceId: 'companion',
    runtime: 'running',
    serviceEntry: 'companion'
  }])
  assert.deepEqual(storageClears, ['weather-declaration'])
  assert.equal(configResult.id, 'weather-declaration')
  assert.equal(healthResult.id, 'weather-declaration')
  assert.equal(storageResult.id, 'weather-declaration')
  assert.deepEqual(logs.map((entry) => entry.message), [
    'Plugin config saved',
    'Service health policy saved',
    'Plugin storage cleared'
  ])
})
