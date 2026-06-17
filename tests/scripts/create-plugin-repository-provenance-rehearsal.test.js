const test = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const {
  createPluginRepositoryProvenanceRehearsal,
  normalizeGitSourceForProvenance,
  parseArgs
} = require('../../scripts/create-plugin-repository-provenance-rehearsal')

const EXAMPLE_PLUGIN_PATH = path.join(__dirname, '../../examples/plugins/weather-status')

const copyDir = (sourceDir, targetDir) => {
  fs.mkdirSync(targetDir, { recursive: true })
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)
    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath)
    } else {
      fs.copyFileSync(sourcePath, targetPath)
    }
  }
}

const git = (args, options = {}) => execFileSync('git', args, { stdio: 'pipe', ...options }).toString().trim()

const createRepoBundleFixture = ({ when = '2026-06-17T16:30:00.000Z' } = {}) => {
  const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpet-plugin-repo-source-'))
  const pluginDir = path.join(repoDir, 'plugin')
  copyDir(EXAMPLE_PLUGIN_PATH, pluginDir)

  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'OpenPet Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@openpet.local',
    GIT_AUTHOR_DATE: when,
    GIT_COMMITTER_NAME: 'OpenPet Fixture',
    GIT_COMMITTER_EMAIL: 'fixture@openpet.local',
    GIT_COMMITTER_DATE: when
  }

  git(['init', '--initial-branch=main'], { cwd: repoDir, env })
  git(['add', '.'], { cwd: repoDir, env })
  git(['commit', '-m', 'fixture: add weather-status community source'], { cwd: repoDir, env })

  const bundlePath = path.join(os.tmpdir(), `openpet-weather-status-community-${Date.now()}.bundle`)
  fs.rmSync(bundlePath, { force: true })
  git(['bundle', 'create', bundlePath, '--all'], { cwd: repoDir, env })
  const resolvedCommit = git(['rev-parse', 'HEAD'], { cwd: repoDir, env })

  return { repoDir, bundlePath, resolvedCommit }
}

test('parseArgs accepts git-source provenance rehearsal options', () => {
  const options = parseArgs([
    '--git-source', 'fixtures/community.bundle',
    '--ref', 'refs/heads/main',
    '--plugin-subdir', 'plugin',
    '--output-dir', 'docs/release-evidence/session-a',
    '--reviewer', 'OpenPet Maintainer',
    '--decision', 'approved',
    '--notes', 'Repository provenance reviewed.',
    '--json'
  ])

  assert.equal(options.gitSource, 'fixtures/community.bundle')
  assert.equal(options.ref, 'refs/heads/main')
  assert.equal(options.pluginSubdir, 'plugin')
  assert.equal(options.outputDir, 'docs/release-evidence/session-a')
  assert.equal(options.reviewer, 'OpenPet Maintainer')
  assert.equal(options.decision, 'approved')
  assert.equal(options.notes, 'Repository provenance reviewed.')
  assert.equal(options.json, true)
})

test('parseArgs rejects missing values and unknown decisions', () => {
  assert.throws(() => parseArgs(['--git-source']), /--git-source requires a value/)
  assert.throws(() => parseArgs(['--ref']), /--ref requires a value/)
  assert.throws(() => parseArgs(['--plugin-subdir']), /--plugin-subdir requires a value/)
  assert.throws(() => parseArgs(['--output-dir']), /--output-dir requires a value/)
  assert.throws(() => parseArgs(['--reviewer']), /--reviewer requires a value/)
  assert.throws(() => parseArgs(['--decision']), /--decision requires a value/)
  assert.throws(() => parseArgs(['--notes']), /--notes requires a value/)
  assert.throws(
    () => parseArgs(['--git-source', 'x', '--decision', 'pending']),
    /Unknown approval decision/
  )
})

test('normalizeGitSourceForProvenance preserves remote sources and resolves local paths', () => {
  assert.equal(
    normalizeGitSourceForProvenance('https://github.com/openpet/community-plugin.git'),
    'https://github.com/openpet/community-plugin.git'
  )
  assert.equal(
    normalizeGitSourceForProvenance('git@github.com:openpet/community-plugin.git'),
    'git@github.com:openpet/community-plugin.git'
  )
  assert.equal(
    normalizeGitSourceForProvenance('fixtures/community.bundle'),
    path.resolve('fixtures/community.bundle')
  )
})

test('createPluginRepositoryProvenanceRehearsal records repository provenance and approval artifacts', () => {
  const { bundlePath, resolvedCommit } = createRepoBundleFixture()
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpet-plugin-repository-rehearsal-'))

  const summary = createPluginRepositoryProvenanceRehearsal({
    gitSource: bundlePath,
    ref: 'refs/heads/main',
    pluginSubdir: 'plugin',
    outputDir,
    reviewer: 'OpenPet Maintainer',
    decision: 'approved',
    notes: 'Repository provenance, manifest, package hash, and submission artifacts reviewed.',
    now: () => new Date('2026-06-17T16:30:00.000Z')
  })

  assert.equal(summary.sourceRepository.kind, 'git')
  assert.equal(summary.sourceRepository.cloneSource, bundlePath)
  assert.equal(summary.sourceRepository.requestedRef, 'refs/heads/main')
  assert.equal(summary.sourceRepository.pluginSubdir, 'plugin')
  assert.equal(summary.sourceRepository.resolvedCommit, resolvedCommit)
  assert.match(summary.sourceRepository.resolvedCommit, /^[0-9a-f]{40}$/)
  assert.equal(summary.sourcePlugin.id, 'openpet.example.weather-status')
  assert.equal(summary.submission.bundleValidation.ok, true)
  assert.equal(summary.approval.validation.ok, true)
  assert.equal(fs.existsSync(summary.files.readme), true)
  assert.equal(fs.existsSync(summary.files.checklist), true)
  assert.equal(fs.existsSync(summary.files.commands), true)
  assert.equal(fs.existsSync(summary.files.summary), true)
  assert.equal(fs.existsSync(summary.files.provenance), true)
  assert.equal(fs.existsSync(summary.packagePath), true)
  assert.equal(fs.existsSync(summary.submission.bundleDir), true)
  assert.equal(fs.existsSync(summary.approval.record.files.markdown), true)
  assert.equal(fs.existsSync(summary.approval.record.files.json), true)

  const provenance = JSON.parse(fs.readFileSync(summary.files.provenance, 'utf-8'))
  assert.equal(provenance.kind, 'git')
  assert.equal(provenance.cloneSource, bundlePath)
  assert.equal(provenance.requestedRef, 'refs/heads/main')
  assert.equal(provenance.pluginSubdir, 'plugin')
  assert.equal(provenance.resolvedCommit, resolvedCommit)
})
