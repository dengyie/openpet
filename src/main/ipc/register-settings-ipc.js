const { IPC } = require('../../shared/ipc-channels')
const { registerSettingsActionsIpc } = require('./register-settings-actions-ipc')
const { registerSettingsCursorIpc } = require('./register-settings-cursor-ipc')
const { registerSettingsPetPacksIpc } = require('./register-settings-pet-packs-ipc')

const registerSettingsIpc = (context) => {
  registerSettingsCursorIpc(context)
  registerSettingsActionsIpc(context)
  registerSettingsPetPacksIpc(context)
}

module.exports = {
  registerSettingsIpc
}
