const path = require('path')
const { runCommand } = require('../lib/command-io')
const { callBridge } = require('../lib/bridge-client')
const { runGenerationStep } = require('../lib/backend-runner')
const { readRun, resolveRunId, updateRunStatus } = require('../lib/run-store')

const STALE_FIXTURE_ATLAS_ERROR = /Codex pet atlas must contain visible pixels/

const inspectOutput = async ({ outputDir }) => {
  const dataRelativePath = path.relative(process.env.OPENPET_DATA_DIR, outputDir).replace(/\\/g, '/')
  return callBridge('/creator/pet-pack/inspect-output', { dataRelativePath })
}

const regenerateApprovedFixtureOutput = async ({ current, runId }) => {
  const backend = current.backend || current.input?.backend || 'fixture'
  if (backend !== 'fixture') return null
  const regenerated = await runGenerationStep({
    dataDir: process.env.OPENPET_DATA_DIR,
    runId
  })
  updateRunStatus({
    dataDir: process.env.OPENPET_DATA_DIR,
    runId,
    status: 'approved',
    patch: { reviewStatus: 'approved', currentStep: 'approved' }
  })
  return regenerated
}

const collectTriggerProposals = (run) => {
  const actions = Array.isArray(run.generationTask?.actions) ? run.generationTask.actions : []
  return actions
    .filter((action) => action?.actionId)
    .map((action) => ({
      actionId: action.actionId,
      type: action.triggerProposal?.type || 'unbound',
      binding: action.triggerProposal?.binding,
      message: action.triggerProposal?.notes || `Imported action ${action.actionId} from pet ${run.petId}`
    }))
}

const submitTriggerProposals = async ({ run, runId, activate }) => {
  const proposals = collectTriggerProposals(run)
  if (proposals.length === 0) return { submissions: [], error: '' }
  if (!activate) {
    return {
      submissions: [],
      error: 'Trigger proposal submission requires activating the imported pet pack so the host can validate action bindings.'
    }
  }
  const submissions = []
  const errors = []
  for (const proposal of proposals) {
    try {
      submissions.push(await callBridge('/creator/actions/submit-trigger-proposal', {
        actionId: proposal.actionId,
        type: proposal.type,
        binding: proposal.binding,
        message: proposal.message,
        sourcePluginId: 'openpet.creator-studio',
        sourceRunId: runId,
        sourceCommandId: 'import-approved-pet'
      }))
    } catch (error) {
      errors.push(`${proposal.actionId}: ${error.message || 'Trigger proposal submission failed'}`)
    }
  }
  return { submissions, error: errors.join('; ') }
}

runCommand(async (context) => {
  const activate = context.payload?.activate ?? context.config?.autoActivateAfterImport ?? true
  const runId = resolveRunId({
    dataDir: process.env.OPENPET_DATA_DIR,
    runId: context.payload?.runId,
    statuses: ['approved'],
    description: 'approved pet bundle',
    filter: (run) => Boolean(run.artifacts?.outputDir)
  })
  const current = readRun({ dataDir: process.env.OPENPET_DATA_DIR, runId })
  if (current.status !== 'approved') throw new Error(`Run must be approved before import: ${current.status}`)
  const outputDir = current.artifacts?.outputDir
  if (!outputDir) throw new Error('Run has no output directory')
  let inspection
  try {
    inspection = await inspectOutput({ outputDir })
  } catch (error) {
    if (!STALE_FIXTURE_ATLAS_ERROR.test(String(error.message || ''))) throw error
    const regenerated = await regenerateApprovedFixtureOutput({ current, runId })
    if (!regenerated) throw error
    inspection = await inspectOutput({ outputDir: regenerated.outputDir || outputDir })
  }
  if (!inspection.inspection?.valid) throw new Error((inspection.inspection?.errors || []).join('; ') || 'Pet pack inspection failed')
  const imported = await callBridge('/creator/pet-pack/import-output', {
    selectionId: inspection.inspection.selectionId,
    activate
  })
  const { submissions, error: triggerProposalSubmissionError } = await submitTriggerProposals({
    run: current,
    runId,
    activate
  })
  const run = updateRunStatus({
    dataDir: process.env.OPENPET_DATA_DIR,
    runId,
    status: 'imported',
    patch: {
      importStatus: 'imported',
      importedPackId: imported.imported?.pack?.id || '',
      currentStep: triggerProposalSubmissionError ? 'imported-trigger-proposal-pending' : 'imported',
      triggerProposalSubmissions: submissions,
      triggerProposalSubmissionError
    }
  })
  return {
    message: triggerProposalSubmissionError
      ? `Imported run ${runId}; trigger proposal submission is pending`
      : `Imported run ${runId}`,
    run,
    imported,
    triggerProposalSubmissions: submissions,
    ...(triggerProposalSubmissionError ? { triggerProposalSubmissionError } : {})
  }
})
