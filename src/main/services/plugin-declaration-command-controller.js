const createPluginDeclarationCommandController = ({
  runtimeManager,
  entryProcessController
} = {}) => {
  if (!runtimeManager) throw new Error('runtimeManager is required')
  if (!entryProcessController?.run) throw new Error('entryProcessController.run is required')

  const run = async ({ plugin, commandEntry, commandId, payload, config }) => {
    const pluginId = plugin?.manifest?.id
    runtimeManager.assertNotActive(pluginId, commandId)
    return entryProcessController.run({
      plugin,
      commandEntry,
      commandId,
      payload,
      config
    })
  }

  const stopPlugin = (pluginId) => runtimeManager.stopPlugin(pluginId)

  const stopAll = () => runtimeManager.stopAll()

  return {
    run,
    stopAll,
    stopPlugin
  }
}

module.exports = {
  createPluginDeclarationCommandController
}
