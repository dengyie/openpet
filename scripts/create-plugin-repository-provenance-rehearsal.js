const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const { validatePluginPackage } = require('./validate-plugin-package')
const { createPluginSubmissionBundle } = require('./create-plugin-submission-bundle')
const { loadBundle, validateBundle } = require('./validate-plugin-submission-bundle')
const {
  createPluginMaintainerApproval,
  VALID_DECISIONS
} = require('./create-plugin-maintainer-approval')
const {
  loadApprovalBundle,
  validateMaintainerApproval
} = require('./validate-plugin-maintainer-approval')
const {
  assertSafeRehearsalOutputDir,
  zipPluginDirectory
} = require('./create-plugin-author-rehearsal')

const DEFAULT_OUTPUT_ROOT = path.join('docs', 'release-evidence', 'plugin-repository-provenance-rehearsal')

const usage = () => [
  'Usage: node scripts/create-plugin-repository-provenance-rehearsal.js --git-source <git-source> [options]',
  '',
  'Options:',
  '  --git-source <source>          Git clone source or bundle file to rehearse',
  '  --ref <ref>                   Optional branch, tag, or ref to check out',
  '  --plugin-subdir <dir>         Plugin directory inside the cloned repository',
  '  --output-dir <dir>            Directory for rehearsal artifacts',
  '  --reviewer <name>             Maintainer or reviewer name',
  '  --decision <approved|changes-requested>',
  '  --notes <text>                Review notes recorded by the maintainer',
  '  --json                        Print the machine-readable rehearsal summary',
  '  --help',
  '',
  'Clones a Git source, records repository provenance, packages the plugin snapshot,',
  'creates a submission bundle, records maintainer approval, and writes local evidence files.'
].join('\n')

const readValue = (argv, index, flag) => {
  const value = argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`)
  return value
}

const parseArgs = (argv) => {
  const options = {
    gitSource: '',
    ref: '',
    pluginSubdir: '',
    outputDir: '',
    reviewer: 'OpenPet Maintainer',
    decision: 'approved',
    notes: 'Repository provenance, manifest, package hash, and submission artifacts reviewed.',
    json: false,
    help: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--git-source') {
      options.gitSource = readValue(argv, index, arg)
      index += 1
    } else if (arg === '--ref') {
      options.ref = readValue(argv, index, arg)
      index += 1
    } else if (arg === '--plugin-subdir') {
      options.pluginSubdir = readValue(argv, index, arg)
      index += 1
    } else if (arg === '--output-dir') {
      options.outputDir = readValue(argv, index, arg)
      index += 1
    } else if (arg === '--reviewer') {
      options.reviewer = readValue(argv, index, arg)
      index += 1
    } else if (arg === '--decision') {
      options.decision = readValue(argv, index, arg)
      index += 1
    } else if (arg === '--notes') {
      options.notes = readValue(argv, index, arg)
      index += 1
    } else if (arg === '--json') {
      options.json = true
    } else {
      throw new Error(`Unexpected argument: ${arg}`)
    }
  }

  if (options.decision && !VALID_DECISIONS.has(options.decision)) {
    throw new Error(`Unknown approval decision: ${options.decision}`)
  }

  return options
}

const sessionIdFromDate = (date) => date.toISOString().replace(/[:.]/g, '-').replace(/-000Z$/, 'Z')

const writeJson = (filePath, value, fsImpl = fs) => {
  fsImpl.mkdirSync(path.dirname(filePath), { recursive: true })
  fsImpl.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

const writeText = (filePath, content, fsImpl = fs) => {
  fsImpl.mkdirSync(path.dirname(filePath), { recursive: true })
  fsImpl.writeFileSync(filePath, content.endsWith('\n') ? content : `${content}\n`)
}

const shellQuote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`

const isRemoteGitSource = (value) => (
  /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ||
  /^[^@\s]+@[^:\s]+:[^\s]+$/.test(value)
)

const normalizeGitSourceForProvenance = (gitSource) => (
  isRemoteGitSource(gitSource) ? gitSource : path.resolve(gitSource)
)

const resolveInside = (rootDir, relativeDir) => {
  const resolved = path.resolve(rootDir, relativeDir || '.')
  const relative = path.relative(rootDir, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Plugin subdirectory escapes the cloned repository: ${relativeDir}`)
  }
  return resolved
}

const git = (args, options = {}) => execFileSync('git', args, {
  stdio: 'pipe',
  encoding: 'utf-8',
  ...options
}).trim()

const cloneGitSource = ({ gitSource, ref = '', pluginSubdir = '', now = () => new Date(), fsImpl = fs }) => {
  if (!gitSource) throw new Error('Git source is required')

  const cloneWorkspace = fsImpl.mkdtempSync(path.join(os.tmpdir(), 'openpet-plugin-repository-source-'))
  git(['clone', gitSource, cloneWorkspace])
  if (ref) git(['checkout', ref], { cwd: cloneWorkspace })

  const resolvedCommit = git(['rev-parse', 'HEAD'], { cwd: cloneWorkspace })
  const pluginDir = resolveInside(cloneWorkspace, pluginSubdir)
  if (!fsImpl.existsSync(pluginDir) || !fsImpl.statSync(pluginDir).isDirectory()) {
    throw new Error(`Plugin directory not found inside cloned repository: ${pluginSubdir || '.'}`)
  }

  return {
    checkoutDir: cloneWorkspace,
    pluginDir,
    provenance: {
      kind: 'git',
      cloneSource: normalizeGitSourceForProvenance(gitSource),
      requestedRef: ref || '',
      resolvedCommit,
      pluginSubdir: pluginSubdir || '',
      checkedOutAt: now().toISOString()
    }
  }
}

const commandList = ({
  gitSource,
  ref,
  pluginSubdir,
  packagePath,
  bundleDir,
  reviewer,
  decision,
  notes
}) => {
  const cloneParts = ['git', 'clone', shellQuote(gitSource), '<checkout-dir>']
  if (ref) cloneParts.push(`&& git -C <checkout-dir> checkout ${shellQuote(ref)}`)
  const pluginPathHint = pluginSubdir ? `<checkout-dir>/${pluginSubdir}` : '<checkout-dir>'

  return [
    cloneParts.join(' '),
    `npm run validate:plugin -- ${shellQuote(pluginPathHint)}`,
    `cd ${shellQuote(pluginPathHint)} && zip -qr ${shellQuote(packagePath)} .`,
    `npm run validate:plugin -- ${shellQuote(packagePath)}`,
    `npm run create-plugin-submission-bundle -- ${shellQuote(packagePath)} --output-dir ${shellQuote(bundleDir)}`,
    `npm run validate-plugin-submission-bundle -- ${shellQuote(bundleDir)} --require-ready`,
    `npm run create-plugin-maintainer-approval -- ${shellQuote(bundleDir)} --reviewer ${shellQuote(reviewer)} --decision ${decision} --notes ${shellQuote(notes)}`,
    `npm run validate-plugin-maintainer-approval -- ${shellQuote(bundleDir)} --require-approved`
  ]
}

const renderReadme = ({ generatedAt, summary, commands }) => [
  '# OpenPet Plugin Repository Provenance Rehearsal',
  '',
  `Generated: ${generatedAt}`,
  '',
  'This rehearsal starts from a Git source, records repository provenance, packages the reviewed plugin snapshot, and records maintainer approval without installing, enabling, or running plugin code.',
  '',
  '## Source Repository',
  '',
  `- Clone source: ${summary.sourceRepository.cloneSource}`,
  `- Requested ref: ${summary.sourceRepository.requestedRef || '(default clone head)'}`,
  `- Resolved commit: ${summary.sourceRepository.resolvedCommit}`,
  `- Plugin subdirectory: ${summary.sourceRepository.pluginSubdir || '.'}`,
  '',
  '## Source Plugin',
  '',
  `- Name: ${summary.sourcePlugin.name}`,
  `- Id: ${summary.sourcePlugin.id}`,
  `- Version: ${summary.sourcePlugin.version}`,
  `- Package: ${summary.packagePath}`,
  `- Submission bundle: ${summary.submission.bundleDir}`,
  `- Approval decision: ${summary.approval.record.decision}`,
  '',
  '## Commands',
  '',
  '```bash',
  ...commands,
  '```',
  '',
  '## Boundary',
  '',
  '- This is repository-style provenance evidence, not proof of live public community adoption.',
  '- Maintainer approval is a human review artifact.',
  '- The archive does not prove signing trust, catalog publication, runtime safety, or release readiness.',
  ''
].join('\n')

const renderChecklist = ({ summary }) => [
  '# Repository Provenance Submission Checklist',
  '',
  `- [${summary.sourceValidation.ok ? 'x' : ' '}] Repository snapshot plugin validated.`,
  `- [${summary.packageValidation.ok ? 'x' : ' '}] Plugin packaged as .openpet-plugin.zip and validated.`,
  `- [${summary.submission.bundleValidation.ok ? 'x' : ' '}] Submission bundle created and validated.`,
  `- [${summary.approval.validation.ok ? 'x' : ' '}] Maintainer approval record created and validated.`,
  '- [ ] Reviewer verifies that repository provenance is sufficient for the intended community workflow.',
  '- [ ] Maintainer verifies signature/trust policy before catalog distribution.',
  '',
  'Review reminder: repository provenance capture is a workflow step toward external community evidence, not final trust proof.',
  ''
].join('\n')

const createPluginRepositoryProvenanceRehearsal = ({
  gitSource,
  ref = '',
  pluginSubdir = '',
  outputDir = '',
  reviewer = 'OpenPet Maintainer',
  decision = 'approved',
  notes = 'Repository provenance, manifest, package hash, and submission artifacts reviewed.',
  now = () => new Date(),
  fsImpl = fs,
  execFile = execFileSync
} = {}) => {
  if (!gitSource) throw new Error('Git source is required')
  if (!VALID_DECISIONS.has(decision)) throw new Error(`Unknown approval decision: ${decision || '(missing)'}`)

  const generatedAt = now().toISOString()
  const resolvedOutputDir = outputDir || path.join(DEFAULT_OUTPUT_ROOT, sessionIdFromDate(new Date(generatedAt)))
  const absoluteOutputDir = assertSafeRehearsalOutputDir(resolvedOutputDir)
  const packagesDir = path.join(absoluteOutputDir, 'packages')
  const bundleDir = path.join(absoluteOutputDir, 'submission-bundle')

  fsImpl.rmSync(absoluteOutputDir, { recursive: true, force: true })
  fsImpl.mkdirSync(packagesDir, { recursive: true })

  const source = cloneGitSource({
    gitSource,
    ref,
    pluginSubdir,
    now: () => new Date(generatedAt),
    fsImpl
  })

  const sourceValidation = validatePluginPackage(source.pluginDir)
  if (!sourceValidation.ok) {
    throw new Error(`Source plugin validation failed: ${sourceValidation.errors.join('; ')}`)
  }

  const sourcePlugin = {
    id: sourceValidation.review.plugin.id,
    name: sourceValidation.review.plugin.name,
    version: sourceValidation.review.plugin.version,
    permissions: sourceValidation.review.plugin.permissions,
    networkAllowlist: sourceValidation.review.plugin.network.allowlist
  }

  const packagePath = zipPluginDirectory({
    pluginDir: source.pluginDir,
    outputDir: packagesDir,
    pluginId: sourcePlugin.id,
    execFile,
    fsImpl
  })
  const packageValidation = validatePluginPackage(packagePath)
  if (!packageValidation.ok) {
    throw new Error(`Packaged plugin validation failed: ${packageValidation.errors.join('; ')}`)
  }

  const bundle = createPluginSubmissionBundle({
    sourcePath: packagePath,
    outputDir: bundleDir,
    now: () => new Date(generatedAt),
    fsImpl
  })
  const bundleValidation = validateBundle(loadBundle({ bundleDir, fsImpl }), { requireReady: true })
  if (!bundleValidation.ok) {
    throw new Error(`Submission bundle validation failed: ${bundleValidation.errors.join('; ')}`)
  }

  const approvalRecord = createPluginMaintainerApproval({
    bundleDir,
    reviewer,
    decision,
    notes,
    now: () => new Date(generatedAt),
    fsImpl
  })
  const approvalValidation = validateMaintainerApproval(loadApprovalBundle({ bundleDir, fsImpl }), { requireApproved: true })
  if (!approvalValidation.ok) {
    throw new Error(`Maintainer approval validation failed: ${approvalValidation.errors.join('; ')}`)
  }

  const commands = commandList({
    gitSource: source.provenance.cloneSource,
    ref,
    pluginSubdir,
    packagePath,
    bundleDir,
    reviewer,
    decision,
    notes
  })

  const summary = {
    generatedAt,
    outputDir: absoluteOutputDir,
    sourceRepository: source.provenance,
    sourcePlugin,
    sourceValidation: {
      ok: sourceValidation.ok,
      warnings: sourceValidation.warnings,
      errors: sourceValidation.errors,
      riskLevel: sourceValidation.review.riskLevel
    },
    packagePath,
    packageValidation: {
      ok: packageValidation.ok,
      warnings: packageValidation.warnings,
      errors: packageValidation.errors,
      riskLevel: packageValidation.review.riskLevel,
      sha256: packageValidation.review.packageHash
    },
    submission: {
      bundleDir,
      bundle,
      bundleValidation
    },
    approval: {
      record: approvalRecord,
      validation: approvalValidation
    },
    files: {
      readme: path.join(absoluteOutputDir, 'README.md'),
      checklist: path.join(absoluteOutputDir, 'submission-checklist.md'),
      commands: path.join(absoluteOutputDir, 'commands.json'),
      provenance: path.join(absoluteOutputDir, 'source-provenance.json'),
      summary: path.join(absoluteOutputDir, 'plugin-repository-provenance-rehearsal-summary.json')
    }
  }

  writeText(summary.files.readme, renderReadme({ generatedAt, summary, commands }), fsImpl)
  writeText(summary.files.checklist, renderChecklist({ summary }), fsImpl)
  writeJson(summary.files.commands, { commands }, fsImpl)
  writeJson(summary.files.provenance, summary.sourceRepository, fsImpl)
  writeJson(summary.files.summary, summary, fsImpl)

  return summary
}

const main = () => {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }

  const summary = createPluginRepositoryProvenanceRehearsal(options)
  if (options.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  } else {
    console.log(`Plugin repository provenance rehearsal created: ${summary.outputDir}`)
    console.log(`README: ${summary.files.readme}`)
    console.log(`Checklist: ${summary.files.checklist}`)
    console.log(`Submission bundle: ${summary.submission.bundleDir}`)
  }
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(error.message || error)
    process.exit(1)
  }
}

module.exports = {
  cloneGitSource,
  createPluginRepositoryProvenanceRehearsal,
  normalizeGitSourceForProvenance,
  parseArgs,
  renderChecklist,
  renderReadme,
  sessionIdFromDate
}
