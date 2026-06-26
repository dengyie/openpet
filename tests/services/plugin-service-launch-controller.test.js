const test = require('node:test')
const assert = require('node:assert/strict')

const { createPluginServiceLaunchController } = require('../../src/main/services/plugin-service-launch-controller')

test('launch controller resolves platform service declarations', () => {
  const controller = createPluginServiceLaunchController({
    platform: 'darwin',
    parseCommand: () => ({ file: 'npm', args: ['run', 'start'] }),
    resolveCwd: () => '/tmp/plugin',
    spawnServiceProcess: () => ({ pid: 1 })
  })

  const declaration = controller.resolveRuntimeDeclaration({
    command: 'npm run default',
    cwd: 'service',
    platforms: {
      darwin: {
        command: 'npm run mac-service',
        cwd: 'mac-service'
      }
    }
  })

  assert.deepEqual(declaration, {
    command: 'npm run mac-service',
    cwd: 'mac-service'
  })
})

test('launch controller assembles service spawn inputs with fixed options', () => {
  const calls = []
  const controller = createPluginServiceLaunchController({
    parseCommand: (command) => {
      assert.equal(command, 'npm run service:start')
      return { file: 'npm', args: ['run', 'service:start'] }
    },
    resolveCwd: (manifest, cwd) => {
      assert.equal(manifest.id, 'weather-declaration')
      assert.equal(cwd, 'service')
      return '/plugins/weather-declaration/service'
    },
    createEnv: () => ({ PATH: '/usr/bin' }),
    spawnServiceProcess: (file, args, options) => {
      calls.push({ file, args, options })
      return { pid: 4321 }
    }
  })

  const started = controller.spawnRuntime({
    pluginManifest: { id: 'weather-declaration' },
    serviceEntry: {
      command: 'npm run service:start',
      cwd: 'service'
    }
  })

  assert.equal(started.child.pid, 4321)
  assert.equal(started.cwd, '/plugins/weather-declaration/service')
  assert.deepEqual(started.declaration, {
    command: 'npm run service:start',
    cwd: 'service'
  })
  assert.equal(calls[0].file, 'npm')
  assert.deepEqual(calls[0].args, ['run', 'service:start'])
  assert.deepEqual(calls[0].options, {
    cwd: '/plugins/weather-declaration/service',
    detached: true,
    env: { PATH: '/usr/bin' },
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0].options.env, 'OPENPET_BRIDGE_URL'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(calls[0].options.env, 'OPENPET_BRIDGE_TOKEN'), false)
})

test('launch controller propagates parser and cwd resolution failures', () => {
  const parserErrorController = createPluginServiceLaunchController({
    parseCommand: () => { throw new Error('command invalid') },
    resolveCwd: () => '/tmp/plugin',
    spawnServiceProcess: () => ({ pid: 1 })
  })

  assert.throws(
    () => parserErrorController.spawnRuntime({
      pluginManifest: { id: 'weather-declaration' },
      serviceEntry: { command: 'bad', cwd: '.' }
    }),
    /command invalid/
  )

  const cwdErrorController = createPluginServiceLaunchController({
    parseCommand: () => ({ file: 'npm', args: [] }),
    resolveCwd: () => { throw new Error('cwd invalid') },
    spawnServiceProcess: () => ({ pid: 1 })
  })

  assert.throws(
    () => cwdErrorController.spawnRuntime({
      pluginManifest: { id: 'weather-declaration' },
      serviceEntry: { command: 'npm', cwd: '.' }
    }),
    /cwd invalid/
  )
})
