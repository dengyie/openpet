const PLUGIN_SERVICE_HEALTH_TIMEOUT_MS = 3000
const LOOPBACK_HEALTH_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

const createPluginServiceHealthController = ({
  appendLog = () => {},
  fetchImpl = globalThis.fetch,
  getPolicy = () => ({ enabled: false, intervalMs: 30000 }),
  createHealthView = (health) => health || {},
  setHealthTimer = setTimeout,
  clearHealthTimer = clearTimeout,
  timeoutMs = PLUGIN_SERVICE_HEALTH_TIMEOUT_MS
} = {}) => {
  const normalizeHealthUrl = (serviceEntry) => {
    const health = serviceEntry.health || {}
    const type = String(health.type || '').trim() || 'none'
    if (type === 'none' || !health.url) throw new Error('Plugin service health check is not configured')
    if (type !== 'http') throw new Error('Plugin service health type must be http')
    let healthUrl
    try {
      healthUrl = new URL(String(health.url || '').trim())
    } catch (_) {
      throw new Error('Plugin service health URL is invalid')
    }
    if (!['http:', 'https:'].includes(healthUrl.protocol)) {
      throw new Error('Plugin service health URL must use HTTP or HTTPS')
    }
    if (!LOOPBACK_HEALTH_HOSTS.has(healthUrl.hostname.toLowerCase())) {
      throw new Error('Plugin service health URL must use a loopback host')
    }
    return healthUrl.toString()
  }

  const clearSchedule = (runtime) => {
    if (!runtime?.healthTimer) return
    clearHealthTimer(runtime.healthTimer)
    runtime.healthTimer = null
  }

  const controller = {
    clearSchedule,
    normalizeHealthUrl,
    scheduleCheck(pluginId, serviceId, runtime, serviceEntry) {
      clearSchedule(runtime)
      if (!runtime || runtime.status !== 'running') return
      if (!serviceEntry?.health?.url) return
      const policy = getPolicy(pluginId, serviceId)
      if (!policy.enabled) return
      runtime.healthTimer = setHealthTimer(async () => {
        runtime.healthTimer = null
        if (runtime.status !== 'running') return
        if (runtime.healthChecking || runtime.health?.status === 'checking') {
          controller.scheduleCheck(pluginId, serviceId, runtime, serviceEntry)
          return
        }
        runtime.healthChecking = true
        try {
          await controller.checkHealth(pluginId, serviceId, runtime, serviceEntry, { reschedule: false })
        } catch (_) {
          // checkHealth already records a bounded runtime health result or log.
        } finally {
          runtime.healthChecking = false
          controller.scheduleCheck(pluginId, serviceId, runtime, serviceEntry)
        }
      }, policy.intervalMs)
      runtime.healthTimer?.unref?.()
    },
    async checkHealth(pluginId, serviceId, runtime, serviceEntry, { reschedule = true } = {}) {
      const healthUrl = normalizeHealthUrl(serviceEntry)
      const effectiveTimeoutMs = Number.isFinite(Number(timeoutMs))
        ? Math.max(0, Number(timeoutMs))
        : PLUGIN_SERVICE_HEALTH_TIMEOUT_MS
      const abortController = effectiveTimeoutMs > 0 && typeof AbortController === 'function'
        ? new AbortController()
        : null
      let timedOut = false
      const timeoutId = abortController
        ? setTimeout(() => {
            timedOut = true
            abortController.abort()
          }, effectiveTimeoutMs)
        : null
      timeoutId?.unref?.()
      runtime.health = {
        ...createHealthView(runtime.health || {}, serviceEntry),
        status: 'checking',
        url: healthUrl,
        checkedAt: new Date().toISOString(),
        message: ''
      }

      try {
        const response = await fetchImpl(healthUrl, {
          method: 'GET',
          ...(abortController ? { signal: abortController.signal } : {})
        })
        const statusCode = Number(response?.status)
        const hasStatusCode = Number.isFinite(statusCode)
        const healthy = hasStatusCode ? statusCode >= 200 && statusCode < 300 : Boolean(response?.ok)
        runtime.health = {
          status: healthy ? 'healthy' : 'unhealthy',
          checkedAt: new Date().toISOString(),
          url: healthUrl,
          statusCode: hasStatusCode ? statusCode : null,
          message: healthy ? 'OK' : `HTTP ${hasStatusCode ? statusCode : 'error'}`
        }
      } catch (error) {
        runtime.health = {
          status: 'unhealthy',
          checkedAt: new Date().toISOString(),
          url: healthUrl,
          statusCode: null,
          message: timedOut ? 'Health check timed out' : (error.message || 'Health check failed')
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
      }

      appendLog({
        pluginId,
        commandId: `service:${serviceId}`,
        level: runtime.health.status === 'healthy' ? 'info' : 'error',
        message: runtime.health.status === 'healthy' ? 'Service health healthy' : 'Service health unhealthy'
      })

      if (reschedule) controller.scheduleCheck(pluginId, serviceId, runtime, serviceEntry)
      return runtime.health
    }
  }

  return controller
}

module.exports = {
  createPluginServiceHealthController,
  LOOPBACK_HEALTH_HOSTS
}
