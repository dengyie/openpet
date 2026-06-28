const { IPC } = require('../../shared/ipc-channels')

const registerPetMovementIpc = (context) => {
  const {
    ipcMainService,
    browserWindowService,
    getPetWindow,
    petService,
    petBubbleChatWindowService,
    applyPetViewport,
    clampToWorkArea,
    getMovementState,
    petMovementPolicy,
    helpers
  } = context
  const {
    sendToPetWindow,
    createPetRendererSettings
  } = helpers

  ipcMainService.handle(IPC.PET_GET_ANIMATIONS, () => petService.getAnimations())

  ipcMainService.handle(IPC.PET_GET_BOUNDS, (event) => {
    const win = browserWindowService.fromWebContents(event.sender)
    return win.getBounds()
  })

  ipcMainService.handle(IPC.PET_GET_MOVEMENT_STATE, (event) => {
    const win = browserWindowService.fromWebContents(event.sender)
    if (!win) return null
    return getMovementState(win)
  })

  ipcMainService.on(IPC.PET_SET_VIEWPORT, (event, viewport) => {
    const win = browserWindowService.fromWebContents(event.sender)
    if (!win || !viewport) return
    applyPetViewport(win, viewport)
    petBubbleChatWindowService?.syncToPetWindow?.()
  })

  ipcMainService.on(IPC.PET_SET_POSITION, (event, point) => {
    const win = browserWindowService.fromWebContents(event.sender)
    if (!win || !point) return
    const next = petMovementPolicy
      ? petMovementPolicy.clampDragPosition({
          windowBounds: win.getBounds(),
          requestedTopLeft: { x: point.x, y: point.y },
          settings: petService.getSettings().petBehavior
        })
      : clampToWorkArea(win, point.x, point.y)
    win.setPosition(next.x, next.y)
    petBubbleChatWindowService?.syncToPetWindow?.()
  })

  ipcMainService.on(IPC.PET_DRAG_ENDED, (event) => {
    if (!petMovementPolicy) return
    const win = browserWindowService.fromWebContents(event.sender)
    if (!win) return
    const currentSettings = petService.getSettings()
    const behavior = petMovementPolicy.normalizePetBehaviorSettings(currentSettings.petBehavior)
    if (!behavior.home.enabled) return
    const anchor = petMovementPolicy.createHomeAnchorFromWindow({ windowBounds: win.getBounds() })
    const savedSettings = petService.saveSettings({
      ...currentSettings,
      petBehavior: {
        ...behavior,
        home: {
          ...behavior.home,
          anchor
        }
      }
    })
    sendToPetWindow(getPetWindow, IPC.SETTINGS_CHANGED, createPetRendererSettings(savedSettings))
    petBubbleChatWindowService?.syncToPetWindow?.()
  })

  ipcMainService.handle(IPC.PET_MOVE_BY, (event, delta) => {
    const win = browserWindowService.fromWebContents(event.sender)
    if (!win || !delta) return null
    const [x, y] = win.getPosition()
    const next = petMovementPolicy
      ? petMovementPolicy.clampMoveBy({
          windowBounds: win.getBounds(),
          delta,
          settings: petService.getSettings().petBehavior
        })
      : clampToWorkArea(win, x + delta.x, y + delta.y)
    win.setPosition(next.x, next.y)
    petBubbleChatWindowService?.syncToPetWindow?.()
    return next
  })
}

module.exports = {
  registerPetMovementIpc
}
