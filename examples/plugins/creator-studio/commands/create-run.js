const { runCommand } = require('../lib/command-io')
const { createRun } = require('../lib/run-store')
const { draftGenerationTask } = require('../lib/conversation-wizard')

runCommand(async (context) => {
  const payload = context.payload || {}
  const draft = payload.generationTask
    ? { originalPrompt: payload.originalPrompt || payload.prompt || '', generationTask: payload.generationTask }
    : draftGenerationTask({ prompt: payload.originalPrompt || payload.prompt || '', context: payload.context || {} })
  const run = createRun({
    dataDir: process.env.OPENPET_DATA_DIR,
    input: {
      ...payload,
      originalPrompt: draft.originalPrompt,
      generationTask: draft.generationTask,
      backend: payload.backend || context.config?.backend || 'fixture'
    }
  })
  return { message: `Created run ${run.runId}`, run }
})
