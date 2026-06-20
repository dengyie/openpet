const { runCommand } = require('../lib/command-io')
const { answerTaskQuestion } = require('../lib/task-workflow')

runCommand(async (context) => {
  const payload = context.payload || {}
  const output = answerTaskQuestion({
    dataDir: process.env.OPENPET_DATA_DIR,
    runId: payload.runId,
    questionId: payload.questionId,
    answer: payload.answer
  })
  return { message: `Answered task question ${payload.questionId}`, run: output.run }
})
