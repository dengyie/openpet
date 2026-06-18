const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')

const {
  createPluginCleanupEvidenceReport
} = require('../../scripts/create-plugin-cleanup-evidence-report')
const { REQUIRED_CHECKS } = require('../../scripts/validate-plugin-cleanup-evidence-report')
const {
  createRunbook,
  defaultOutputPath,
  parseArgs,
  writeRunbook
} = require('../../scripts/create-plugin-cleanup-packaged-runbook')

const fixedNow = () => new Date('2026-06-18T14:00:00.000Z')

const createReport = () => createPluginCleanupEvidenceReport({
  platform: 'darwin',
  arch: 'arm64',
  nodeVersion: 'v24.1.0',
  hostname: () => 'packaged-cleanup-host',
  env: {
    RUNNER_NAME: 'manual packaged cleanup validation'
  },
  now: () => new Date('2026-06-18T13:00:00.000Z'),
  pluginId: 'openpet.cleanup-packaged-fixture',
  hostApp: 'OpenPet packaged app at release/mac-arm64/OpenPet.app',
  notes: 'Run against a packaged app with explicit setup command and service cleanup paths'
})

test('plugin cleanup packaged runbook parseArgs accepts report and output paths', () => {
  const options = parseArgs(['report.json', '--output', 'runbook.md'])

  assert.equal(options.reportPath, 'report.json')
  assert.equal(options.outputPath, 'runbook.md')
})

test('plugin cleanup packaged runbook parseArgs rejects missing values and unexpected arguments', () => {
  assert.throws(() => parseArgs(['report.json', '--output']), /--output requires a value/)
  assert.throws(() => parseArgs(['report.json', '--unknown']), /Unexpected argument/)
})

test('plugin cleanup packaged runbook defaultOutputPath writes next to the report', () => {
  assert.equal(
    defaultOutputPath('/tmp/openpet/plugin-cleanup-evidence-report.json'),
    '/tmp/openpet/plugin-cleanup-packaged-runbook.md'
  )
})

test('createRunbook documents every required cleanup check for packaged app execution', () => {
  const report = createReport()
  const content = createRunbook({
    report,
    reportPath: 'docs/release-evidence/plugin-cleanup-evidence/session/plugin-cleanup-evidence-report.json',
    generatedAt: fixedNow()
  })

  assert.match(content, /OpenPet Packaged Plugin Cleanup Evidence Runbook/)
  assert.match(content, /OpenPet packaged app at release\/mac-arm64\/OpenPet\.app/)
  assert.match(content, /manual packaged cleanup validation/)
  assert.match(content, /does not prove plugin cleanup readiness/)
  for (const check of REQUIRED_CHECKS) {
    assert.match(content, new RegExp(`\`${check.id}\``))
  }
})

test('createRunbook keeps cleanup report updates evidence-first without pass shortcuts', () => {
  const content = createRunbook({
    report: createReport(),
    reportPath: 'plugin-cleanup-evidence-report.json',
    generatedAt: fixedNow()
  })

  assert.match(content, /--status <pending\|pass\|fail\|blocked>/)
  assert.doesNotMatch(content, /--status pass/)
  assert.match(content, /Do not replace the status placeholder with pass until matching packaged-app evidence exists/)
})

test('createRunbook rejects structurally invalid cleanup reports', () => {
  const report = createReport()
  report.checks = []

  assert.throws(
    () => createRunbook({ report, reportPath: 'report.json', generatedAt: fixedNow() }),
    /Cannot create plugin cleanup packaged runbook from an invalid report/
  )
})

test('writeRunbook writes markdown with a trailing newline', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpet-plugin-cleanup-runbook-'))
  const outputPath = path.join(outputDir, 'nested', 'plugin-cleanup-packaged-runbook.md')

  assert.equal(writeRunbook({ content: '# Runbook\n', outputPath }), outputPath)
  assert.equal(fs.readFileSync(outputPath, 'utf-8'), '# Runbook\n')
})
