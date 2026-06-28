const { IPC } = require('../../shared/ipc-channels')

const registerPluginRuntimeIpc = (context) => {
  const { ipcMainService, pluginService } = context

  ipcMainService.handle(IPC.PLUGINS_LIST, () => pluginService.listPlugins())
  ipcMainService.handle(IPC.PLUGINS_SET_ENABLED, (_event, payload) => pluginService.setEnabled(payload.pluginId, payload.enabled))
  ipcMainService.handle(IPC.PLUGINS_SAVE_CONFIG, (_event, payload) => pluginService.saveConfig(payload.pluginId, payload.config))
  ipcMainService.handle(IPC.PLUGINS_RUN_COMMAND, (_event, payload) => pluginService.runCommand(payload.pluginId, payload.commandId, payload.payload))
  ipcMainService.handle(IPC.PLUGINS_RUN_SETUP, (_event, payload) => pluginService.runSetup(payload.pluginId, payload.setupId))
  ipcMainService.handle(IPC.PLUGINS_OPEN_DASHBOARD, (_event, payload) => pluginService.openDashboard(payload.pluginId, payload.dashboardId))
  ipcMainService.handle(IPC.PLUGINS_START_SERVICE, (_event, payload) => pluginService.startService(payload.pluginId, payload.serviceId))
  ipcMainService.handle(IPC.PLUGINS_STOP_SERVICE, (_event, payload) => pluginService.stopService(payload.pluginId, payload.serviceId))
  ipcMainService.handle(IPC.PLUGINS_CHECK_SERVICE_HEALTH, (_event, payload) => pluginService.checkServiceHealth(payload.pluginId, payload.serviceId))
  ipcMainService.handle(IPC.PLUGINS_SAVE_SERVICE_HEALTH_POLICY, (_event, payload) => {
    return pluginService.saveServiceHealthPolicy(payload.pluginId, payload.serviceId, payload.policy)
  })
}

module.exports = {
  registerPluginRuntimeIpc
}
