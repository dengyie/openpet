const { runCommand } = require('../lib/command-io')
const { confirmTaskRun } = require('../lib/task-workflow')

runCommand(async (context) => {
  const output = confirmTaskRun({
    dataDir: process.env.OPENPET_DATA_DIR,
    runId: context.payload?.runId
  })
  return { message: `Confirmed task ${output.run.runId}`, run: output.run }
})
