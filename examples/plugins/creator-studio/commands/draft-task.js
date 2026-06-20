const { runCommand } = require('../lib/command-io')
const { draftTaskRun } = require('../lib/task-workflow')

runCommand(async (context) => {
  const output = draftTaskRun({
    dataDir: process.env.OPENPET_DATA_DIR,
    payload: {
      ...(context.payload || {}),
      backend: context.payload?.backend || context.config?.backend || 'fixture'
    }
  })
  return { message: `Drafted task ${output.run.runId}`, run: output.run }
})
