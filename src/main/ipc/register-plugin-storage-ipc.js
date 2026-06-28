const { IPC } = require('../../shared/ipc-channels')

const registerPluginStorageIpc = (context) => {
  const { ipcMainService, pluginService } = context

  ipcMainService.handle(IPC.PLUGINS_GET_LOGS, (_event, filters) => pluginService.getLogs(filters))
  ipcMainService.handle(IPC.PLUGINS_EXPORT_LOGS, (_event, filters) => pluginService.exportLogs(filters))
  ipcMainService.handle(IPC.PLUGINS_CLEAR_LOGS, () => pluginService.clearLogs())
  ipcMainService.handle(IPC.PLUGINS_CLEAR_STORAGE, (_event, payload) => pluginService.clearStorage(payload.pluginId))
}

module.exports = {
  registerPluginStorageIpc
}
