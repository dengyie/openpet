const createPluginListingController = ({
  getSetupRuntime,
  getServiceRuntime,
  createHealthView,
  getHealthPolicy,
  getEnabledMap,
  getPluginConfig,
  getPluginStorageStats,
  getPluginSignatureStatus,
  getPluginPolicyStatus
} = {}) => {
  if (typeof getSetupRuntime !== 'function') throw new Error('getSetupRuntime is required')
  if (typeof getServiceRuntime !== 'function') throw new Error('getServiceRuntime is required')
  if (typeof createHealthView !== 'function') throw new Error('createHealthView is required')
  if (typeof getHealthPolicy !== 'function') throw new Error('getHealthPolicy is required')
  if (typeof getEnabledMap !== 'function') throw new Error('getEnabledMap is required')
  if (typeof getPluginConfig !== 'function') throw new Error('getPluginConfig is required')
  if (typeof getPluginStorageStats !== 'function') throw new Error('getPluginStorageStats is required')
  if (typeof getPluginSignatureStatus !== 'function') throw new Error('getPluginSignatureStatus is required')
  if (typeof getPluginPolicyStatus !== 'function') throw new Error('getPluginPolicyStatus is required')

  const createRuntimeView = (runtime, serviceEntry = {}) => {
    if (!runtime) {
      return {
        status: 'stopped',
        health: createHealthView({}, serviceEntry)
      }
    }
    return {
      status: runtime.status || 'stopped',
      pid: runtime.pid || 0,
      startedAt: runtime.startedAt || '',
      stoppedAt: runtime.stoppedAt || '',
      command: runtime.command || '',
      cwd: runtime.cwd || '',
      exitCode: Number.isFinite(runtime.exitCode) ? runtime.exitCode : null,
      signal: runtime.signal || '',
      error: runtime.error || '',
      health: createHealthView(runtime.health || {}, serviceEntry)
    }
  }

  const createSetupRuntimeView = (runtime = null) => {
    const view = runtime || {}
    return {
      status: view.status || 'not-run',
      lastRunAt: view.lastRunAt || '',
      exitCode: Number.isFinite(view.exitCode) ? view.exitCode : null,
      error: view.error || ''
    }
  }

  const decorateEntriesWithRuntime = (manifest) => ({
    ...manifest.entries,
    setup: (manifest.entries?.setup || []).map((setupEntry) => ({
      ...setupEntry,
      runtime: createSetupRuntimeView(getSetupRuntime(manifest.id, setupEntry.id))
    })),
    services: (manifest.entries?.services || []).map((serviceEntry) => ({
      ...serviceEntry,
      healthPolicy: getHealthPolicy(manifest.id, serviceEntry.id),
      runtime: createRuntimeView(getServiceRuntime(manifest.id, serviceEntry.id), serviceEntry)
    }))
  })

  const listPlugins = (plugins = []) => plugins.map((plugin) => ({
    ...plugin.manifest,
    profile: plugin.manifest.profile || 'runtime',
    entries: decorateEntriesWithRuntime(plugin.manifest),
    enabled: Boolean(getEnabledMap()[plugin.manifest.id]),
    runnable: typeof plugin.activate === 'function' || Boolean(plugin.mainPath) || Boolean(plugin.manifest.entries?.commands?.length),
    signatureStatus: getPluginSignatureStatus(plugin.manifest),
    blockStatus: getPluginPolicyStatus(plugin.manifest),
    configSchema: plugin.configSchema,
    config: getPluginConfig(plugin.manifest.id, plugin.configSchema),
    storage: getPluginStorageStats(plugin.manifest.id)
  }))

  return {
    createRuntimeView,
    createSetupRuntimeView,
    decorateEntriesWithRuntime,
    listPlugins
  }
}

module.exports = {
  createPluginListingController
}
