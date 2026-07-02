const fs = require('fs')
const path = require('path')
const { runCommand } = require('./command-io')

runCommand(async (context) => {
  const dataDir = process.env.OPENPET_DATA_DIR || context.paths?.dataDir || ''
  const checks = [
    {
      id: 'data-dir',
      ok: Boolean(dataDir) && fs.existsSync(dataDir),
      message: dataDir ? 'Plugin data directory is available.' : 'OPENPET_DATA_DIR is not available.'
    },
    {
      id: 'manual-hook-plan',
      ok: Boolean(dataDir) && fs.existsSync(path.join(dataDir, 'codex-hooks.manual.md')),
      message: 'Manual Codex hook setup instructions exist.'
    },
    {
      id: 'service-bridge',
      ok: Boolean(process.env.OPENPET_BRIDGE_URL && process.env.OPENPET_BRIDGE_TOKEN),
      message: 'Command bridge is available for this doctor command.'
    }
  ]
  return {
    healthy: checks.every((check) => check.ok),
    checks
  }
})
