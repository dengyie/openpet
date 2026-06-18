const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const { normalizePluginManifest } = require('../../src/main/plugins/manifest')

const pluginRoot = path.resolve(__dirname, '../../examples/plugins/creator-studio')

test('creator studio example manifest declares hybrid creator workflow entries', () => {
  const manifest = normalizePluginManifest(
    JSON.parse(fs.readFileSync(path.join(pluginRoot, 'plugin.json'), 'utf-8')),
    { source: 'local', basePath: pluginRoot }
  )

  assert.equal(manifest.id, 'openpet.creator-studio')
  assert.equal(manifest.profile, 'hybrid')
  assert.deepEqual(manifest.permissions, ['pet-pack:import', 'pet:say'])
  assert.deepEqual(manifest.commands.map((command) => command.id), [
    'create-run',
    'run-step',
    'approve-run',
    'import-approved-pet',
    'export-bundle'
  ])
  assert.equal(manifest.entries.services[0].id, 'studio')
  assert.equal(manifest.entries.dashboards[0].id, 'main')
})
