const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')

const { insertUnsignedMarker, renameUnsignedWindowsAssets } = require('../../scripts/prepare-windows-release-assets')

test('insertUnsignedMarker labels Windows artifacts before their final extension', () => {
  assert.equal(insertUnsignedMarker('OpenPet-1.0.1-win32-x64.exe'), 'OpenPet-1.0.1-win32-x64-unsigned.exe')
  assert.equal(insertUnsignedMarker('OpenPet-1.0.1-win32-x64.zip'), 'OpenPet-1.0.1-win32-x64-unsigned.zip')
  assert.equal(insertUnsignedMarker('OpenPet-1.0.1-win32-x64.exe.blockmap'), 'OpenPet-1.0.1-win32-x64.exe-unsigned.blockmap')
  assert.equal(insertUnsignedMarker('OpenPet-1.0.1-win32-x64-unsigned.exe'), 'OpenPet-1.0.1-win32-x64-unsigned.exe')
})

test('renameUnsignedWindowsAssets renames Windows outputs and updates latest.yml', () => {
  const releaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpet-release-assets-'))
  fs.writeFileSync(path.join(releaseDir, 'OpenPet-1.0.1-win32-x64.exe'), 'installer')
  fs.writeFileSync(path.join(releaseDir, 'OpenPet-1.0.1-win32-x64.exe.blockmap'), 'blockmap')
  fs.writeFileSync(path.join(releaseDir, 'OpenPet-1.0.1-win32-x64.zip'), 'zip')
  fs.writeFileSync(path.join(releaseDir, 'OpenPet-1.0.1-darwin-arm64.zip'), 'mac zip')
  fs.writeFileSync(path.join(releaseDir, 'latest.yml'), [
    'path: OpenPet-1.0.1-win32-x64.exe',
    'files:',
    '  - url: OpenPet-1.0.1-win32-x64.exe',
    '  - url: OpenPet-1.0.1-win32-x64.exe.blockmap',
    '  - url: OpenPet-1.0.1-win32-x64.zip'
  ].join('\n'))

  const result = renameUnsignedWindowsAssets({ releaseDir })

  assert.deepEqual(result.renamed, [
    { from: 'OpenPet-1.0.1-win32-x64.exe', to: 'OpenPet-1.0.1-win32-x64-unsigned.exe' },
    { from: 'OpenPet-1.0.1-win32-x64.exe.blockmap', to: 'OpenPet-1.0.1-win32-x64.exe-unsigned.blockmap' },
    { from: 'OpenPet-1.0.1-win32-x64.zip', to: 'OpenPet-1.0.1-win32-x64-unsigned.zip' }
  ])
  assert.equal(result.feedUpdated, true)
  assert.equal(fs.existsSync(path.join(releaseDir, 'OpenPet-1.0.1-win32-x64.exe')), false)
  assert.equal(fs.existsSync(path.join(releaseDir, 'OpenPet-1.0.1-win32-x64-unsigned.exe')), true)
  assert.equal(fs.existsSync(path.join(releaseDir, 'OpenPet-1.0.1-darwin-arm64.zip')), true)

  const feed = fs.readFileSync(path.join(releaseDir, 'latest.yml'), 'utf-8')
  assert.match(feed, /OpenPet-1\.0\.1-win32-x64-unsigned\.exe/)
  assert.match(feed, /OpenPet-1\.0\.1-win32-x64\.exe-unsigned\.blockmap/)
  assert.match(feed, /OpenPet-1\.0\.1-win32-x64-unsigned\.zip/)
  assert.doesNotMatch(feed, /url: OpenPet-1\.0\.1-win32-x64\.exe$/m)
})

test('renameUnsignedWindowsAssets refuses to overwrite existing unsigned assets', () => {
  const releaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openpet-release-assets-conflict-'))
  fs.writeFileSync(path.join(releaseDir, 'OpenPet-1.0.1-win32-x64.exe'), 'installer')
  fs.writeFileSync(path.join(releaseDir, 'OpenPet-1.0.1-win32-x64-unsigned.exe'), 'existing')

  assert.throws(
    () => renameUnsignedWindowsAssets({ releaseDir }),
    /already exists/
  )
})
