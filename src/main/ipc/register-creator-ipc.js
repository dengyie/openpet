const { IPC } = require('../../shared/ipc-channels')

const registerCreatorIpc = ({
  ipcMainService,
  creatorWorkflowService = null
}) => {
  const requireService = () => {
    if (!creatorWorkflowService) throw new Error('Creator workflow service is not available')
    return creatorWorkflowService
  }

  ipcMainService.handle(IPC.CREATOR_GET_STATE, () => requireService().getState())
  ipcMainService.handle(IPC.CREATOR_BIND_REFERENCE, (_event, payload) => requireService().bindReference({
    targetType: payload?.targetType,
    targetId: payload?.targetId,
    sourcePath: payload?.sourcePath
  }))
  ipcMainService.handle(IPC.CREATOR_GENERATE_NEW_CHARACTER, (_event, payload) => requireService().generateNewCharacter({
    characterName: payload?.characterName,
    stylePrompt: payload?.stylePrompt,
    referenceImagePath: payload?.referenceImagePath
  }))
  ipcMainService.handle(IPC.CREATOR_GENERATE_EXISTING_ACTION, (_event, payload) => requireService().generateExistingAction({
    actionName: payload?.actionName,
    motionPrompt: payload?.motionPrompt,
    referenceImagePath: payload?.referenceImagePath
  }))
  ipcMainService.handle(IPC.CREATOR_GET_LAST_RUN, () => requireService().getLastRun())
}

module.exports = {
  registerCreatorIpc
}
