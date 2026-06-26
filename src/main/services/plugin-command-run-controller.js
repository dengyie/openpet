const createPluginCommandRunController = ({
  appendLog = () => {},
  createSdk,
  getConfig,
  runLocalCommand,
  runCommandEntryProcess,
  getCommandEntry,
  getRegisteredCommands = (sdk) => sdk || {}
} = {}) => {
  if (typeof createSdk !== 'function') throw new Error('createSdk is required')
  if (typeof getConfig !== 'function') throw new Error('getConfig is required')
  if (typeof runLocalCommand !== 'function') throw new Error('runLocalCommand is required')
  if (typeof runCommandEntryProcess !== 'function') throw new Error('runCommandEntryProcess is required')
  if (typeof getCommandEntry !== 'function') throw new Error('getCommandEntry is required')

  const run = async ({ plugin, pluginId, commandId, payload = {} }) => {
    try {
      appendLog({ pluginId, commandId, level: 'info', message: 'Command started' })
      const sdk = createSdk(plugin)

      let result
      if (typeof plugin.activate === 'function') {
        const returnedCommands = plugin.activate(sdk) || {}
        const commands = {
          ...returnedCommands,
          ...(getRegisteredCommands(sdk) || {})
        }
        const handler = commands[commandId]
        if (typeof handler !== 'function') throw new Error(`Plugin command not found: ${commandId}`)
        result = await handler(payload)
      } else if (plugin.mainPath) {
        result = await runLocalCommand({
          plugin,
          sdk,
          commandId,
          payload,
          config: getConfig(plugin.manifest.id)
        })
      } else if (plugin.manifest.entries?.commands?.length) {
        const commandEntry = getCommandEntry(plugin, commandId)
        result = await runCommandEntryProcess({
          plugin,
          commandEntry,
          commandId,
          payload,
          config: getConfig(plugin.manifest.id)
        })
      } else {
        throw new Error('Plugin is not runnable')
      }

      appendLog({ pluginId, commandId, level: 'info', message: 'Command completed' })
      return result
    } catch (error) {
      if (error?.openpetLogged) throw error
      appendLog({
        pluginId,
        commandId,
        level: 'error',
        message: error.message || 'Command failed'
      })
      throw error
    }
  }

  return {
    run
  }
}

module.exports = {
  createPluginCommandRunController
}
