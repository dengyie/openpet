const createPluginManagementController = ({
  settingsService,
  assertPluginAllowed,
  stopPluginCommands,
  stopPluginServices,
  stopPluginSetups,
  appendLog,
  listPlugins,
  getPlugins,
  saveConfig,
  clearStorage,
  findPluginForService,
  getServiceEntry,
  normalizeServiceHealthPolicy,
  getServiceRuntime,
  clearServiceHealthSchedule,
  scheduleServiceHealthCheck
} = {}) => {
  if (!settingsService) throw new Error('settingsService is required')
  if (typeof assertPluginAllowed !== 'function') throw new Error('assertPluginAllowed is required')
  if (typeof stopPluginCommands !== 'function') throw new Error('stopPluginCommands is required')
  if (typeof stopPluginServices !== 'function') throw new Error('stopPluginServices is required')
  if (typeof stopPluginSetups !== 'function') throw new Error('stopPluginSetups is required')
  if (typeof appendLog !== 'function') throw new Error('appendLog is required')
  if (typeof listPlugins !== 'function') throw new Error('listPlugins is required')
  if (typeof getPlugins !== 'function') throw new Error('getPlugins is required')
  if (typeof saveConfig !== 'function') throw new Error('saveConfig is required')
  if (typeof clearStorage !== 'function') throw new Error('clearStorage is required')
  if (typeof findPluginForService !== 'function') throw new Error('findPluginForService is required')
  if (typeof getServiceEntry !== 'function') throw new Error('getServiceEntry is required')
  if (typeof normalizeServiceHealthPolicy !== 'function') throw new Error('normalizeServiceHealthPolicy is required')
  if (typeof getServiceRuntime !== 'function') throw new Error('getServiceRuntime is required')
  if (typeof clearServiceHealthSchedule !== 'function') throw new Error('clearServiceHealthSchedule is required')
  if (typeof scheduleServiceHealthCheck !== 'function') throw new Error('scheduleServiceHealthCheck is required')

  const findListedPlugin = (pluginId) => listPlugins().find((plugin) => plugin.id === pluginId)

  const setEnabled = (pluginId, enabled) => {
    if (enabled) assertPluginAllowed(pluginId)
    if (!enabled) {
      stopPluginCommands(pluginId)
      stopPluginServices(pluginId)
      stopPluginSetups(pluginId)
    }
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
    return findListedPlugin(pluginId)
  }

  const savePluginConfig = (pluginId, config = {}) => {
    const plugin = getPlugins().find((candidate) => candidate.manifest.id === pluginId)
    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`)
    if (!plugin.configSchema) throw new Error('Plugin does not declare a config schema')
    saveConfig(pluginId, plugin.configSchema, config)
    appendLog({ pluginId, level: 'info', message: 'Plugin config saved' })
    return findListedPlugin(pluginId)
  }

  const savePluginServiceHealthPolicy = (pluginId, serviceId, policy = {}) => {
    const plugin = findPluginForService(pluginId)
    const serviceEntry = getServiceEntry(plugin, serviceId)
    if (!serviceEntry.health?.url) throw new Error('Plugin service health check is not configured')
    const normalizedPolicy = normalizeServiceHealthPolicy(policy)
    const settings = settingsService.get()
    settingsService.save({
      ...settings,
      plugins: {
        ...(settings.plugins || {}),
        serviceHealthPolicies: {
          ...(settings.plugins?.serviceHealthPolicies || {}),
          [pluginId]: {
            ...(settings.plugins?.serviceHealthPolicies?.[pluginId] || {}),
            [serviceId]: normalizedPolicy
          }
        }
      }
    })

    const runtime = getServiceRuntime(pluginId, serviceId)
    if (runtime) {
      clearServiceHealthSchedule(runtime)
      scheduleServiceHealthCheck(pluginId, serviceId, runtime, serviceEntry)
    }
    appendLog({
      pluginId,
      commandId: `service:${serviceId}`,
      level: 'info',
      message: normalizedPolicy.enabled ? 'Service health policy saved' : 'Service health policy cleared'
    })
    return findListedPlugin(pluginId)
  }

  const clearPluginStorage = (pluginId) => {
    const plugin = getPlugins().find((candidate) => candidate.manifest.id === pluginId)
    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`)
    clearStorage(pluginId)
    appendLog({ pluginId, level: 'info', message: 'Plugin storage cleared' })
    return findListedPlugin(pluginId)
  }

  return {
    setEnabled,
    saveConfig: savePluginConfig,
    saveServiceHealthPolicy: savePluginServiceHealthPolicy,
    clearStorage: clearPluginStorage
  }
}

module.exports = {
  createPluginManagementController
}
