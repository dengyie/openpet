const { IPC } = require('../../shared/ipc-channels')

const registerSettingsPetPacksIpc = (context) => {
  const {
    ipcMainService,
    getPetWindow,
    petService,
    petPackService,
    helpers
  } = context
  const {
    showOpenDialogForEvent,
    reloadAndSendAnimations,
    createPetPackMutationResult
  } = helpers

  ipcMainService.handle(IPC.PET_PACKS_LIST, () => petPackService.listPacks())
  ipcMainService.handle(IPC.PET_PACKS_INSPECT_DIRECTORY, async (event) => {
    const selected = await showOpenDialogForEvent(event, {
      title: '选择 Pet Pack 文件夹或 Codex Pet 包',
      properties: ['openFile', 'openDirectory'],
      filters: [{ name: 'Pet Pack Package', extensions: ['zip'] }]
    })
    if (selected.canceled || !selected.filePaths[0]) return { canceled: true }
    return { canceled: false, ...petPackService.inspectPackSource(selected.filePaths[0]) }
  })
  ipcMainService.handle(IPC.PET_PACKS_CLEAR_SELECTION, (_event, payload) => petPackService.clearPendingSelection(payload?.selectionId))
  ipcMainService.handle(IPC.PET_PACKS_IMPORT, (_event, payload) => {
    const result = petPackService.importPack(payload.selectionId)
    const petPacks = petPackService.listPacks()
    if (result?.pack?.id && petPacks?.activePackId === result.pack.id) {
      const animations = reloadAndSendAnimations(getPetWindow, petService)
      return createPetPackMutationResult(result, petPacks, animations)
    }
    return createPetPackMutationResult(result, petPacks)
  })
  ipcMainService.handle(IPC.PET_PACKS_EXPORT, async (event, payload) => {
    const selected = await showOpenDialogForEvent(event, {
      title: '选择 Pet Pack 导出目录',
      properties: ['openDirectory', 'createDirectory']
    })
    if (selected.canceled || !selected.filePaths[0]) return { canceled: true }
    return { canceled: false, ...petPackService.exportPack(payload.packId, selected.filePaths[0]) }
  })
  ipcMainService.handle(IPC.PET_PACKS_REMOVE, (_event, payload) => {
    const result = petPackService.removePack(payload.packId)
    return createPetPackMutationResult(result, petPackService.listPacks())
  })
}

module.exports = {
  registerSettingsPetPacksIpc
}
