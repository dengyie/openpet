const { IPC } = require('../../shared/ipc-channels')

const registerPetMenuIpc = (context) => {
  const {
    ipcMainService,
    browserWindowService,
    screenService,
    getPetWindow,
    petService,
    petChatWindowService,
    createSettingsWindow,
    showContextMenuWindow,
    helpers,
    choosePetContextMenuPoint,
    estimatePetContextMenuSize
  } = context
  const {
    recordAppLog,
    notifyPetChatStateChanged,
    requestAppQuit,
    sendToControlCenterWindow,
    sendToPetWindow
  } = helpers

  ipcMainService.handle(IPC.PET_SHOW_CONTEXT_MENU, (event, point = {}) => {
    const win = browserWindowService.fromWebContents(event.sender)
    if (!win || win.isDestroyed()) return null
    const actions = petService.getAnimations()?.actions || []
    const bounds = win.getBounds()
    const { workArea } = screenService.getDisplayMatching(bounds)
    const menuSize = estimatePetContextMenuSize(actions, { extraItemCount: petChatWindowService ? 1 : 0 })
    const settings = petService.getSettings?.() || {}
    const requestedPoint = {
      x: Number(point.x),
      y: Number(point.y)
    }
    const placement = choosePetContextMenuPoint({
      petBounds: bounds,
      workArea,
      menuSize,
      menuPosition: settings.menuPosition,
      preferredPoint: requestedPoint
    })
    const sendMenuCommand = (payload) => sendToPetWindow(() => win, IPC.PET_MENU_COMMAND, payload)
    const template = [
      ...actions.map((action) => ({
        label: action.label || action.id,
        click: () => sendMenuCommand({ command: 'action', actionId: action.id })
      })),
      { type: 'separator' },
      { label: '散步', click: () => sendMenuCommand({ command: 'walk' }) },
      ...(petChatWindowService ? [{ label: '和宠物聊天', click: () => petChatWindowService.open?.() }] : []),
      { label: '设置', click: () => createSettingsWindow(win) },
      { type: 'separator' },
      { label: '退出', click: () => requestAppQuit('pet-context-menu') }
    ]
    recordAppLog({
      scope: 'pet-menu',
      level: 'info',
      actor: 'user',
      event: 'pet.menu.popup',
      message: 'Pet context menu popup requested',
      details: {
        petX: bounds.x,
        petY: bounds.y,
        petWidth: bounds.width,
        petHeight: bounds.height,
        workAreaX: workArea.x,
        workAreaY: workArea.y,
        workAreaWidth: workArea.width,
        workAreaHeight: workArea.height,
        menuWidth: menuSize.width,
        menuHeight: menuSize.height,
        requestedX: requestedPoint.x,
        requestedY: requestedPoint.y,
        placement: placement.placement,
        menuX: placement.screenPoint.x,
        menuY: placement.screenPoint.y,
        popupX: placement.windowPoint.x,
        popupY: placement.windowPoint.y
      }
    })
    showContextMenuWindow({
      BrowserWindow: browserWindowService,
      parentWindow: win,
      items: template,
      point: placement.screenPoint,
      size: menuSize,
      onSelect: (item) => item?.click?.()
    })
    return placement
  })

  ipcMainService.handle(IPC.PET_PACKS_SET_ACTIVE, (_event, payload) => {
    const result = context.petPackService.setActivePack(payload.packId)
    helpers.reloadAndSendAnimations(getPetWindow, petService)
    const animations = petService.getPreviewAnimations()
    const petPacks = context.petPackService.listPacks()
    notifyPetChatStateChanged()
    sendToControlCenterWindow(IPC.PET_PACKS_ACTIVE_CHANGED, petPacks)
    return context.createPetPackMutationResult(result, petPacks, animations)
  })
}

module.exports = {
  registerPetMenuIpc
}
