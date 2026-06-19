const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const DEFAULT_CONFIG = {
  defaultBackend: 'fixture',
  cloud: {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-image-1',
    apiKeyRef: 'secret:model.image.openai.apiKey',
    organization: '',
    project: ''
  },
  local: {
    endpoint: 'http://127.0.0.1:7860/generate',
    healthUrl: 'http://127.0.0.1:7860/health',
    model: 'local-pet-sprite',
    timeoutMs: 120000,
    maxConcurrentJobs: 1
  }
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value)

const normalizeBaseUrl = (value, fallback) => String(value || fallback || '').trim().replace(/\/+$/, '')

const normalizeConfig = (config = {}) => ({
  defaultBackend: ['fixture', 'cloud', 'local'].includes(config?.defaultBackend) ? config.defaultBackend : DEFAULT_CONFIG.defaultBackend,
  cloud: {
    ...DEFAULT_CONFIG.cloud,
    ...(isPlainObject(config.cloud) ? config.cloud : {}),
    provider: String(config?.cloud?.provider || DEFAULT_CONFIG.cloud.provider).trim() || DEFAULT_CONFIG.cloud.provider,
    baseUrl: normalizeBaseUrl(config?.cloud?.baseUrl, DEFAULT_CONFIG.cloud.baseUrl),
    model: String(config?.cloud?.model || DEFAULT_CONFIG.cloud.model).trim() || DEFAULT_CONFIG.cloud.model,
    apiKeyRef: String(config?.cloud?.apiKeyRef || DEFAULT_CONFIG.cloud.apiKeyRef).trim() || DEFAULT_CONFIG.cloud.apiKeyRef,
    organization: String(config?.cloud?.organization || '').trim(),
    project: String(config?.cloud?.project || '').trim()
  },
  local: {
    ...DEFAULT_CONFIG.local,
    ...(isPlainObject(config.local) ? config.local : {}),
    endpoint: String(config?.local?.endpoint || DEFAULT_CONFIG.local.endpoint).trim() || DEFAULT_CONFIG.local.endpoint,
    healthUrl: String(config?.local?.healthUrl || DEFAULT_CONFIG.local.healthUrl).trim() || DEFAULT_CONFIG.local.healthUrl,
    model: String(config?.local?.model || DEFAULT_CONFIG.local.model).trim() || DEFAULT_CONFIG.local.model,
    timeoutMs: Math.max(1000, Number(config?.local?.timeoutMs ?? DEFAULT_CONFIG.local.timeoutMs) || DEFAULT_CONFIG.local.timeoutMs),
    maxConcurrentJobs: Math.max(1, Number(config?.local?.maxConcurrentJobs ?? DEFAULT_CONFIG.local.maxConcurrentJobs) || DEFAULT_CONFIG.local.maxConcurrentJobs)
  }
})

const toPersistedConfig = (config = {}) => normalizeConfig({
  defaultBackend: config.defaultBackend,
  cloud: {
    provider: config?.cloud?.provider,
    baseUrl: config?.cloud?.baseUrl,
    model: config?.cloud?.model,
    apiKeyRef: config?.cloud?.apiKeyRef,
    organization: config?.cloud?.organization,
    project: config?.cloud?.project
  },
  local: {
    endpoint: config?.local?.endpoint,
    healthUrl: config?.local?.healthUrl,
    model: config?.local?.model,
    timeoutMs: config?.local?.timeoutMs,
    maxConcurrentJobs: config?.local?.maxConcurrentJobs
  }
})

const maskSecret = (value) => {
  const text = String(value || '').trim()
  if (!text) return ''
  return `••••${text.slice(-4)}`
}

const assertLoopbackUrl = (value, fieldName) => {
  let parsed
  try {
    parsed = new URL(String(value || ''))
  } catch (_) {
    throw new Error(`${fieldName} must be a valid URL`)
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${fieldName} must use HTTP or HTTPS`)
  }
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(`${fieldName} must use a loopback host`)
  }
  return parsed.toString()
}

const ensureInsideDataDir = ({ dataDir, dataRelativeDir }) => {
  const root = path.resolve(String(dataDir || ''))
  const relativeDir = String(dataRelativeDir || '').trim()
  if (!root || !relativeDir) throw new Error('Image generation output must target the allowed data directory')
  const targetDir = path.resolve(root, relativeDir)
  const relative = path.relative(root, targetDir)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Image generation output must stay inside the allowed data directory')
  }
  return { root, relativeDir, targetDir }
}

const sha256File = (filePath) => {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

const writeOutputPng = ({ targetDir, index, bytes }) => {
  fs.mkdirSync(targetDir, { recursive: true })
  const fileName = `${String(index).padStart(4, '0')}.png`
  const outputPath = path.join(targetDir, fileName)
  fs.writeFileSync(outputPath, bytes)
  return { outputPath, fileName }
}

const createImageGenerationModelService = ({
  settingsService,
  secretService,
  fetchImpl = globalThis.fetch,
  now = () => new Date()
} = {}) => {
  if (!settingsService) throw new Error('settingsService is required')
  if (!secretService) throw new Error('secretService is required')

  const getStoredConfig = () => normalizeConfig(settingsService.get().models?.imageGeneration)

  const saveStoredConfig = (config) => {
    const settings = settingsService.get()
    settingsService.save({
      ...settings,
      models: {
        ...(isPlainObject(settings.models) ? settings.models : {}),
        imageGeneration: config
      }
    })
  }

  const getConfig = () => {
    const config = getStoredConfig()
    const secretValue = secretService.getSecretValue(config.cloud.apiKeyRef)
    return {
      ...config,
      cloud: {
        ...config.cloud,
        hasApiKey: Boolean(secretValue),
        apiKeyPreview: maskSecret(secretValue),
        apiKeyLabel: 'Image API Key'
      }
    }
  }

  const saveConfig = (partialConfig = {}) => {
    const current = getStoredConfig()
    const next = toPersistedConfig({
      ...current,
      ...(isPlainObject(partialConfig) ? partialConfig : {}),
      cloud: {
        ...current.cloud,
        ...(isPlainObject(partialConfig.cloud) ? partialConfig.cloud : {})
      },
      local: {
        ...current.local,
        ...(isPlainObject(partialConfig.local) ? partialConfig.local : {})
      }
    })
    saveStoredConfig(next)
    return getConfig()
  }

  const saveCloudApiKey = (apiKey) => {
    const config = getStoredConfig()
    secretService.setSecret({
      id: config.cloud.apiKeyRef,
      value: String(apiKey || ''),
      label: 'Image API Key'
    })
    const saved = getConfig()
    return {
      apiKeyRef: saved.cloud.apiKeyRef,
      hasApiKey: saved.cloud.hasApiKey,
      apiKeyPreview: saved.cloud.apiKeyPreview
    }
  }

  const clearCloudApiKey = () => {
    const config = getStoredConfig()
    secretService.deleteSecret(config.cloud.apiKeyRef)
    return {
      apiKeyRef: config.cloud.apiKeyRef,
      hasApiKey: false,
      apiKeyPreview: ''
    }
  }

  const checkHealth = async ({ backend } = {}) => {
    const config = getStoredConfig()
    const targetBackend = backend || config.defaultBackend
    if (targetBackend === 'fixture') {
      return { ok: true, backend: 'fixture', code: 'fixture_ready', message: 'Fixture backend is available' }
    }

    if (targetBackend === 'cloud') {
      const apiKey = secretService.getSecretValue(config.cloud.apiKeyRef)
      if (!apiKey) {
        return { ok: false, backend: 'cloud', code: 'missing_api_key', message: 'Cloud image generation API key is missing' }
      }
      const response = await fetchImpl(`${config.cloud.baseUrl}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      })
      if (!response?.ok) {
        return { ok: false, backend: 'cloud', code: 'provider_unhealthy', message: `Cloud provider responded with HTTP ${response?.status || 'error'}` }
      }
      return { ok: true, backend: 'cloud', code: 'provider_healthy', message: 'Cloud provider is reachable' }
    }

    if (targetBackend === 'local') {
      const healthUrl = assertLoopbackUrl(config.local.healthUrl, 'Local health URL')
      const endpoint = assertLoopbackUrl(config.local.endpoint, 'Local endpoint URL')
      void endpoint
      const response = await fetchImpl(healthUrl, { method: 'GET' })
      if (!response?.ok) {
        return { ok: false, backend: 'local', code: 'endpoint_unhealthy', message: `Local endpoint responded with HTTP ${response?.status || 'error'}` }
      }
      return { ok: true, backend: 'local', code: 'endpoint_healthy', message: 'Local endpoint is reachable' }
    }

    throw new Error(`Unsupported image generation backend: ${targetBackend}`)
  }

  const generateFixtureImage = ({ targetDir, relativeDir }) => {
    const bytes = Buffer.from('fixture-image')
    const { outputPath, fileName } = writeOutputPng({ targetDir, index: 1, bytes })
    return {
      ok: true,
      backend: 'fixture',
      model: 'fixture-image',
      generatedAt: now().toISOString(),
      outputs: [{
        dataRelativePath: path.posix.join(relativeDir.replace(/\\/g, '/'), fileName),
        mimeType: 'image/png',
        sha256: sha256File(outputPath)
      }],
      usage: {
        estimatedCostUsd: 0
      }
    }
  }

  const generateCloudImage = async ({ config, prompt, targetDir, relativeDir, constraints }) => {
    const apiKey = secretService.getSecretValue(config.cloud.apiKeyRef)
    if (!apiKey) throw new Error('Cloud image generation API key is missing')
    const response = await fetchImpl(`${config.cloud.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.cloud.model,
        prompt,
        size: `${constraints.width}x${constraints.height}`,
        background: constraints.transparent ? 'transparent' : 'white',
        response_format: 'b64_json'
      })
    })
    if (!response?.ok) {
      throw new Error(`Cloud image generation failed with HTTP ${response?.status || 'error'}`)
    }
    const body = await response.json()
    const items = Array.isArray(body?.data) ? body.data : []
    if (!items.length) throw new Error('Cloud image generation returned no outputs')

    const outputs = items.map((item, index) => {
      const bytes = Buffer.from(String(item?.b64_json || ''), 'base64')
      const { outputPath, fileName } = writeOutputPng({ targetDir, index: index + 1, bytes })
      return {
        dataRelativePath: path.posix.join(relativeDir.replace(/\\/g, '/'), fileName),
        mimeType: 'image/png',
        sha256: sha256File(outputPath)
      }
    })

    return {
      ok: true,
      backend: 'cloud',
      model: config.cloud.model,
      generatedAt: now().toISOString(),
      outputs,
      usage: {
        estimatedCostUsd: 0
      }
    }
  }

  const generateLocalImage = async ({ config, prompt, targetDir, relativeDir, constraints }) => {
    const endpoint = assertLoopbackUrl(config.local.endpoint, 'Local endpoint URL')
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        model: config.local.model,
        width: constraints.width,
        height: constraints.height,
        transparent: Boolean(constraints.transparent)
      })
    })
    if (!response?.ok) {
      throw new Error(`Local image generation failed with HTTP ${response?.status || 'error'}`)
    }
    const body = await response.json()
    const items = Array.isArray(body?.outputs) ? body.outputs : []
    if (!items.length) throw new Error('Local image generation returned no outputs')

    const outputs = items.map((item, index) => {
      const bytes = Buffer.from(String(item?.b64 || ''), 'base64')
      const { outputPath, fileName } = writeOutputPng({ targetDir, index: index + 1, bytes })
      return {
        dataRelativePath: path.posix.join(relativeDir.replace(/\\/g, '/'), fileName),
        mimeType: 'image/png',
        sha256: sha256File(outputPath)
      }
    })

    return {
      ok: true,
      backend: 'local',
      model: config.local.model,
      generatedAt: now().toISOString(),
      outputs,
      usage: {
        estimatedCostUsd: 0
      }
    }
  }

  const generateImage = async ({ backend, prompt, output, constraints }) => {
    const config = getStoredConfig()
    const selectedBackend = backend || config.defaultBackend
    const { relativeDir, targetDir } = ensureInsideDataDir({
      dataDir: output?.dataDir,
      dataRelativeDir: output?.dataRelativeDir
    })

    if (selectedBackend === 'fixture') {
      return generateFixtureImage({ targetDir, relativeDir })
    }
    if (selectedBackend === 'cloud') {
      return generateCloudImage({ config, prompt, targetDir, relativeDir, constraints })
    }
    if (selectedBackend === 'local') {
      return generateLocalImage({ config, prompt, targetDir, relativeDir, constraints })
    }
    throw new Error(`Unsupported image generation backend: ${selectedBackend}`)
  }

  return {
    getConfig,
    saveConfig,
    saveCloudApiKey,
    clearCloudApiKey,
    checkHealth,
    generateImage
  }
}

module.exports = {
  DEFAULT_IMAGE_GENERATION_MODEL_CONFIG: DEFAULT_CONFIG,
  createImageGenerationModelService
}
