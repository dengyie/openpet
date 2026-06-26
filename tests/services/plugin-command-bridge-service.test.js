const http = require('http')
const test = require('node:test')
const assert = require('node:assert/strict')

const {
  JSON_ROUTE_HANDLERS,
  READ_ROUTE_HANDLERS,
  createPluginCommandBridgeService
} = require('../../src/main/services/plugin-command-bridge-service')
const { PLUGIN_BRIDGE_ROUTE_INVENTORY } = require('../../src/main/services/plugin-bridge-handlers-controller')

const requestJson = (url, { body, headers = {}, method = body == null ? 'GET' : 'POST', token = 'bridge-token' } = {}) => new Promise((resolve, reject) => {
  const payload = body == null ? '' : JSON.stringify(body)
  const request = http.request(url, {
    method,
    headers: {
      ...(token == null ? {} : { Authorization: `Bearer ${token}` }),
      ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      ...headers
    }
  }, (response) => {
    let responseBody = ''
    response.on('data', (chunk) => {
      responseBody += chunk
    })
    response.on('end', () => {
      try {
        resolve({
          body: responseBody ? JSON.parse(responseBody) : null,
          statusCode: response.statusCode
        })
      } catch (error) {
        reject(error)
      }
    })
  })
  request.on('error', reject)
  if (payload) request.write(payload)
  request.end()
})

const createHandlers = (calls = []) => ({
  context: async () => ({ ok: true, route: 'context' }),
  creatorActionsRead: async () => ({ ok: true, route: 'creatorActionsRead' }),
  creatorPackManifestRead: async () => ({ ok: true, route: 'creatorPackManifestRead' }),
  creatorModelSettingsRead: async () => ({ ok: true, route: 'creatorModelSettingsRead' }),
  petSay: async (payload) => {
    calls.push(['petSay', payload])
    return { ok: true, payload }
  },
  petAction: async (payload) => ({ ok: true, payload }),
  petEvent: async (payload) => ({ ok: true, payload }),
  creatorActionsValidate: async (payload) => ({ ok: true, payload }),
  creatorActionsApply: async (payload) => ({ ok: true, payload }),
  creatorPackManifestValidate: async (payload) => ({ ok: true, payload }),
  creatorPackManifestApply: async (payload) => ({ ok: true, payload }),
  creatorAssetsInspectFrames: async (payload) => ({ ok: true, payload }),
  creatorAssetsImportFrames: async (payload) => ({ ok: true, payload }),
  creatorAssetsPickFramesInspect: async (payload) => ({ ok: true, payload }),
  creatorAssetsPickFramesImport: async (payload) => ({ ok: true, payload }),
  creatorPetPackInspectOutput: async (payload) => ({ ok: true, payload }),
  creatorPetPackImportOutput: async (payload) => ({ ok: true, payload }),
  creatorModelHealthCheck: async (payload) => ({ ok: true, payload }),
  creatorModelImageGenerate: async (payload) => ({ ok: true, payload })
})

const createService = (appendLog = () => {}) => createPluginCommandBridgeService({
  appendLog,
  createRunId: () => 'run-id',
  createToken: () => 'bridge-token'
})

test('plugin command bridge service serves read routes without json content type', async (t) => {
  const service = createService()
  t.after(() => service.close())
  const run = await service.createRun({ pluginId: 'weather', commandId: 'refresh', handlers: createHandlers() })

  const response = await requestJson(`${run.baseUrl}/context`)

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, { ok: true, route: 'context' })
})

test('plugin command bridge service dispatches json routes with payloads', async (t) => {
  const calls = []
  const service = createService()
  t.after(() => service.close())
  const run = await service.createRun({ pluginId: 'weather', commandId: 'refresh', handlers: createHandlers(calls) })

  const response = await requestJson(`${run.baseUrl}/pet/say`, {
    body: { text: 'hello' }
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.body, { ok: true, payload: { text: 'hello' } })
  assert.deepEqual(calls, [['petSay', { text: 'hello' }]])
})

test('plugin command bridge service rejects unknown expired and unauthorized requests', async (t) => {
  const logs = []
  const service = createService((entry) => logs.push(entry))
  t.after(() => service.close())
  const run = await service.createRun({ pluginId: 'weather', commandId: 'refresh', handlers: createHandlers() })

  const unknown = await requestJson(`${run.baseUrl}/missing`)
  const unauthorized = await requestJson(`${run.baseUrl}/context`, { token: 'wrong-token' })
  service.deleteRun('weather', 'refresh', run.runId)
  const expired = await requestJson(`${run.baseUrl}/context`)

  assert.equal(unknown.statusCode, 404)
  assert.deepEqual(unknown.body, { ok: false, error: 'Not found' })
  assert.equal(unauthorized.statusCode, 401)
  assert.deepEqual(unauthorized.body, { ok: false, error: 'Unauthorized' })
  assert.deepEqual(logs, [{
    pluginId: 'weather',
    commandId: 'refresh',
    level: 'error',
    message: 'Bridge request rejected: unauthorized token'
  }])
  assert.equal(expired.statusCode, 401)
  assert.deepEqual(expired.body, { ok: false, error: 'Bridge token expired' })
})

test('plugin command bridge service requires json content type for mutating routes', async (t) => {
  const service = createService()
  t.after(() => service.close())
  const run = await service.createRun({ pluginId: 'weather', commandId: 'refresh', handlers: createHandlers() })

  const response = await requestJson(`${run.baseUrl}/pet/say`, {
    body: { text: 'hello' },
    headers: { 'Content-Type': 'text/plain' }
  })

  assert.equal(response.statusCode, 415)
  assert.deepEqual(response.body, { ok: false, error: 'Content-Type must be application/json' })
})

test('plugin command bridge service maps permission errors to forbidden responses', async (t) => {
  const service = createService()
  t.after(() => service.close())
  const run = await service.createRun({
    pluginId: 'weather',
    commandId: 'refresh',
    handlers: {
      ...createHandlers(),
      petSay: async () => {
        throw new Error('Plugin does not have pet:say permission')
      }
    }
  })

  const response = await requestJson(`${run.baseUrl}/pet/say`, {
    body: { text: 'hello' }
  })

  assert.equal(response.statusCode, 403)
  assert.deepEqual(response.body, { ok: false, error: 'Plugin does not have pet:say permission' })
})

test('plugin command bridge service clears runs and closes the server', async () => {
  const service = createService()
  const run = await service.createRun({ pluginId: 'weather', commandId: 'refresh', handlers: createHandlers() })
  assert.equal(service.size(), 1)
  assert.equal(service.deleteRun('weather', 'refresh', run.runId), true)
  assert.equal(service.size(), 0)

  await service.createRun({ pluginId: 'weather', commandId: 'refresh', handlers: createHandlers() })
  assert.equal(service.size(), 1)
  service.close()
  assert.equal(service.size(), 0)
})

test('plugin command bridge service route maps stay synchronized with bridge inventory', () => {
  const readRoutes = Object.fromEntries(
    PLUGIN_BRIDGE_ROUTE_INVENTORY
      .filter((entry) => entry.method === 'GET')
      .map((entry) => [entry.path, entry.handlerName])
  )
  const jsonRoutes = Object.fromEntries(
    PLUGIN_BRIDGE_ROUTE_INVENTORY
      .filter((entry) => entry.method === 'POST')
      .map((entry) => [entry.path, entry.handlerName])
  )

  assert.deepEqual(READ_ROUTE_HANDLERS, readRoutes)
  assert.deepEqual(JSON_ROUTE_HANDLERS, jsonRoutes)
})
