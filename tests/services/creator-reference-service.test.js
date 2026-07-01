const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const sharp = require('sharp')

const { createCreatorReferenceService } = require('../../src/main/services/creator-reference-service')

const createSettingsService = (initial = {}) => {
  let state = JSON.parse(JSON.stringify(initial))
  return {
    get: () => JSON.parse(JSON.stringify(state)),
    save: (next) => {
      state = JSON.parse(JSON.stringify(next))
      return state
    }
  }
}

const createReferenceImage = async (filePath, { width = 24, height = 24 } = {}) => {
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 180, b: 0, alpha: 1 }
    }
  }).png().toFile(filePath)
}

test('creator reference service binds a canonical reference and persists metadata', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openpet-creator-reference-'))
  const sourcePath = path.join(tempRoot, 'source.png')
  await createReferenceImage(sourcePath, { width: 32, height: 20 })

  const settingsService = createSettingsService()
  const service = createCreatorReferenceService({
    settingsService,
    referenceRoot: path.join(tempRoot, 'references'),
    now: () => '2026-07-02T10:00:00.000Z'
  })

  const result = await service.bindReference({
    targetType: 'editable-action-host',
    targetId: 'legacy-editable-host',
    sourcePath
  })

  assert.equal(result.replaced, false)
  assert.equal(result.reference.targetType, 'editable-action-host')
  assert.equal(result.reference.targetId, 'legacy-editable-host')
  assert.equal(result.reference.fileName, 'source.png')
  assert.equal(result.reference.width, 32)
  assert.equal(result.reference.height, 20)
  assert.match(result.reference.assetPath, /creator-reference/i)
  assert.ok(fs.existsSync(result.reference.assetPath))

  const stored = settingsService.get().creator.references['editable-action-host:legacy-editable-host']
  assert.equal(stored.fileName, 'source.png')
  assert.equal(stored.createdAt, '2026-07-02T10:00:00.000Z')
  assert.equal(stored.updatedAt, '2026-07-02T10:00:00.000Z')
  assert.equal(typeof stored.contentHash, 'string')
  assert.ok(stored.contentHash.length > 20)

  const view = service.getReference({
    targetType: 'editable-action-host',
    targetId: 'legacy-editable-host'
  })
  assert.equal(view.contentHash, stored.contentHash)
  assert.match(view.assetUrl, /^file:/)
})

test('creator reference service copies canonical reference into a creator run and patches run metadata', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openpet-creator-reference-run-'))
  const sourcePath = path.join(tempRoot, 'source.png')
  await createReferenceImage(sourcePath, { width: 40, height: 28 })

  const settingsService = createSettingsService()
  const service = createCreatorReferenceService({
    settingsService,
    referenceRoot: path.join(tempRoot, 'references'),
    now: () => '2026-07-02T10:05:00.000Z'
  })

  await service.bindReference({
    targetType: 'pet-pack',
    targetId: 'mango-cat',
    sourcePath
  })

  const pluginDataDir = path.join(tempRoot, 'plugin-data')
  const runDir = path.join(pluginDataDir, 'runs', '2026-07-02-mango-cat')
  fs.mkdirSync(runDir, { recursive: true })
  fs.writeFileSync(path.join(runDir, 'run.json'), `${JSON.stringify({ runId: '2026-07-02-mango-cat', input: { petName: 'Mango Cat' } }, null, 2)}\n`)

  const copied = service.copyReferenceIntoRun({
    targetType: 'pet-pack',
    targetId: 'mango-cat',
    pluginDataDir,
    runId: '2026-07-02-mango-cat'
  })

  assert.ok(fs.existsSync(copied.assetPath))
  assert.ok(fs.existsSync(copied.metadataPath))
  assert.equal(copied.fileName, 'canonical-reference.png')
  assert.equal(copied.relativePath, 'runs/2026-07-02-mango-cat/inputs/references/canonical-reference.png')

  const metadata = JSON.parse(fs.readFileSync(copied.metadataPath, 'utf-8'))
  assert.equal(metadata.targetType, 'pet-pack')
  assert.equal(metadata.targetId, 'mango-cat')
  assert.equal(metadata.width, 40)
  assert.equal(metadata.height, 28)

  const run = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf-8'))
  assert.deepEqual(run.input.referenceImage, {
    targetType: 'pet-pack',
    targetId: 'mango-cat',
    fileName: 'canonical-reference.png',
    originalFileName: 'source.png',
    width: 40,
    height: 28,
    contentHash: metadata.contentHash,
    relativePath: 'runs/2026-07-02-mango-cat/inputs/references/canonical-reference.png',
    metadataRelativePath: 'runs/2026-07-02-mango-cat/inputs/references/reference.json'
  })
})

test('creator reference service preserves the previous canonical asset when a replacement bind fails', async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openpet-creator-reference-preserve-'))
  const sourcePath = path.join(tempRoot, 'source.png')
  await createReferenceImage(sourcePath, { width: 48, height: 36 })

  const settingsService = createSettingsService()
  const service = createCreatorReferenceService({
    settingsService,
    referenceRoot: path.join(tempRoot, 'references'),
    now: () => '2026-07-02T10:10:00.000Z'
  })

  const first = await service.bindReference({
    targetType: 'editable-action-host',
    targetId: 'legacy-editable-host',
    sourcePath
  })

  await assert.rejects(() => service.bindReference({
    targetType: 'editable-action-host',
    targetId: 'legacy-editable-host',
    sourcePath: path.join(tempRoot, 'missing.png')
  }), /does not exist/i)

  const current = service.getReference({
    targetType: 'editable-action-host',
    targetId: 'legacy-editable-host'
  })
  assert.ok(current)
  assert.equal(current.assetPath, first.reference.assetPath)
  assert.ok(fs.existsSync(first.reference.assetPath))
  assert.equal(current.contentHash, first.reference.contentHash)
})
