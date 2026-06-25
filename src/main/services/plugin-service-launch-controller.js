const DEFAULT_PLATFORM = process.platform

const createPluginServiceLaunchController = ({
  parseCommand,
  resolveCwd,
  createEnv = () => ({}),
  spawnServiceProcess,
  platform = DEFAULT_PLATFORM
} = {}) => {
  if (typeof parseCommand !== 'function') throw new Error('parseCommand is required')
  if (typeof resolveCwd !== 'function') throw new Error('resolveCwd is required')
  if (typeof spawnServiceProcess !== 'function') throw new Error('spawnServiceProcess is required')

  const resolveRuntimeDeclaration = (serviceEntry = {}) => {
    const override = serviceEntry.platforms?.[platform] || {}
    return {
      command: override.command || serviceEntry.command,
      cwd: override.cwd || serviceEntry.cwd || '.'
    }
  }

  const spawnRuntime = ({ pluginManifest, serviceEntry } = {}) => {
    const declaration = resolveRuntimeDeclaration(serviceEntry)
    const { file, args } = parseCommand(declaration.command)
    const cwd = resolveCwd(pluginManifest, declaration.cwd)
    const child = spawnServiceProcess(file, args, {
      cwd,
      detached: true,
      env: createEnv(),
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })

    return {
      child,
      cwd,
      declaration,
      file,
      args
    }
  }

  return {
    resolveRuntimeDeclaration,
    spawnRuntime
  }
}

module.exports = {
  createPluginServiceLaunchController
}
