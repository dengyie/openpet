const { registerPluginPackageIpc } = require('./register-plugin-package-ipc')
const { registerPluginRuntimeIpc } = require('./register-plugin-runtime-ipc')
const { registerPluginStorageIpc } = require('./register-plugin-storage-ipc')

const registerPluginIpc = (context) => {
  registerPluginRuntimeIpc(context)
  registerPluginPackageIpc(context)
  registerPluginStorageIpc(context)
}

module.exports = {
  registerPluginIpc
}
