const fs = require('fs')
const path = require('path')
const { runCommand } = require('../lib/command-io')
const { callBridge } = require('../lib/bridge-client')
const { assertActionFrameQaPassed } = require('../lib/action-frame-qa')
const { readRun, resolveRunId, updateRunStatus } = require('../lib/run-store')

const toDataRelativePath = ({ dataDir, targetPath }) => {
  const root = path.resolve(dataDir)
  const target = path.resolve(targetPath)
  const relative = path.relative(root, target)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Generated action frames must stay inside Creator Studio data directory')
  }
  const realRoot = fs.realpathSync.native(root)
  const realTarget = fs.realpathSync.native(target)
  const realRelative = path.relative(realRoot, realTarget)
  if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new Error('Generated action frames must stay inside Creator Studio data directory')
  }
  return relative.replace(/\\/g, '/')
}

const submitTriggerProposal = async ({ actionFrames, runId }) => {
  const triggerProposal = actionFrames.triggerProposal || { type: 'unbound' }
  try {
    const submitted = await callBridge('/creator/trigger-proposals/submit', {
      actionId: actionFrames.actionId,
      type: triggerProposal.type || 'unbound',
      binding: triggerProposal.binding || '',
      notes: triggerProposal.notes || '',
      sourceRunId: runId
    })
    return {
      ok: true,
      proposal: submitted.proposal || null
    }
  } catch (error) {
    return {
      ok: false,
      error: error.message || 'Trigger proposal submission failed'
    }
  }
}

runCommand(async (context) => {
  const dataDir = process.env.OPENPET_DATA_DIR
  const runId = resolveRunId({
    dataDir,
    runId: context.payload?.runId,
    statuses: ['approved'],
    description: 'approved single-action',
    filter: (run) => run.generationTask?.mode === 'single-action' && Boolean(run.artifacts?.actionFrames)
  })
  const current = readRun({ dataDir, runId })
  if (current.status !== 'approved') throw new Error(`Run must be approved before action import: ${current.status}`)
  if (current.generationTask?.mode !== 'single-action') throw new Error('Only single-action runs can be imported as action frames')
  const actionFrames = current.artifacts?.actionFrames
  if (!actionFrames?.framesDir || !actionFrames?.actionId) {
    throw new Error('Approved run does not contain generated action frames')
  }
  assertActionFrameQaPassed({ dataDir, actionFrames, operation: 'import' })

  const imported = await callBridge('/creator/assets/import-frames', {
    dataRelativePath: toDataRelativePath({ dataDir, targetPath: actionFrames.framesDir }),
    actionId: actionFrames.actionId,
    label: actionFrames.name || actionFrames.actionId
  })
  const triggerProposalSubmission = await submitTriggerProposal({ actionFrames, runId })
  const run = updateRunStatus({
    dataDir,
    runId,
    status: 'imported',
    patch: {
      importStatus: 'imported',
      importedActionId: actionFrames.actionId,
      currentStep: 'imported',
      triggerProposalSubmission
    }
  })
  return {
    message: `Imported action ${actionFrames.actionId}`,
    run,
    imported,
    triggerProposal: actionFrames.triggerProposal || { type: 'unbound' },
    triggerProposalSubmission
  }
})
