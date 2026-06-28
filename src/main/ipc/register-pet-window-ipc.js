const { IPC } = require('../../shared/ipc-channels')

const registerPetWindowIpc = (context) => {
  const {
    ipcMainService,
    browserWindowService,
    appService,
    getPetWindow,
    createSettingsWindow,
    helpers,
    sanitizeDetails
  } = context
  const {
    recordAppLog,
    requestAppQuit
  } = helpers

  ipcMainService.on(IPC.PET_SET_MOUSE_PASSTHROUGH, (event, passthrough) => {
    const win = browserWindowService.fromWebContents(event.sender)
    if (!win || typeof win.setIgnoreMouseEvents !== 'function') return
    if (passthrough) win.setIgnoreMouseEvents(true, { forward: true })
    else win.setIgnoreMouseEvents(false)
  })

  ipcMainService.on(IPC.PET_REQUEST_FOCUS_FOR_CURSOR, (event) => {
    const win = browserWindowService.fromWebContents(event.sender)
    if (!win || typeof win.focus !== 'function') return
    if (win.contextMenuWindow && !win.contextMenuWindow.isDestroyed?.()) return
    if (typeof win.isFocused === 'function' && win.isFocused()) return
    if (typeof win.isMinimized === 'function' && win.isMinimized() && typeof win.restore === 'function') win.restore()
    win.moveTop?.()
    appService.focus?.({ steal: true })
    win.focus()
    recordAppLog({
      scope: 'pet-window',
      level: 'debug',
      actor: 'system',
      event: 'pet.cursor.focus.requested',
      message: 'Pet window focus requested for custom cursor'
    })
  })

  ipcMainService.on(IPC.PET_RECORD_APP_LOG, (_event, entry = {}) => {
    if (!entry || typeof entry !== 'object') return
    recordAppLog({
      scope: 'pet-renderer',
      level: entry.level,
      actor: entry.actor,
      event: entry.event,
      message: entry.message,
      details: sanitizeDetails(entry.details)
    })
  })

  ipcMainService.on(IPC.PET_QUIT, () => requestAppQuit('pet-renderer'))

  ipcMainService.on(IPC.SETTINGS_OPEN, () => {
    createSettingsWindow(getPetWindow())
  })
}

module.exports = {
  registerPetWindowIpc
}
