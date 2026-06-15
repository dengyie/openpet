const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')

const {
  createPluginSandboxEvaluation,
  parseArgs,
  renderMarkdownSandboxEvaluation,
  writeEvaluation
} = require('../../scripts/create-plugin-sandbox-evaluation')

test('parseArgs accepts output and json flags', () => {
  const options = parseArgs(['--output', 'sandbox.md', '--json'])

  assert.equal(options.outputPath, 'sandbox.md')
  assert.equal(options.json, true)
})

test('parseArgs rejects missing values and unexpected arguments', () => {
  assert.throws(() => parseArgs(['--output']), /--output requires a value/)
  assert.throws(() => parseArgs(['unexpected']), /Unexpected argument/)
})

test('createPluginSandboxEvaluation records current runner guarantees and recommendation', () => {
  const evaluation = createPluginSandboxEvaluation({
    now: () => new Date('2026-06-16T00:00:00.000Z')
  })

  assert.equal(evaluation.generatedAt, '2026-06-16T00:00:00.000Z')
  assert.equal(evaluation.phase, 39)
  assert.equal(evaluation.recommendation.decision, 'keep-current-runner-for-v1.1')
  assert.equal(evaluation.recommendation.claimBoundary, 'permission-limited-isolated-runner-not-absolute-sandbox')
  assert.ok(evaluation.currentRunner.guarantees.some((item) => item.includes('child process')))
  assert.ok(evaluation.currentRunner.guarantees.some((item) => item.includes('Node permission model')))
  assert.ok(evaluation.currentRunner.guarantees.some((item) => item.includes('VM context')))
  assert.ok(evaluation.currentRunner.limits.some((item) => item.includes('absolute sandbox safety')))
  assert.ok(evaluation.candidates.some((candidate) => candidate.id === 'ses'))
  assert.ok(evaluation.candidates.some((candidate) => candidate.id === 'electron-utility-process'))
  assert.ok(evaluation.reEvaluationTriggers.includes('Plugins become long-lived background workers.'))
})

test('renderMarkdownSandboxEvaluation keeps security boundaries visible', () => {
  const evaluation = createPluginSandboxEvaluation({
    now: () => new Date('2026-06-16T00:00:00.000Z')
  })
  const markdown = renderMarkdownSandboxEvaluation(evaluation)

  assert.match(markdown, /^# OpenPet Plugin Sandbox Evaluation/)
  assert.match(markdown, /Decision: keep-current-runner-for-v1\.1/)
  assert.match(markdown, /permission-limited-isolated-runner-not-absolute-sandbox/)
  assert.match(markdown, /Current local plugin runner/)
  assert.match(markdown, /SES/)
  assert.match(markdown, /Electron utilityProcess/)
  assert.match(markdown, /Do not describe third-party plugins as absolutely safe/)
})

test('writeEvaluation writes Markdown or JSON reports', () => {
  const evaluation = createPluginSandboxEvaluation()
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpet-plugin-sandbox-evaluation-'))
  const markdownPath = path.join(outputDir, 'sandbox.md')
  const jsonPath = path.join(outputDir, 'sandbox.json')

  writeEvaluation({ evaluation, outputPath: markdownPath })
  writeEvaluation({ evaluation, outputPath: jsonPath, json: true })

  assert.match(fs.readFileSync(markdownPath, 'utf-8'), /Plugin Sandbox Evaluation/)
  assert.equal(JSON.parse(fs.readFileSync(jsonPath, 'utf-8')).recommendation.decision, 'keep-current-runner-for-v1.1')
})
