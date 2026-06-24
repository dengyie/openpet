const ACTIVE_SETUP_STATUSES = new Set(['running', 'stopping'])

const createPluginSetupRuntimeKey = (pluginId, setupId) => `${pluginId}:${setupId}`

const createPluginSetupRuntimeManager = ({
  appendLog = () => {},
  now = () => new Date().toISOString(),
  stopRuntimeProcess
} = {}) => {
  if (typeof stopRuntimeProcess !== 'function') throw new Error('stopRuntimeProcess is required')

  const runtimes = new Map()

  const getRuntime = (pluginId, setupId) => runtimes.get(createPluginSetupRuntimeKey(pluginId, setupId))

  const setRuntime = (runtime) => {
    if (!runtime?.pluginId) throw new Error('Plugin setup runtime pluginId is required')
    if (!runtime?.setupId) throw new Error('Plugin setup runtime setupId is required')
    runtimes.set(createPluginSetupRuntimeKey(runtime.pluginId, runtime.setupId), runtime)
    return runtime
  }

  const assertNotActive = (pluginId, setupId, message = 'Plugin setup is already running') => {
    const existingRuntime = getRuntime(pluginId, setupId)
    if (ACTIVE_SETUP_STATUSES.has(existingRuntime?.status)) throw new Error(message)
  }

  const attachStopHandler = (runtime) => {
    runtime.stop = ({ signal = 'SIGTERM' } = {}) => {
      runtime.status = 'stopping'
      runtime.error = ''
      runtime.exitCode = null
      runtime.lastRunAt = now()
      stopRuntimeProcess(runtime, signal)
      return true
    }
    return runtime
  }

  const stopRuntime = (pluginId, setupId, runtime = getRuntime(pluginId, setupId), { log = true } = {}) => {
    if (!runtime || runtime.status !== 'running') return runtime
    try {
      runtime.stop?.({ signal: 'SIGTERM' })
    } catch (error) {
      runtime.error = error.message || 'Plugin setup stop failed'
      runtime.status = 'failed'
    }
    if (log) appendLog({
      pluginId,
      commandId: `setup:${setupId}`,
      level: runtime.status === 'failed' ? 'error' : 'info',
      message: runtime.status === 'failed' ? runtime.error : 'Setup stop requested'
    })
    if (runtime.status === 'failed') runtime.failStop?.(new Error(runtime.error))
    return runtime
  }

  const stopPlugin = (pluginId, options = {}) => {
    for (const runtime of runtimes.values()) {
      if (runtime.pluginId === pluginId) {
        stopRuntime(pluginId, runtime.setupId, runtime, options)
      }
    }
  }

  const stopAll = (options = {}) => {
    for (const runtime of runtimes.values()) {
      stopRuntime(runtime.pluginId, runtime.setupId, runtime, options)
    }
  }

  const size = () => runtimes.size

  return {
    assertNotActive,
    attachStopHandler,
    getRuntime,
    setRuntime,
    size,
    stopAll,
    stopPlugin,
    stopRuntime
  }
}

module.exports = {
  ACTIVE_SETUP_STATUSES,
  createPluginSetupRuntimeKey,
  createPluginSetupRuntimeManager
}
