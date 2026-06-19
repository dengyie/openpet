const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')

const { createImageGenerationModelService } = require('../../src/main/services/image-generation-model-service')

const createSettingsService = (initialSettings = {}) => {
  let current = {
    models: {},
    ...initialSettings
  }

  return {
    get: () => current,
    save: (next) => {
      current = next
      return current
    }
  }
}

const createSecretService = (initial = {}) => {
  const store = new Map(Object.entries(initial))
  return {
    setSecret: ({ id, value, label }) => {
      store.set(id, { value, label: label || id })
      return { id, label: label || id, hasValue: Boolean(value) }
    },
    getSecretValue: (id) => store.get(id)?.value || '',
    deleteSecret: (id) => {
      store.delete(id)
    },
    listSecretRefs: () => Array.from(store.entries()).map(([id, secret]) => ({
      id,
      label: secret.label || id,
      hasValue: Boolean(secret.value)
    }))
  }
}

test('image generation model service exposes a renderer-safe config view', () => {
  const service = createImageGenerationModelService({
    settingsService: createSettingsService({
      models: {
        imageGeneration: {
          defaultBackend: 'cloud',
          cloud: {
            provider: 'openai',
            baseUrl: 'https://api.openai.com/v1/',
            model: 'gpt-image-1',
            apiKeyRef: 'secret:model.image.openai.apiKey'
          }
        }
      }
    }),
    secretService: createSecretService({
      'secret:model.image.openai.apiKey': { value: 'sk-test-abcd', label: 'Image API Key' }
    })
  })

  const config = service.getConfig()

  assert.equal(config.defaultBackend, 'cloud')
  assert.equal(config.cloud.baseUrl, 'https://api.openai.com/v1')
  assert.equal(config.cloud.hasApiKey, true)
  assert.equal(config.cloud.apiKeyPreview, '••••abcd')
  assert.equal(Object.hasOwn(config.cloud, 'apiKey'), false)
})

test('image generation model service saves config without persisting derived secret fields', () => {
  const settingsService = createSettingsService()
  const service = createImageGenerationModelService({
    settingsService,
    secretService: createSecretService()
  })

  const saved = service.saveConfig({
    defaultBackend: 'local',
    cloud: {
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-image-1',
      apiKeyRef: 'secret:model.image.openai.apiKey',
      hasApiKey: true,
      apiKeyPreview: '••••abcd'
    },
    local: {
      endpoint: 'http://127.0.0.1:7860/generate',
      healthUrl: 'http://127.0.0.1:7860/health',
      model: 'local-pet-sprite',
      timeoutMs: 90000,
      maxConcurrentJobs: 2
    }
  })

  assert.equal(saved.defaultBackend, 'local')
  assert.equal(saved.local.timeoutMs, 90000)
  assert.equal(Object.hasOwn(settingsService.get().models.imageGeneration.cloud, 'hasApiKey'), false)
  assert.equal(Object.hasOwn(settingsService.get().models.imageGeneration.cloud, 'apiKeyPreview'), false)
})

test('image generation model service saves and clears cloud api keys through secret service', () => {
  const secretService = createSecretService()
  const service = createImageGenerationModelService({
    settingsService: createSettingsService(),
    secretService
  })

  const saved = service.saveCloudApiKey('sk-demo-1234')
  assert.equal(saved.hasApiKey, true)
  assert.equal(saved.apiKeyPreview, '••••1234')

  const cleared = service.clearCloudApiKey()
  assert.equal(cleared.hasApiKey, false)
  assert.equal(cleared.apiKeyPreview, '')
})

test('image generation model service reports missing cloud api key in health checks', async () => {
  const service = createImageGenerationModelService({
    settingsService: createSettingsService({
      models: {
        imageGeneration: {
          defaultBackend: 'cloud',
          cloud: {
            provider: 'openai',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-image-1',
            apiKeyRef: 'secret:model.image.openai.apiKey'
          }
        }
      }
    }),
    secretService: createSecretService()
  })

  const result = await service.checkHealth({ backend: 'cloud' })

  assert.equal(result.ok, false)
  assert.equal(result.code, 'missing_api_key')
})

test('image generation model service checks local endpoints through loopback-only health urls', async () => {
  const requests = []
  const service = createImageGenerationModelService({
    settingsService: createSettingsService({
      models: {
        imageGeneration: {
          defaultBackend: 'local',
          local: {
            endpoint: 'http://127.0.0.1:7860/generate',
            healthUrl: 'http://127.0.0.1:7860/health',
            model: 'local-pet-sprite',
            timeoutMs: 120000,
            maxConcurrentJobs: 1
          }
        }
      }
    }),
    secretService: createSecretService(),
    fetchImpl: async (url) => {
      requests.push(url)
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true })
      }
    }
  })

  const result = await service.checkHealth({ backend: 'local' })

  assert.equal(result.ok, true)
  assert.equal(requests[0], 'http://127.0.0.1:7860/health')
})

test('image generation model service rejects non-loopback local urls', async () => {
  const service = createImageGenerationModelService({
    settingsService: createSettingsService({
      models: {
        imageGeneration: {
          defaultBackend: 'local',
          local: {
            endpoint: 'http://192.168.1.20:7860/generate',
            healthUrl: 'http://192.168.1.20:7860/health',
            model: 'local-pet-sprite',
            timeoutMs: 120000,
            maxConcurrentJobs: 1
          }
        }
      }
    }),
    secretService: createSecretService()
  })

  await assert.rejects(
    () => service.checkHealth({ backend: 'local' }),
    /loopback/i
  )
})

test('image generation model service writes generated cloud outputs under the allowed data directory', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpet-image-generation-'))
  const requests = []
  const service = createImageGenerationModelService({
    settingsService: createSettingsService({
      models: {
        imageGeneration: {
          defaultBackend: 'cloud',
          cloud: {
            provider: 'openai',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-image-1',
            apiKeyRef: 'secret:model.image.openai.apiKey'
          }
        }
      }
    }),
    secretService: createSecretService({
      'secret:model.image.openai.apiKey': { value: 'sk-test-1234', label: 'Image API Key' }
    }),
    fetchImpl: async (url, options) => {
      requests.push({ url, options })
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { b64_json: Buffer.from('fake-image-bytes').toString('base64') }
          ]
        })
      }
    },
    now: () => new Date('2026-06-19T00:00:00.000Z')
  })

  const result = await service.generateImage({
    backend: 'cloud',
    prompt: 'small mint helper cat, transparent background',
    output: {
      dataDir,
      dataRelativeDir: 'runs/2026-06-19-sprout-cat/frames/base'
    },
    constraints: {
      width: 1024,
      height: 1024,
      transparent: true
    }
  })

  assert.equal(result.ok, true)
  assert.equal(result.outputs.length, 1)
  assert.match(result.outputs[0].dataRelativePath, /^runs\/2026-06-19-sprout-cat\/frames\/base\/0001\.png$/)
  assert.equal(fs.existsSync(path.join(dataDir, result.outputs[0].dataRelativePath)), true)
  assert.equal(requests[0].url, 'https://api.openai.com/v1/images/generations')
})

test('image generation model service rejects output paths outside the allowed data directory', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpet-image-generation-'))
  const service = createImageGenerationModelService({
    settingsService: createSettingsService(),
    secretService: createSecretService()
  })

  await assert.rejects(
    () => service.generateImage({
      backend: 'fixture',
      prompt: 'no-op',
      output: {
        dataDir,
        dataRelativeDir: '../escape'
      },
      constraints: {
        width: 512,
        height: 512,
        transparent: true
      }
    }),
    /allowed data directory/i
  )
})
