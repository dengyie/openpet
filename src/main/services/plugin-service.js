const fs = require('fs')
const path = require('path')
const { normalizePluginManifest } = require('../plugins/manifest')

const readLocalPluginManifests = (pluginDirs = []) => {
  const plugins = []

  for (const rootDir of pluginDirs) {
    if (!rootDir || !fs.existsSync(rootDir)) continue
    const entries = fs.readdirSync(rootDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const basePath = path.join(rootDir, entry.name)
      const manifestPath = path.join(basePath, 'plugin.json')
      if (!fs.existsSync(manifestPath)) continue
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
        plugins.push({
          manifest: normalizePluginManifest(manifest, { source: 'local', basePath }),
          activate: null
        })
      } catch (_) {
        // A broken third-party manifest should not prevent the app from listing other plugins.
      }
    }
  }

  return plugins
}

const createPluginService = ({ settingsService, petService, pluginDirs = [], officialPlugins = [] }) => {
  if (!settingsService) throw new Error('settingsService is required')
  if (!petService) throw new Error('petService is required')

  const logs = []
  let nextLogId = 1

  const appendLog = ({ level = 'info', pluginId = '', commandId = '', message = '' } = {}) => {
    const entry = {
      id: nextLogId,
      timestamp: new Date().toISOString(),
      level,
      pluginId,
      commandId,
      message: String(message || '')
    }
    nextLogId += 1
    logs.unshift(entry)
    logs.splice(100)
    return entry
  }

  const getPlugins = () => [
    ...officialPlugins.map((plugin) => ({
      manifest: normalizePluginManifest(plugin.manifest, { source: 'official' }),
      activate: plugin.activate
    })),
    ...readLocalPluginManifests(pluginDirs)
  ]

  const getEnabledMap = () => settingsService.get().plugins?.enabled || {}

  const listPlugins = () => getPlugins().map((plugin) => ({
    ...plugin.manifest,
    enabled: Boolean(getEnabledMap()[plugin.manifest.id]),
    runnable: typeof plugin.activate === 'function'
  }))

  const setEnabled = (pluginId, enabled) => {
    const settings = settingsService.get()
    const nextSettings = {
      ...settings,
      plugins: {
        ...(settings.plugins || {}),
        enabled: {
          ...(settings.plugins?.enabled || {}),
          [pluginId]: Boolean(enabled)
        }
      }
    }
    settingsService.save(nextSettings)
    appendLog({
      pluginId,
      level: 'info',
      message: enabled ? 'Plugin enabled' : 'Plugin disabled'
    })
    return listPlugins().find((plugin) => plugin.id === pluginId)
  }

  const createSdk = (manifest) => ({
    pet: {
      say: async (payload) => {
        if (!manifest.permissions.includes('pet:say')) {
          throw new Error(`Plugin ${manifest.id} does not have pet:say permission`)
        }
        return petService.say({ ...payload, source: `plugin:${manifest.id}` })
      }
    }
  })

  const runCommand = async (pluginId, commandId, payload = {}) => {
    try {
      const plugin = getPlugins().find((candidate) => candidate.manifest.id === pluginId)
      if (!plugin) throw new Error(`Plugin not found: ${pluginId}`)
      if (!getEnabledMap()[pluginId]) throw new Error('Plugin is disabled')
      if (typeof plugin.activate !== 'function') throw new Error('Plugin is not runnable')

      const commands = plugin.activate(createSdk(plugin.manifest))
      const handler = commands[commandId]
      if (typeof handler !== 'function') throw new Error(`Plugin command not found: ${commandId}`)
      appendLog({ pluginId, commandId, level: 'info', message: 'Command started' })
      const result = await handler(payload)
      appendLog({ pluginId, commandId, level: 'info', message: 'Command completed' })
      return result
    } catch (error) {
      appendLog({
        pluginId,
        commandId,
        level: 'error',
        message: error.message || 'Command failed'
      })
      throw error
    }
  }

  const getLogs = () => logs.map((entry) => ({ ...entry }))

  const clearLogs = () => {
    logs.length = 0
    return getLogs()
  }

  return { listPlugins, setEnabled, runCommand, getLogs, clearLogs }
}

module.exports = { createPluginService, readLocalPluginManifests }
