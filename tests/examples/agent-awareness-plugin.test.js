const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { normalizePluginManifest } = require('../../src/main/plugins/manifest')
const { normalizeCodexEvent } = require('../../examples/plugins/agent-awareness/service/adapters/codex')
const { createSessionStore } = require('../../examples/plugins/agent-awareness/service/session-store')
const { createAgentStateMapper } = require('../../examples/plugins/agent-awareness/service/state-mapper')
const { createAgentAwarenessServer } = require('../../examples/plugins/agent-awareness/service/agent-awareness-service')
const { INGEST_TOKEN_FILE, writeCodexHookPlan, writeCodexHookRemovalPlan } = require('../../examples/plugins/agent-awareness/commands/codex-hook-plan')

const pluginRoot = path.resolve(__dirname, '../../examples/plugins/agent-awareness')

test('agent awareness manifest declares bounded service and command entries', () => {
  const manifest = normalizePluginManifest(
    JSON.parse(fs.readFileSync(path.join(pluginRoot, 'plugin.json'), 'utf-8')),
    { source: 'local', basePath: pluginRoot }
  )

  assert.equal(manifest.id, 'openpet.agent-awareness')
  assert.equal(manifest.profile, 'runtime')
  assert.deepEqual(manifest.permissions, ['pet:say', 'pet:event'])
  assert.deepEqual(manifest.commands.map((command) => command.id), [
    'install-codex-hooks',
    'uninstall-codex-hooks',
    'doctor'
  ])
  assert.equal(manifest.entries.services[0].id, 'agent-awareness')
  assert.equal(manifest.entries.dashboards[0].url, 'http://127.0.0.1:8795')
})

test('codex adapter stores only sanitized bounded event fields', () => {
  const event = normalizeCodexEvent({
    adapter: 'codex',
    sessionId: 'session with spaces',
    type: 'approval.requested',
    message: 'Need approval\nBearer secret-token\nsk-test123',
    cwd: '/Users/mango/private/project/OpenPet',
    prompt: 'do not store me',
    stdout: 'do not store me either'
  }, { now: () => '2026-07-02T00:00:00.000Z' })

  assert.equal(event.adapter, 'codex')
  assert.equal(event.status, 'waiting')
  assert.match(event.sessionId, /^session-[a-f0-9]{16}$/)
  assert.equal(event.message, 'Need approval Bearer [redacted] [redacted-key]')
  assert.equal(event.cwdName, 'OpenPet')
  assert.match(event.cwdHash, /^[a-f0-9]{16}$/)
  assert.equal(Object.prototype.hasOwnProperty.call(event, 'prompt'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(event, 'stdout'), false)
})

test('session store upserts sanitized sessions and keeps bounded history', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpet-agent-awareness-store-'))
  const store = createSessionStore({ dataDir, now: () => '2026-07-02T00:00:00.000Z' })

  store.upsertEvent({
    adapter: 'codex',
    sessionId: 'session-1',
    status: 'working',
    type: 'tool.started',
    message: 'Running tests',
    cwdName: 'OpenPet',
    cwdHash: 'abc',
    toolName: 'shell',
    timestamp: '2026-07-02T00:00:00.000Z'
  })
  store.upsertEvent({
    adapter: 'codex',
    sessionId: 'session-1',
    status: 'completed',
    type: 'turn.completed',
    message: 'Tests passed',
    cwdName: 'OpenPet',
    cwdHash: 'abc',
    toolName: '',
    timestamp: '2026-07-02T00:00:01.000Z'
  })

  const [session] = store.listSessions()
  assert.equal(session.status, 'completed')
  assert.equal(session.history.length, 2)
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'sessions.json'), 'utf-8')).sessions[0].message, 'Tests passed')
})

test('state mapper emits pet event and rate-limited speech', () => {
  let currentNowMs = 1000
  const mapper = createAgentStateMapper({
    nowMs: () => currentNowMs,
    minSpeechIntervalMs: 5000
  })
  const event = { sessionId: 'session-1', status: 'working', message: 'Working now' }

  const first = mapper.mapEvent({ event, previousSession: null })
  const second = mapper.mapEvent({ event, previousSession: { status: 'working' } })
  currentNowMs = 7000
  const third = mapper.mapEvent({ event, previousSession: { status: 'working' } })

  assert.deepEqual(first.petEvent, { type: 'agent:working', message: 'Working now', ttlMs: 30000 })
  assert.deepEqual(first.speech, { text: 'Working now', ttlMs: 9000 })
  assert.equal(second.speech, null)
  assert.deepEqual(third.speech, { text: 'Working now', ttlMs: 9000 })
})

test('agent awareness service ingests events and calls the service bridge', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpet-agent-awareness-service-'))
  const bridgeCalls = []
  const service = createAgentAwarenessServer({
    dataDir,
    bridgeClient: {
      event: async (payload) => bridgeCalls.push(['event', payload]),
      say: async (payload) => bridgeCalls.push(['say', payload])
    },
    now: () => '2026-07-02T00:00:00.000Z'
  })

  const result = await service.handleEvent({
    adapter: 'codex',
    sessionId: 'codex-1',
    type: 'turn.completed',
    message: 'Done',
    cwd: '/tmp/OpenPet'
  })

  assert.equal(result.event.status, 'completed')
  assert.equal(result.session.sessionId, 'codex-1')
  assert.deepEqual(bridgeCalls, [
    ['event', { type: 'agent:completed', message: 'Done', ttlMs: 8000 }],
    ['say', { text: 'Done', ttlMs: 6000 }]
  ])
})

test('agent awareness service HTTP ingestion requires the generated local token', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpet-agent-awareness-http-'))
  fs.writeFileSync(path.join(dataDir, INGEST_TOKEN_FILE), 'local-token\n')
  const service = createAgentAwarenessServer({
    dataDir,
    bridgeClient: {
      event: async () => {},
      say: async () => {}
    },
    now: () => '2026-07-02T00:00:00.000Z'
  })
  await service.start(0)
  const address = service.server.address()
  const url = `http://127.0.0.1:${address.port}/api/events`

  const unauthorized = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 'codex-1', status: 'working' })
  })
  const authorized = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer local-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sessionId: 'codex-1', status: 'completed', message: 'Done' })
  })
  await service.close()

  assert.equal(unauthorized.status, 401)
  assert.equal(authorized.status, 200)
})

test('codex hook commands generate manual instructions without external writes', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpet-agent-awareness-hooks-'))
  const installPlan = writeCodexHookPlan({ paths: { dataDir } })
  const removalPlan = writeCodexHookRemovalPlan({ paths: { dataDir } })

  assert.equal(installPlan.serviceUrl, 'http://127.0.0.1:8795/api/events')
  assert.equal(fs.existsSync(installPlan.tokenPath), true)
  assert.equal(fs.existsSync(installPlan.instructionsPath), true)
  assert.equal(fs.existsSync(removalPlan.removalPath), true)
  assert.match(fs.readFileSync(installPlan.instructionsPath, 'utf-8'), /Authorization: Bearer/i)
  assert.match(fs.readFileSync(installPlan.instructionsPath, 'utf-8'), /does not modify Codex configuration automatically/i)
})
