const crypto = require('crypto')
const http = require('http')

const { PLUGIN_BRIDGE_ROUTE_INVENTORY } = require('./plugin-bridge-handlers-controller')

const PLUGIN_BRIDGE_HOST = '127.0.0.1'
const MAX_PLUGIN_BRIDGE_BODY_BYTES = 1024 * 1024

const createPluginBridgeKey = (pluginId, commandId, runId) => `${pluginId}:${commandId}:${runId}`

const createPluginBridgeToken = () => crypto.randomBytes(24).toString('base64url')

const createPluginBridgeRunId = () => crypto.randomBytes(12).toString('base64url')

const extractBearerToken = (header = '') => {
  const match = String(header).match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : ''
}

const safeTokenEquals = (candidate, expected) => {
  const candidateBuffer = Buffer.from(String(candidate || ''))
  const expectedBuffer = Buffer.from(String(expected || ''))
  return candidateBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(candidateBuffer, expectedBuffer)
}

const isJsonRequest = (request) => {
  const contentType = String(request.headers['content-type'] || '').toLowerCase()
  return contentType.startsWith('application/json')
}

const readJsonBody = (request, maxBodyBytes = MAX_PLUGIN_BRIDGE_BODY_BYTES) => new Promise((resolve, reject) => {
  let body = ''
  request.on('data', (chunk) => {
    body += chunk
    if (body.length > maxBodyBytes) {
      request.destroy()
      reject(new Error('Request body is too large'))
    }
  })
  request.on('end', () => {
    if (!body) {
      resolve({})
      return
    }
    try {
      resolve(JSON.parse(body))
    } catch (_) {
      reject(new Error('Invalid JSON body'))
    }
  })
  request.on('error', reject)
})

const sendJson = (response, statusCode, body) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  })
  response.end(JSON.stringify(body))
}

const READ_ROUTE_HANDLERS = Object.fromEntries(
  PLUGIN_BRIDGE_ROUTE_INVENTORY
    .filter((entry) => entry.method === 'GET')
    .map((entry) => [entry.path, entry.handlerName])
)

const JSON_ROUTE_HANDLERS = Object.fromEntries(
  PLUGIN_BRIDGE_ROUTE_INVENTORY
    .filter((entry) => entry.method === 'POST')
    .map((entry) => [entry.path, entry.handlerName])
)

const BRIDGE_ROUTE_PATTERN = new RegExp(
  `^/plugins/bridge/([^/]+)/([^/]+)/([^/]+)(${[
    ...Object.keys(READ_ROUTE_HANDLERS),
    ...Object.keys(JSON_ROUTE_HANDLERS)
  ].map((route) => route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`
)

const createPluginCommandBridgeService = ({
  appendLog = () => {},
  createRunId = createPluginBridgeRunId,
  createToken = createPluginBridgeToken,
  host = PLUGIN_BRIDGE_HOST,
  maxBodyBytes = MAX_PLUGIN_BRIDGE_BODY_BYTES
} = {}) => {
  const runtimes = new Map()
  let server = null
  let port = 0

  const getRuntime = (pluginId, commandId, runId) => runtimes.get(createPluginBridgeKey(pluginId, commandId, runId))

  const deleteRun = (pluginId, commandId, runId) => {
    const deleted = runtimes.delete(createPluginBridgeKey(pluginId, commandId, runId))
    if (server && runtimes.size === 0) server.unref?.()
    return deleted
  }

  const handleRequest = async (request, response) => {
    try {
      const url = new URL(request.url, `http://${host}`)
      const match = url.pathname.match(BRIDGE_ROUTE_PATTERN)
      if (!match) {
        sendJson(response, 404, { ok: false, error: 'Not found' })
        return
      }
      const [, pluginId, commandId, runId, route] = match
      const runtime = getRuntime(pluginId, commandId, runId)
      if (!runtime || runtime.status !== 'running') {
        sendJson(response, 401, { ok: false, error: 'Bridge token expired' })
        return
      }

      const token = extractBearerToken(request.headers.authorization)
      if (!safeTokenEquals(token, runtime.token)) {
        appendLog({ pluginId, commandId, level: 'error', message: 'Bridge request rejected: unauthorized token' })
        sendJson(response, 401, { ok: false, error: 'Unauthorized' })
        return
      }

      const readHandlerName = READ_ROUTE_HANDLERS[route]
      if (readHandlerName) {
        sendJson(response, 200, await runtime.handlers[readHandlerName]())
        return
      }

      const jsonHandlerName = JSON_ROUTE_HANDLERS[route]
      if (!jsonHandlerName) {
        sendJson(response, 404, { ok: false, error: 'Not found' })
        return
      }
      if (!isJsonRequest(request)) {
        sendJson(response, 415, { ok: false, error: 'Content-Type must be application/json' })
        return
      }

      const payload = await readJsonBody(request, maxBodyBytes)
      sendJson(response, 200, await runtime.handlers[jsonHandlerName](payload))
    } catch (error) {
      const statusCode = /does not have/.test(String(error.message || '')) ? 403 : 400
      sendJson(response, statusCode, { ok: false, error: error.message || 'Bridge request failed' })
    }
  }

  const ensureServer = async () => {
    if (server?.listening) return port
    if (server && !server.listening) {
      server.removeAllListeners()
      server = null
      port = 0
    }

    server = http.createServer(handleRequest)

    await new Promise((resolve, reject) => {
      const onError = (error) => {
        server?.off?.('listening', onListening)
        reject(error)
      }
      const onListening = () => {
        server?.off?.('error', onError)
        const address = server.address()
        port = typeof address === 'object' && address ? Number(address.port) || 0 : 0
        server?.unref?.()
        resolve()
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(0, host)
    })

    return port
  }

  const createRun = async ({ pluginId, commandId, handlers }) => {
    const serverPort = await ensureServer()
    const runId = createRunId()
    const token = createToken()
    runtimes.set(createPluginBridgeKey(pluginId, commandId, runId), {
      pluginId,
      commandId,
      runId,
      token,
      status: 'running',
      handlers
    })
    return {
      baseUrl: `http://${host}:${serverPort}/plugins/bridge/${pluginId}/${commandId}/${runId}`,
      runId,
      token
    }
  }

  const clearRuns = () => runtimes.clear()

  const close = () => {
    clearRuns()
    if (server) {
      server.close?.()
      server = null
      port = 0
    }
  }

  const size = () => runtimes.size

  return {
    clearRuns,
    close,
    createRun,
    deleteRun,
    ensureServer,
    getRuntime,
    size
  }
}

module.exports = {
  MAX_PLUGIN_BRIDGE_BODY_BYTES,
  PLUGIN_BRIDGE_HOST,
  READ_ROUTE_HANDLERS,
  JSON_ROUTE_HANDLERS,
  createPluginBridgeKey,
  createPluginBridgeRunId,
  createPluginBridgeToken,
  createPluginCommandBridgeService,
  extractBearerToken,
  safeTokenEquals
}
