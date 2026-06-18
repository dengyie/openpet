const fs = require('fs')
const path = require('path')

const { CHECK_GUIDANCE } = require('./create-plugin-cleanup-evidence-collector')
const { REQUIRED_CHECKS, validateReport } = require('./validate-plugin-cleanup-evidence-report')

const DEFAULT_OUTPUT_NAME = 'plugin-cleanup-packaged-runbook.md'

const usage = () => [
  'Usage: node scripts/create-plugin-cleanup-packaged-runbook.js <report.json> [--output <runbook.md>]',
  '',
  'Creates a Markdown runbook for collecting packaged-app plugin cleanup evidence.',
  'The runbook is an operator guide only; it does not mark cleanup checks as passed or prove cleanup readiness.'
].join('\n')

const parseArgs = (argv) => {
  const options = {
    reportPath: null,
    outputPath: null,
    help: false
  }

  const readValue = (index, flag) => {
    const value = argv[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`)
    return value
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--output') {
      options.outputPath = readValue(index, arg)
      index += 1
    } else if (!options.reportPath) {
      options.reportPath = arg
    } else {
      throw new Error(`Unexpected argument: ${arg}`)
    }
  }

  return options
}

const loadReport = (reportPath, fsImpl = fs) => {
  if (!reportPath) throw new Error('Report path is required')
  const absolutePath = path.resolve(reportPath)
  return {
    absolutePath,
    report: JSON.parse(fsImpl.readFileSync(absolutePath, 'utf-8'))
  }
}

const defaultOutputPath = (reportPath) => path.join(path.dirname(path.resolve(reportPath)), DEFAULT_OUTPUT_NAME)

const commandPath = (reportPath) => {
  const relative = path.relative(process.cwd(), path.resolve(reportPath))
  return relative && !relative.startsWith('..') ? relative : path.resolve(reportPath)
}

const markdownTableEscape = (value) => String(value || '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

const valueOrPlaceholder = (value, placeholder = '<fill during packaged cleanup validation>') => {
  const text = String(value || '').trim()
  return text || placeholder
}

const createRunbook = ({ report, reportPath, generatedAt = new Date() }) => {
  const validation = validateReport(report, { allowPending: true })
  if (!validation.ok) {
    throw new Error(`Cannot create plugin cleanup packaged runbook from an invalid report: ${validation.errors.join('; ')}`)
  }

  const reportCommandPath = commandPath(reportPath)
  const lines = []
  lines.push('# OpenPet Packaged Plugin Cleanup Evidence Runbook')
  lines.push('')
  lines.push(`Generated: ${generatedAt.toISOString()}`)
  lines.push(`Report: \`${reportCommandPath}\``)
  lines.push('')
  lines.push('## Scope')
  lines.push('')
  lines.push('Use this runbook only during a real packaged OpenPet validation run. This file does not prove plugin cleanup readiness by itself; readiness requires every required cleanup check to pass with concrete packaged-app evidence.')
  lines.push('')
  lines.push('## Packaged App Under Test')
  lines.push('')
  lines.push(`- Plugin ID: ${valueOrPlaceholder(report.scenario?.pluginId)}`)
  lines.push(`- Host app: ${valueOrPlaceholder(report.scenario?.hostApp)}`)
  lines.push(`- Scenario notes: ${valueOrPlaceholder(report.scenario?.notes)}`)
  lines.push(`- Platform: ${valueOrPlaceholder(report.environment?.platform)}`)
  lines.push(`- Architecture: ${valueOrPlaceholder(report.environment?.arch)}`)
  lines.push(`- Node: ${valueOrPlaceholder(report.environment?.node)}`)
  lines.push(`- Machine: ${valueOrPlaceholder(report.environment?.machine)}`)
  lines.push(`- Runner: ${valueOrPlaceholder(report.environment?.runner)}`)
  lines.push('')
  lines.push('## Execution Steps')
  lines.push('')
  lines.push('1. Build or download the packaged OpenPet artifact under test.')
  lines.push('2. Launch the packaged app with a fresh validation profile and keep terminal or screen recording evidence.')
  lines.push('3. Install or enable the cleanup fixture or target local plugin through Control Center.')
  lines.push('4. Exercise setup, declaration-command, and service cleanup paths from the packaged app UI.')
  lines.push('5. Store logs, screenshots, process listings, and transcripts under `plugin-cleanup-evidence-collected/packaged-app-transcripts/`.')
  lines.push('6. Update the structured cleanup report only after reviewing the matching evidence.')
  lines.push('')
  lines.push('## Required Checks')
  lines.push('')
  lines.push('| Check ID | What To Prove | Packaged Evidence Guidance | Update Command |')
  lines.push('|----------|---------------|----------------------------|----------------|')
  for (const check of REQUIRED_CHECKS) {
    const guidance = CHECK_GUIDANCE[check.id] || 'Record concrete evidence from the packaged app cleanup validation run.'
    const command = `npm run update-plugin-cleanup-evidence-report -- ${reportCommandPath} --check ${check.id} --status <pending|pass|fail|blocked> --evidence "<real packaged-app evidence>"`
    lines.push(`| \`${check.id}\` | ${markdownTableEscape(check.label)} | ${markdownTableEscape(guidance)} | \`${command}\` |`)
  }
  lines.push('')
  lines.push('## Validate And Archive')
  lines.push('')
  lines.push('Run these after the packaged-app evidence is collected. The allow-pending command is safe for in-progress archives; the strict readiness command must fail until every check is passed with evidence.')
  lines.push('')
  lines.push('```bash')
  lines.push(`npm run validate-plugin-cleanup-evidence-report -- ${reportCommandPath} --allow-pending`)
  lines.push(`npm run validate-plugin-cleanup-evidence-report -- ${reportCommandPath}`)
  lines.push('npm run create-plugin-cleanup-evidence-archive-manifest -- --archive-dir <plugin-cleanup-evidence-archive-dir>')
  lines.push('```')
  lines.push('')
  lines.push('Do not replace the status placeholder with pass until matching packaged-app evidence exists for that exact check. This runbook does not execute cleanup, does not mark checks as passed, and does not prove plugin cleanup readiness.')
  lines.push('')

  return lines.join('\n')
}

const writeRunbook = ({ content, outputPath, fsImpl = fs }) => {
  const absoluteOutputPath = path.resolve(outputPath)
  fsImpl.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true })
  fsImpl.writeFileSync(absoluteOutputPath, `${content.trimEnd()}\n`)
  return absoluteOutputPath
}

const main = () => {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(usage())
    return
  }

  const { absolutePath, report } = loadReport(options.reportPath)
  const outputPath = options.outputPath || defaultOutputPath(absolutePath)
  const content = createRunbook({ report, reportPath: absolutePath })
  const writtenPath = writeRunbook({ content, outputPath })

  console.log(`Plugin cleanup packaged runbook created: ${writtenPath}`)
  console.log(`Checks documented: ${REQUIRED_CHECKS.length}`)
  console.log('This runbook is an operator guide; it does not prove plugin cleanup readiness.')
}

if (require.main === module) {
  try {
    main()
  } catch (err) {
    console.error(err.message || err)
    process.exit(1)
  }
}

module.exports = {
  createRunbook,
  defaultOutputPath,
  parseArgs,
  writeRunbook
}
