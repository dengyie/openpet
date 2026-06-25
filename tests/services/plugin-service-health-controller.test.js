const test = require('node:test')
const assert = require('node:assert/strict')

const { createPluginServiceHealthController } = require('../../src/main/services/plugin-service-health-controller')

const createRuntime = (overrides = {}) => ({
  status: 'running',
  health: {},
  healthTimer: null,
  healthChecking: false,
  ...overrides
})

const healthEntry = {
  health: { type: 'http', url: 'http://127.0.0.1:8787/health' }
}

test('health controller validates loopback http health urls', async () => {
  const controller = createPluginServiceHealthController()

  assert.equal(controller.normalizeHealthUrl(healthEntry), 'http://127.0.0.1:8787/health')
  assert.throws(
    () => controller.normalizeHealthUrl({ health: { type: 'http', url: 'https://api.example.com/health' } }),
    /loopback host/
  )
  assert.throws(
    () => controller.normalizeHealthUrl({ health: { type: 'http', url: 'file:///tmp/health' } }),
    /HTTP or HTTPS/
  )
})

test('health controller schedules periodic checks only for running services with enabled policy', () => {
  const timers = []
  const controller = createPluginServiceHealthController({
    getPolicy: () => ({ enabled: true, intervalMs: 15000 }),
    setHealthTimer: (callback, delay) => {
      const timer = { callback, delay, unref() {} }
      timers.push(timer)
      return timer
    }
  })
  const runtime = createRuntime()

  controller.scheduleCheck('weather-declaration', 'companion', runtime, healthEntry)

  assert.equal(timers.length, 1)
  assert.equal(timers[0].delay, 15000)

  const stoppedRuntime = createRuntime({ status: 'stopped' })
  controller.scheduleCheck('weather-declaration', 'companion', stoppedRuntime, healthEntry)
  assert.equal(timers.length, 1)
})

test('health controller marks successful checks healthy and logs the result', async () => {
  const logs = []
  const fetched = []
  const controller = createPluginServiceHealthController({
    appendLog: (entry) => logs.push(entry),
    fetchImpl: async (url, options) => {
      fetched.push({ url, options })
      return { ok: true, status: 204 }
    },
    createHealthView: (health) => health || {}
  })
  const runtime = createRuntime()

  const health = await controller.checkHealth('weather-declaration', 'companion', runtime, healthEntry)

  assert.equal(health.status, 'healthy')
  assert.equal(health.statusCode, 204)
  assert.equal(runtime.health.status, 'healthy')
  assert.equal(fetched[0].url, 'http://127.0.0.1:8787/health')
  assert.equal(fetched[0].options.method, 'GET')
  assert.ok(fetched[0].options.signal)
  assert.equal(logs[0].message, 'Service health healthy')
})

test('health controller marks aborted checks unhealthy with timeout message', async () => {
  const logs = []
  const controller = createPluginServiceHealthController({
    appendLog: (entry) => logs.push(entry),
    timeoutMs: 1,
    fetchImpl: async (_url, options = {}) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new Error('aborted')))
    })
  })
  const runtime = createRuntime()

  const health = await controller.checkHealth('weather-declaration', 'companion', runtime, healthEntry)

  assert.equal(health.status, 'unhealthy')
  assert.match(health.message, /timed out/)
  assert.equal(logs[0].message, 'Service health unhealthy')
})
