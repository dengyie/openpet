const { IPC } = require('../../shared/ipc-channels')

const registerPluginPackageIpc = (context) => {
  const {
    ipcMainService,
    dialogService,
    pluginService,
    pluginInstallService,
    pluginGithubImportService,
    helpers
  } = context
  const { createPluginMutationResult } = helpers

  ipcMainService.handle(IPC.PLUGINS_INSPECT_PACKAGE, async () => {
    const selected = await dialogService.showOpenDialog({
      title: '选择插件目录或 OpenPet 插件包',
      properties: ['openFile', 'openDirectory'],
      filters: [
        { name: 'OpenPet Plugin Package', extensions: ['zip'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (selected.canceled || !selected.filePaths[0]) return { canceled: true }
    return { canceled: false, ...pluginInstallService.inspectPluginPackage(selected.filePaths[0]) }
  })
  ipcMainService.handle(IPC.PLUGINS_INSPECT_GITHUB_REPOSITORY, async (_event, payload) => {
    if (!pluginGithubImportService?.inspectRepositoryUrl) throw new Error('GitHub plugin import is not available')
    return { canceled: false, ...await pluginGithubImportService.inspectRepositoryUrl(payload?.repositoryUrl) }
  })
  ipcMainService.handle(IPC.PLUGINS_CLEAR_SELECTION, (_event, payload) => pluginInstallService.clearPendingSelection(payload?.selectionId))
  ipcMainService.handle(IPC.PLUGINS_INSTALL, (_event, payload) => {
    return createPluginMutationResult(pluginInstallService.installPlugin(payload.selectionId), pluginService.listPlugins())
  })
  ipcMainService.handle(IPC.PLUGINS_UPDATE, (_event, payload) => {
    return createPluginMutationResult(pluginInstallService.updatePlugin(payload.selectionId), pluginService.listPlugins())
  })
  ipcMainService.handle(IPC.PLUGINS_UNINSTALL, (_event, payload) => {
    const result = pluginInstallService.uninstallPlugin(payload.pluginId, { removeStorage: Boolean(payload.removeStorage) })
    return createPluginMutationResult(result, pluginService.listPlugins())
  })
}

module.exports = {
  registerPluginPackageIpc
}
