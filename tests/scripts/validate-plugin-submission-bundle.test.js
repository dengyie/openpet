const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')

const { createPluginSubmissionBundle } = require('../../scripts/create-plugin-submission-bundle')
const {
  loadBundle,
  parseArgs,
  validateBundle
} = require('../../scripts/validate-plugin-submission-bundle')

const EXAMPLE_PLUGIN_PATH = path.join(__dirname, '../../examples/plugins/focus-timer')

const createBundle = (options = {}) => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpet-plugin-submission-validate-'))
  createPluginSubmissionBundle({
    sourcePath: EXAMPLE_PLUGIN_PATH,
    outputDir,
    now: () => new Date('2026-06-16T00:00:00.000Z'),
    ...options
  })
  return outputDir
}

test('parseArgs accepts bundle directory, json, and require-ready flags', () => {
  const options = parseArgs(['submission-bundle', '--json', '--require-ready'])

  assert.equal(options.bundleDir, 'submission-bundle')
  assert.equal(options.json, true)
  assert.equal(options.requireReady, true)
})

test('parseArgs rejects unexpected arguments', () => {
  assert.throws(() => parseArgs(['bundle-a', 'bundle-b']), /Unexpected argument/)
})

test('validateBundle accepts a complete ready submission bundle', () => {
  const bundle = loadBundle({ bundleDir: createBundle() })
  const result = validateBundle(bundle, { requireReady: true })

  assert.equal(result.ok, true)
  assert.equal(result.summary.filesPresent, 3)
  assert.equal(result.summary.readyForHumanReview, true)
})

test('validateBundle rejects require-ready when validation blocked the bundle', () => {
  const bundle = loadBundle({ bundleDir: createBundle({ requireSignature: true }) })
  const result = validateBundle(bundle, { requireReady: true })

  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /bundle is not ready for human review/)
  assert.equal(result.summary.decision, 'blocked-before-review')
})

test('validateBundle reports missing required files', () => {
  const outputDir = createBundle()
  fs.rmSync(path.join(outputDir, 'plugin-submission-pr.md'))
  const bundle = loadBundle({ bundleDir: outputDir })
  const result = validateBundle(bundle)

  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /missing required file: plugin-submission-pr\.md/)
})

test('validateBundle detects summary and artifact mismatches', () => {
  const bundle = loadBundle({ bundleDir: createBundle() })
  bundle.summary.plugin.id = 'openpet.example.changed'
  const result = validateBundle(bundle)

  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /summary\.plugin\.id is not present in plugin-submission-report\.md/)
  assert.match(result.errors.join('\n'), /summary\.plugin\.id is not present in plugin-submission-pr\.md/)
})
