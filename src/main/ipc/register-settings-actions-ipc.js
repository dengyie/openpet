const { IPC } = require('../../shared/ipc-channels')

const registerSettingsActionsIpc = (context) => {
  const {
    ipcMainService,
    getPetWindow,
    petService,
    actionService,
    actionImportService,
    helpers
  } = context
  const {
    showOpenDialogForEvent,
    createSelectionId,
    getPendingActionFrameSelection,
    inspectPendingActionFrameSelection,
    setPendingActionFrameSelection,
    clearPendingActionFrameSelection,
    reloadAndSendAnimations,
    recordAppLog,
    createActionFrameImportResult,
    createActionsMutationResult
  } = helpers

  ipcMainService.handle(IPC.ACTIONS_GET, () => petService.getPreviewAnimations())
  ipcMainService.handle(IPC.ACTIONS_INSPECT_FRAMES, async (event, payload) => {
    const selected = await showOpenDialogForEvent(event, {
      title: '选择动作帧文件夹',
      properties: ['openDirectory']
    })
    if (selected.canceled || !selected.filePaths[0]) return { canceled: true }
    const selectionId = createSelectionId()
    const sourceDir = selected.filePaths[0]
    const result = await actionImportService.inspectActionFrames({ sourceDir, actionId: payload.actionId })
    setPendingActionFrameSelection({ id: selectionId, sourceDir })
    return { canceled: false, selectionId, ...result }
  })
  ipcMainService.handle(IPC.ACTIONS_REINSPECT_FRAMES, async (_event, payload) => {
    return inspectPendingActionFrameSelection({ selectionId: payload.selectionId, actionId: payload.actionId })
  })
  ipcMainService.handle(IPC.ACTIONS_CLEAR_FRAME_SELECTION, (_event, payload) => {
    if (!payload?.selectionId || context.state.pendingActionFrameSelection?.id === payload.selectionId) {
      clearPendingActionFrameSelection()
    }
    return { ok: true }
  })
  ipcMainService.handle(IPC.ACTIONS_IMPORT_FRAMES, async (_event, payload) => {
    const selection = getPendingActionFrameSelection(payload.selectionId)
    const inspectionResult = await inspectPendingActionFrameSelection({ selectionId: payload.selectionId, actionId: payload.actionId })
    if (!inspectionResult.inspection.valid) {
      return createActionFrameImportResult({ ok: false, inspectionResult })
    }
    const result = await actionImportService.importActionFrames({
      sourceDir: selection.sourceDir,
      actionId: payload.actionId,
      label: payload.label
    })
    clearPendingActionFrameSelection()
    reloadAndSendAnimations(getPetWindow, petService)
    return createActionFrameImportResult({ ok: true, canceled: false, result }, petService.getPreviewAnimations())
  })

  ipcMainService.handle(IPC.ACTIONS_SAVE_CONFIG, async (_event, payload) => {
    if (payload?.triggerProposal) {
      if (!actionService?.acceptTriggerProposal) throw new Error('Action trigger proposal acceptance is not available')
      const triggerProposal = actionService.acceptTriggerProposal(payload.triggerProposal)
      const animations = triggerProposal.applied
        ? reloadAndSendAnimations(getPetWindow, petService)
        : petService.getPreviewAnimations()
      recordAppLog({
        scope: 'actions',
        level: 'info',
        actor: 'user',
        event: 'actions.trigger-proposal.accepted',
        message: 'Action trigger proposal accepted',
        details: {
          actionId: triggerProposal.actionId,
          type: triggerProposal.type,
          binding: triggerProposal.binding,
          applied: triggerProposal.applied,
          code: triggerProposal.code,
          sourcePluginId: triggerProposal.sourcePluginId || '',
          sourceRunId: triggerProposal.sourceRunId || '',
          sourceCommandId: triggerProposal.sourceCommandId || ''
        }
      })
      return createActionsMutationResult(animations, { triggerProposal })
    }
    if (payload?.triggerRuleUpdate) {
      if (!actionService?.updateTriggerRule) throw new Error('Action trigger rule update is not available')
      const animations = actionService.updateTriggerRule(payload.triggerRuleUpdate.ruleId, payload.triggerRuleUpdate.condition)
      recordAppLog({
        scope: 'actions',
        level: 'info',
        actor: 'user',
        event: 'actions.trigger-rule.updated',
        message: 'Action trigger rule condition updated',
        details: {
          ruleId: String(payload.triggerRuleUpdate.ruleId || '')
        }
      })
      return createActionsMutationResult(animations)
    }
    await actionImportService.updateActionConfig(payload)
    reloadAndSendAnimations(getPetWindow, petService)
    return createActionsMutationResult(petService.getPreviewAnimations())
  })

  ipcMainService.handle(IPC.ACTIONS_SUBMIT_TRIGGER_PROPOSAL, async (_event, payload) => {
    if (!actionService?.submitTriggerProposal) throw new Error('Action trigger proposal inbox is not available')
    const result = actionService.submitTriggerProposal(payload)
    recordAppLog({
      scope: 'actions',
      level: 'info',
      actor: 'plugin',
      event: 'actions.trigger-proposal.submitted',
      message: 'Action trigger proposal submitted',
      details: {
        proposalId: result.proposal.id,
        actionId: result.proposal.actionId,
        type: result.proposal.type,
        sourcePluginId: result.proposal.sourcePluginId || '',
        sourceRunId: result.proposal.sourceRunId || '',
        sourceCommandId: result.proposal.sourceCommandId || ''
      }
    })
    return createActionsMutationResult(result.animations, { proposal: result.proposal })
  })
  ipcMainService.handle(IPC.ACTIONS_ACCEPT_TRIGGER_PROPOSAL, async (_event, payload) => {
    if (!actionService?.acceptTriggerProposalItem) throw new Error('Action trigger proposal inbox is not available')
    const result = actionService.acceptTriggerProposalItem(payload?.proposalId)
    const animations = result.triggerProposal?.applied
      ? reloadAndSendAnimations(getPetWindow, petService)
      : result.animations
    recordAppLog({
      scope: 'actions',
      level: 'info',
      actor: 'user',
      event: 'actions.trigger-proposal.inbox.accepted',
      message: 'Action trigger proposal accepted from inbox',
      details: {
        proposalId: result.proposal.id,
        actionId: result.proposal.actionId,
        type: result.proposal.type,
        applied: Boolean(result.triggerProposal?.applied),
        code: result.triggerProposal?.code || ''
      }
    })
    return createActionsMutationResult(animations, { proposal: result.proposal, triggerProposal: result.triggerProposal })
  })
  ipcMainService.handle(IPC.ACTIONS_REJECT_TRIGGER_PROPOSAL, async (_event, payload) => {
    if (!actionService?.rejectTriggerProposalItem) throw new Error('Action trigger proposal inbox is not available')
    const result = actionService.rejectTriggerProposalItem(payload?.proposalId, payload?.reason)
    recordAppLog({
      scope: 'actions',
      level: 'info',
      actor: 'user',
      event: 'actions.trigger-proposal.inbox.rejected',
      message: 'Action trigger proposal rejected from inbox',
      details: {
        proposalId: result.proposal.id,
        actionId: result.proposal.actionId,
        type: result.proposal.type
      }
    })
    return createActionsMutationResult(result.animations, { proposal: result.proposal })
  })
  ipcMainService.handle(IPC.ACTIONS_DELETE_TRIGGER_RULE, async (_event, payload) => {
    if (!actionService?.removeTriggerRule) throw new Error('Action trigger rule deletion is not available')
    const animations = actionService.removeTriggerRule(payload?.ruleId)
    recordAppLog({
      scope: 'actions',
      level: 'info',
      actor: 'user',
      event: 'actions.trigger-rule.deleted',
      message: 'Action trigger rule deleted',
      details: { ruleId: String(payload?.ruleId || '') }
    })
    return createActionsMutationResult(animations)
  })
  ipcMainService.handle(IPC.ACTIONS_SET_TRIGGER_RULE_ENABLED, async (_event, payload) => {
    if (!actionService?.setTriggerRuleEnabled) throw new Error('Action trigger rule toggle is not available')
    const animations = actionService.setTriggerRuleEnabled(payload?.ruleId, payload?.enabled)
    recordAppLog({
      scope: 'actions',
      level: 'info',
      actor: 'user',
      event: 'actions.trigger-rule.toggled',
      message: 'Action trigger rule enabled state updated',
      details: {
        ruleId: String(payload?.ruleId || ''),
        enabled: Boolean(payload?.enabled)
      }
    })
    return createActionsMutationResult(animations)
  })
  ipcMainService.handle(IPC.ACTIONS_DELETE, async (_event, payload) => {
    await actionImportService.deleteAction(payload.actionId)
    reloadAndSendAnimations(getPetWindow, petService)
    return createActionsMutationResult(petService.getPreviewAnimations())
  })
}

module.exports = {
  registerSettingsActionsIpc
}
