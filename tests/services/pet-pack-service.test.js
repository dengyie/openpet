const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')

const { createActionService } = require('../../src/main/services/action-service')
const { BUILT_IN_PACK_ID, createPetPackService } = require('../../src/main/services/pet-pack-service')

const createSettingsService = (initialSettings = {}) => {
  let settings = {
    petPacks: {
      activePackId: BUILT_IN_PACK_ID,
      installed: {}
    },
    ...initialSettings
  }
  return {
    get: () => settings,
    save: (nextSettings) => {
      settings = nextSettings
      return settings
    }
  }
}

const createTempDir = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `openpet-${name}-`))

const sha256 = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')

const createPetPackDirectory = (root, manifest = {}) => {
  fs.mkdirSync(path.join(root, 'sprites'), { recursive: true })
  const actions = manifest.actions || [
    { id: 'idle', label: 'Idle', kind: 'idle', sprite: 'sprites/idle.png', frameCount: 1, frameMs: 100, frameWidth: 32, frameHeight: 32 },
    { id: 'wave', label: 'Wave', kind: 'greeting', sprite: 'sprites/wave.png', frameCount: 1, frameMs: 100, frameWidth: 32, frameHeight: 32 }
  ]
  for (const action of actions) {
    fs.writeFileSync(path.join(root, action.sprite), '')
  }
  fs.writeFileSync(path.join(root, 'pet.json'), JSON.stringify({
    schemaVersion: 1,
    id: manifest.id || 'pack-cat',
    displayName: manifest.displayName || 'Pack Cat',
    version: manifest.version || '1.0.0',
    defaultAction: manifest.defaultAction || actions[0].id,
    clickAction: manifest.clickAction || actions[1]?.id || actions[0].id,
    actions
  }))
}

const createMinimalWebp = ({ width, height }) => {
  const buffer = Buffer.alloc(30)
  buffer.write('RIFF', 0, 'ascii')
  buffer.writeUInt32LE(22, 4)
  buffer.write('WEBP', 8, 'ascii')
  buffer.write('VP8X', 12, 'ascii')
  buffer.writeUInt32LE(10, 16)
  buffer.writeUInt8(0, 20)
  buffer.writeUIntLE(width - 1, 24, 3)
  buffer.writeUIntLE(height - 1, 27, 3)
  return buffer
}

const createCodexPetDirectory = (root, manifest = {}) => {
  fs.writeFileSync(path.join(root, manifest.spritesheetPath || 'spritesheet.webp'), createMinimalWebp({ width: 1536, height: 1872 }))
  fs.writeFileSync(path.join(root, 'pet.json'), JSON.stringify({
    id: manifest.id || 'codex-cat',
    displayName: manifest.displayName || 'Codex Cat',
    description: manifest.description || 'A Codex-compatible pet.',
    spritesheetPath: manifest.spritesheetPath || 'spritesheet.webp'
  }))
}

const createZipFromDirectory = (sourceDir, zipName = 'pet.codex-pet.zip') => {
  const zipRoot = createTempDir('pet-pack-zip')
  const zipPath = path.join(zipRoot, zipName)
  execFileSync('zip', ['-qr', zipPath, '.'], { cwd: sourceDir })
  return zipPath
}

const createUnsafeZip = () => {
  const sourceRoot = createTempDir('pet-pack-unsafe-src')
  const nested = path.join(sourceRoot, 'nested')
  fs.mkdirSync(nested)
  fs.writeFileSync(path.join(sourceRoot, 'evil.txt'), 'evil')
  const zipPath = path.join(sourceRoot, 'unsafe.codex-pet.zip')
  execFileSync('zip', ['-q', zipPath, '../evil.txt'], { cwd: nested })
  return zipPath
}

const createService = (settingsService = createSettingsService()) => createPetPackService({
  settingsService,
  userPacksDir: createTempDir('pet-packs'),
  projectRoot: '/app/openpet',
  loadLegacyAnimations: () => ({
    defaultAction: 'bai_no_bg',
    clickAction: 'eat_no_bg',
    actions: [
      { id: 'bai_no_bg', label: '待机', loop: true, frameCount: 16, frameMs: 95, frameWidth: 191, frameHeight: 453, sprite: 'cat_anime/sprites/bai_no_bg.png' },
      { id: 'eat_no_bg', label: '喂食', loop: false, frameCount: 16, frameMs: 85, frameWidth: 381, frameHeight: 253, sprite: 'cat_anime/sprites/eat_no_bg.png' }
    ]
  }),
  now: () => new Date('2026-06-12T00:00:00.000Z')
})

test('pet pack service lists the built-in legacy pack', () => {
  const service = createService()

  const result = service.listPacks()

  assert.equal(result.activePackId, BUILT_IN_PACK_ID)
  assert.equal(result.packs.length, 1)
  assert.equal(result.packs[0].id, BUILT_IN_PACK_ID)
  assert.equal(result.packs[0].source, 'built-in')
  assert.equal(result.packs[0].active, true)
  assert.equal(result.packs[0].actionCount, 2)
})

test('pet pack service inspects and imports a valid pack directory', () => {
  const sourceDir = createTempDir('pet-pack-source')
  createPetPackDirectory(sourceDir)
  const settingsService = createSettingsService()
  const service = createService(settingsService)

  const inspection = service.inspectPackDirectory(sourceDir)
  const imported = service.importPack(inspection.selectionId)
  const listed = service.listPacks()

  assert.equal(inspection.valid, true)
  assert.equal(inspection.pack.id, 'pack-cat')
  assert.equal(imported.pack.id, 'pack-cat')
  assert.equal(settingsService.get().petPacks.installed['pack-cat'].version, '1.0.0')
  assert.equal(listed.packs.some((pack) => pack.id === 'pack-cat'), true)
})

test('pet pack service inspects and imports a Codex-compatible pet directory', () => {
  const sourceDir = createTempDir('codex-pet-source')
  createCodexPetDirectory(sourceDir)
  const settingsService = createSettingsService()
  const service = createService(settingsService)

  const inspection = service.inspectPackDirectory(sourceDir)
  const imported = service.importPack(inspection.selectionId)
  const listed = service.listPacks()

  assert.equal(inspection.valid, true)
  assert.equal(inspection.pack.id, 'codex-cat')
  assert.equal(inspection.pack.source, 'codex-pet')
  assert.equal(inspection.pack.actionCount, 9)
  assert.equal(inspection.pack.previewAction.frameWidth, 192)
  assert.equal(imported.pack.id, 'codex-cat')
  assert.equal(settingsService.get().petPacks.installed['codex-cat'].displayName, 'Codex Cat')
  assert.equal(listed.packs.some((pack) => pack.id === 'codex-cat'), true)
})

test('pet pack service inspects and imports a Codex-compatible pet zip package', () => {
  const sourceDir = createTempDir('codex-pet-zip-source')
  createCodexPetDirectory(sourceDir, { id: 'zip-codex-cat', displayName: 'Zip Codex Cat' })
  const zipPath = createZipFromDirectory(sourceDir)
  const settingsService = createSettingsService()
  const userPacksDir = createTempDir('pet-packs')
  const service = createPetPackService({
    settingsService,
    userPacksDir,
    projectRoot: '/app/openpet',
    loadLegacyAnimations: () => ({ defaultAction: 'idle', clickAction: 'idle', actions: [] }),
    now: () => new Date('2026-06-12T00:00:00.000Z')
  })

  const inspection = service.inspectPackSource(zipPath)
  const extractedRoot = inspection.rootPath
  const imported = service.importPack(inspection.selectionId)

  assert.equal(inspection.valid, true)
  assert.equal(inspection.folderName, path.basename(zipPath))
  assert.equal(inspection.pack.id, 'zip-codex-cat')
  assert.equal(inspection.pack.source, 'codex-pet')
  assert.equal(inspection.pack.sourcePackageHash, sha256(zipPath))
  assert.equal(imported.pack.id, 'zip-codex-cat')
  assert.equal(settingsService.get().petPacks.installed['zip-codex-cat'].sourcePackageHash, sha256(zipPath))
  assert.equal(fs.existsSync(path.join(userPacksDir, 'zip-codex-cat', 'pet.json')), true)
  assert.equal(fs.existsSync(extractedRoot), false)
})

test('pet pack service clears extracted zip selections', () => {
  const sourceDir = createTempDir('codex-pet-zip-clear-source')
  createCodexPetDirectory(sourceDir, { id: 'clear-codex-cat' })
  const zipPath = createZipFromDirectory(sourceDir)
  const service = createService()

  const inspection = service.inspectPackSource(zipPath)
  const extractedRoot = inspection.rootPath
  const result = service.clearPendingSelection(inspection.selectionId)

  assert.equal(result.ok, true)
  assert.equal(fs.existsSync(extractedRoot), false)
})

test('pet pack service removes expired extracted zip selections', () => {
  const sourceDir = createTempDir('codex-pet-zip-expire-source')
  createCodexPetDirectory(sourceDir, { id: 'expire-codex-cat' })
  const zipPath = createZipFromDirectory(sourceDir)
  const settingsService = createSettingsService()
  let nowMs = 0
  const service = createPetPackService({
    settingsService,
    userPacksDir: createTempDir('pet-packs'),
    projectRoot: '/app/openpet',
    loadLegacyAnimations: () => ({ defaultAction: 'idle', clickAction: 'idle', actions: [] }),
    now: () => new Date('2026-06-12T00:00:00.000Z'),
    nowMs: () => nowMs
  })

  const inspection = service.inspectPackSource(zipPath)
  const extractedRoot = inspection.rootPath
  nowMs += 11 * 60 * 1000

  assert.throws(() => service.importPack(inspection.selectionId), /expired/)
  assert.equal(fs.existsSync(extractedRoot), false)
})

test('pet pack service rejects unsafe pet pack zip entries before extraction', () => {
  const zipPath = createUnsafeZip()
  const service = createService()

  const inspection = service.inspectPackSource(zipPath)

  assert.equal(inspection.valid, false)
  assert.match(inspection.errors[0], /unsafe paths/)
})

test('pet pack service rejects zip packages with multiple pet roots', () => {
  const sourceRoot = createTempDir('codex-pet-zip-multiple')
  fs.mkdirSync(path.join(sourceRoot, 'one'))
  fs.mkdirSync(path.join(sourceRoot, 'two'))
  createCodexPetDirectory(path.join(sourceRoot, 'one'), { id: 'one-cat' })
  createCodexPetDirectory(path.join(sourceRoot, 'two'), { id: 'two-cat' })
  const zipPath = createZipFromDirectory(sourceRoot)
  const service = createService()

  const inspection = service.inspectPackSource(zipPath)

  assert.equal(inspection.valid, false)
  assert.match(inspection.errors[0], /exactly one pet.json root/)
})

test('pet pack service blocks zip packages denied by source package hash', () => {
  const sourceDir = createTempDir('codex-pet-zip-blocked-source')
  createCodexPetDirectory(sourceDir, { id: 'hash-blocked-codex-cat' })
  const zipPath = createZipFromDirectory(sourceDir)
  const blockedHash = sha256(zipPath)
  const service = createPetPackService({
    settingsService: createSettingsService(),
    userPacksDir: createTempDir('pet-packs'),
    projectRoot: '/app/openpet',
    loadLegacyAnimations: () => ({ defaultAction: 'idle', clickAction: 'idle', actions: [] }),
    getPetPackBlockStatus: ({ sourceSha256 }) => sourceSha256 === blockedHash
      ? { blocked: true, reasons: [`sha256:${blockedHash}`] }
      : { blocked: false, reasons: [] }
  })

  const inspection = service.inspectPackSource(zipPath)

  assert.equal(inspection.valid, false)
  assert.match(inspection.errors[0], /blocked/)
})

test('action service loads the active installed pet pack and uses its root for previews', () => {
  const sourceDir = createTempDir('pet-pack-action-source')
  createPetPackDirectory(sourceDir, { id: 'active-cat', displayName: 'Active Cat' })
  const settingsService = createSettingsService()
  const petPackService = createService(settingsService)
  const actionService = createActionService({ petPackService })

  const inspection = petPackService.inspectPackDirectory(sourceDir)
  petPackService.importPack(inspection.selectionId)
  petPackService.setActivePack('active-cat')
  actionService.reload()

  assert.equal(actionService.getPetPack().manifest.id, 'active-cat')
  assert.deepEqual(actionService.getConfig().actions.map((action) => action.id), ['idle', 'wave'])
  assert.match(actionService.getPreviewConfig().actions[0].previewSprite, /file:\/\/.*active-cat\/sprites\/idle\.png$/)
})

test('pet pack service rejects invalid packs before import', () => {
  const sourceDir = createTempDir('pet-pack-invalid')
  fs.mkdirSync(path.join(sourceDir, 'sprites'), { recursive: true })
  fs.writeFileSync(path.join(sourceDir, 'pet.json'), JSON.stringify({
    id: 'broken-cat',
    defaultAction: 'idle',
    actions: [
      { id: 'idle', sprite: 'sprites/missing.png', frameCount: 1, frameMs: 100, frameWidth: 32, frameHeight: 32 }
    ]
  }))
  const service = createService()

  const inspection = service.inspectPackDirectory(sourceDir)

  assert.equal(inspection.valid, false)
  assert.match(inspection.errors[0], /sprite does not exist/)
})

test('pet pack service rejects source folders containing symlinks', () => {
  const sourceDir = createTempDir('pet-pack-symlink')
  createPetPackDirectory(sourceDir, { id: 'symlink-cat' })
  const targetPath = path.join(sourceDir, 'sprites', 'idle.png')
  const linkPath = path.join(sourceDir, 'sprites', 'idle-link.png')
  fs.symlinkSync(targetPath, linkPath)
  const service = createService()

  const inspection = service.inspectPackDirectory(sourceDir)

  assert.equal(inspection.valid, false)
  assert.match(inspection.errors[0], /symlinks/)
})

test('pet pack service rejects a source folder that is itself a symlink', () => {
  const sourceDir = createTempDir('pet-pack-root-target')
  createPetPackDirectory(sourceDir, { id: 'root-symlink-cat' })
  const linkParent = createTempDir('pet-pack-root-link')
  const linkDir = path.join(linkParent, 'pack-link')
  fs.symlinkSync(sourceDir, linkDir, 'dir')
  const service = createService()

  const inspection = service.inspectPackDirectory(linkDir)

  assert.equal(inspection.valid, false)
  assert.match(inspection.errors[0], /symlinks/)
})

test('pet pack service protects built-in and active packs from removal', () => {
  const sourceDir = createTempDir('pet-pack-remove')
  createPetPackDirectory(sourceDir, { id: 'remove-cat' })
  const service = createService()

  const inspection = service.inspectPackDirectory(sourceDir)
  service.importPack(inspection.selectionId)

  assert.throws(() => service.removePack(BUILT_IN_PACK_ID), /built-in/)
  service.setActivePack('remove-cat')
  assert.throws(() => service.removePack('remove-cat'), /active/)
})

test('pet pack service blocks importing and activating packs denied by ecosystem policy', () => {
  const sourceDir = createTempDir('pet-pack-blocked')
  createPetPackDirectory(sourceDir, { id: 'blocked-cat' })
  const settingsService = createSettingsService({
    petPacks: {
      activePackId: BUILT_IN_PACK_ID,
      installed: {
        'blocked-cat': { id: 'blocked-cat', displayName: 'Blocked Cat', version: '1.0.0' }
      }
    }
  })
  const service = createPetPackService({
    settingsService,
    userPacksDir: createTempDir('pet-packs'),
    projectRoot: '/app/openpet',
    loadLegacyAnimations: () => ({ defaultAction: 'idle', clickAction: 'idle', actions: [{ id: 'idle', sprite: 'cat_anime/sprites/idle.png', frameCount: 1, frameMs: 100, frameWidth: 1, frameHeight: 1 }] }),
    getPetPackBlockStatus: ({ id }) => id === 'blocked-cat'
      ? { blocked: true, reasons: ['packId:blocked-cat'] }
      : { blocked: false, reasons: [] }
  })

  const inspection = service.inspectPackDirectory(sourceDir)

  assert.equal(inspection.valid, false)
  assert.match(inspection.errors[0], /blocked/)
  assert.throws(() => service.setActivePack('blocked-cat'), /blocked/)
})

test('pet pack service removes non-active installed packs', () => {
  const sourceDir = createTempDir('pet-pack-removable')
  createPetPackDirectory(sourceDir, { id: 'removable-cat' })
  const settingsService = createSettingsService()
  const service = createService(settingsService)

  const inspection = service.inspectPackDirectory(sourceDir)
  service.importPack(inspection.selectionId)
  const result = service.removePack('removable-cat')

  assert.equal(result.petPacks.installed['removable-cat'], undefined)
  assert.equal(settingsService.get().petPacks.installed['removable-cat'], undefined)
})
