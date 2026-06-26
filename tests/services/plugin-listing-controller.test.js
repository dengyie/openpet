const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createPluginListingController
} = require('../../src/main/services/plugin-listing-controller')

test('listing controller decorates setup and service entries with runtime views', () => {
  const controller = createPluginListingController({
    getSetupRuntime: (pluginId, setupId) => {
      assert.equal(pluginId, 'weather-declaration')
      assert.equal(setupId, 'install')
      return { status: 'succeeded', lastRunAt: '2026-06-26T10:00:00.000Z', exitCode: 0 }
    },
    getServiceRuntime: (pluginId, serviceId) => {
      assert.equal(pluginId, 'weather-declaration')
      assert.equal(serviceId, 'api')
      return {
        status: 'running',
        pid: 42,
        startedAt: '2026-06-26T10:01:00.000Z',
        command: 'node server.js',
        cwd: '/plugin',
        exitCode: null,
        signal: '',
        error: '',
        health: { status: 'healthy', checkedAt: '2026-06-26T10:02:00.000Z' }
      }
    },
    createHealthView: (health, entry) => ({
      status: health.status || 'unknown',
      checkedAt: health.checkedAt || '',
      serviceId: entry.id
    }),
    getHealthPolicy: (pluginId, serviceId) => ({
      pluginId,
      serviceId,
      enabled: true,
      intervalMs: 5000
    }),
    getEnabledMap: () => ({ 'weather-declaration': true }),
    getPluginConfig: (pluginId, schema) => ({ pluginId, schema }),
    getPluginStorageStats: (pluginId) => ({ pluginId, usedBytes: 12, quotaBytes: 64 * 1024 }),
    getPluginSignatureStatus: (manifest) => ({ trusted: manifest.source === 'official' }),
    getPluginPolicyStatus: (manifest) => ({ blocked: manifest.id === 'blocked-plugin' })
  })

  const plugin = controller.listPlugins([
    {
      manifest: {
        id: 'weather-declaration',
        source: 'local',
        entries: {
          setup: [{ id: 'install', title: 'Install' }],
          services: [{ id: 'api', title: 'API service' }],
          commands: [{ id: 'announce', title: 'Announce' }]
        }
      },
      configSchema: { type: 'object' },
      activate: null,
      mainPath: '/plugin/index.js'
    }
  ])[0]

  assert.equal(plugin.enabled, true)
  assert.equal(plugin.runnable, true)
  assert.deepEqual(plugin.entries.setup[0].runtime, {
    status: 'succeeded',
    lastRunAt: '2026-06-26T10:00:00.000Z',
    exitCode: 0,
    error: ''
  })
  assert.deepEqual(plugin.entries.services[0].healthPolicy, {
    pluginId: 'weather-declaration',
    serviceId: 'api',
    enabled: true,
    intervalMs: 5000
  })
  assert.deepEqual(plugin.entries.services[0].runtime, {
    status: 'running',
    pid: 42,
    startedAt: '2026-06-26T10:01:00.000Z',
    stoppedAt: '',
    command: 'node server.js',
    cwd: '/plugin',
    exitCode: null,
    signal: '',
    error: '',
    health: {
      status: 'healthy',
      checkedAt: '2026-06-26T10:02:00.000Z',
      serviceId: 'api'
    }
  })
  assert.deepEqual(plugin.config, {
    pluginId: 'weather-declaration',
    schema: { type: 'object' }
  })
  assert.deepEqual(plugin.storage, {
    pluginId: 'weather-declaration',
    usedBytes: 12,
    quotaBytes: 64 * 1024
  })
})

test('listing controller falls back to stopped and not-run runtime defaults', () => {
  const controller = createPluginListingController({
    getSetupRuntime: () => null,
    getServiceRuntime: () => null,
    createHealthView: () => ({ status: 'unknown' }),
    getHealthPolicy: () => ({ enabled: false }),
    getEnabledMap: () => ({}),
    getPluginConfig: () => ({}),
    getPluginStorageStats: () => ({ usedBytes: 0, quotaBytes: 64 * 1024 }),
    getPluginSignatureStatus: () => ({ trusted: false }),
    getPluginPolicyStatus: () => ({ blocked: false })
  })

  const plugin = controller.listPlugins([
    {
      manifest: {
        id: 'focus-timer',
        entries: {
          setup: [{ id: 'setup-1' }],
          services: [{ id: 'service-1' }],
          commands: []
        }
      },
      configSchema: null,
      activate: null,
      mainPath: ''
    }
  ])[0]

  assert.equal(plugin.enabled, false)
  assert.equal(plugin.runnable, false)
  assert.deepEqual(plugin.entries.setup[0].runtime, {
    status: 'not-run',
    lastRunAt: '',
    exitCode: null,
    error: ''
  })
  assert.deepEqual(plugin.entries.services[0].runtime, {
    status: 'stopped',
    health: { status: 'unknown' }
  })
})
