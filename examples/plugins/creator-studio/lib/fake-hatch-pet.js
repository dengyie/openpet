const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')
const { getRunDir, readRun, writeRun } = require('./run-store')

const DEFAULT_ATLAS_WIDTH = 1536
const DEFAULT_ATLAS_HEIGHT = 1872
const VISIBLE_ATLAS_WEBP_BASE64 = 'UklGRrIAAABXRUJQVlA4TKUAAAAv/8XTEQ8wUPM/UPMf8FDUtg1U/qT3G4HLEf2fgPA///M///M///M///M///M///M///M///M///M///M///M///M///M///M///M///M///M///M///M///M//4/gavIf//Hf44//+Z//+Z//+Z//+Z//+Z//+Z//+Z//+Z//+Z//+Z//+Z//+Z//+Z//+Z//+Z//+Z//+Z//+Z//+Z//+Z//ORMA'

const createMinimalWebp = ({ width = DEFAULT_ATLAS_WIDTH, height = DEFAULT_ATLAS_HEIGHT } = {}) => {
  if (width !== DEFAULT_ATLAS_WIDTH || height !== DEFAULT_ATLAS_HEIGHT) {
    throw new Error(`Fixture atlas must be ${DEFAULT_ATLAS_WIDTH}x${DEFAULT_ATLAS_HEIGHT}`)
  }
  return Buffer.from(VISIBLE_ATLAS_WEBP_BASE64, 'base64')
}

const sha256 = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')

const writeZip = (sourceDir, outputPath) => {
  fs.rmSync(outputPath, { force: true })
  execFileSync('zip', ['-qr', outputPath, '.'], { cwd: sourceDir })
}

const createCreatorStudioMetadata = (run) => {
  if (!run.generationTask) return null
  const importPolicy = {
    importsFrames: true,
    appliesTriggerAutomatically: false,
    triggerProposalOwner: 'openpet-host'
  }
  return {
    mode: run.generationTask.mode,
    targetPet: run.generationTask.targetPet,
    styleSource: run.generationTask.styleSource,
    generationTask: run.generationTask,
    actions: (run.generationTask.actions || []).map((action) => ({
      actionId: action.actionId,
      name: action.name,
      loop: Boolean(action.loop),
      frameCount: action.frameCount,
      triggerProposal: action.triggerProposal
    })),
    importPolicy
  }
}

const generateFixturePetOutput = async ({ dataDir, runId, now = () => new Date().toISOString() }) => {
  const run = readRun({ dataDir, runId })
  const runDir = getRunDir({ dataDir, runId })
  const outputDir = path.join(runDir, 'outputs')
  const creatorStudio = createCreatorStudioMetadata(run)
  fs.mkdirSync(outputDir, { recursive: true })
  const spritesheetPath = path.join(outputDir, 'spritesheet.webp')
  fs.writeFileSync(spritesheetPath, createMinimalWebp())
  fs.writeFileSync(path.join(outputDir, 'pet.json'), `${JSON.stringify({
    id: run.petId,
    displayName: run.input.petName,
    description: run.input.prompt || `A generated OpenPet pet named ${run.input.petName}.`,
    spritesheetPath: 'spritesheet.webp',
    ...(creatorStudio ? { creatorStudio } : {})
  }, null, 2)}\n`)
  const qaDir = path.join(runDir, 'qa')
  fs.mkdirSync(qaDir, { recursive: true })
  fs.writeFileSync(path.join(qaDir, 'atlas-validation.json'), `${JSON.stringify({
    ok: true,
    width: DEFAULT_ATLAS_WIDTH,
    height: DEFAULT_ATLAS_HEIGHT,
    visiblePixels: 6400,
    warnings: []
  }, null, 2)}\n`)
  if (creatorStudio) {
    fs.writeFileSync(path.join(qaDir, 'action-generation-task.json'), `${JSON.stringify({
      ok: true,
      originalPrompt: run.input.originalPrompt || run.input.prompt || '',
      mode: creatorStudio.mode,
      targetPet: creatorStudio.targetPet,
      styleSource: creatorStudio.styleSource,
      actions: creatorStudio.actions,
      importPolicy: creatorStudio.importPolicy
    }, null, 2)}\n`)
  }
  const bundlePath = path.join(outputDir, `${run.petId}.codex-pet.zip`)
  writeZip(outputDir, bundlePath)
  const nextRun = {
    ...run,
    status: 'ready_for_review',
    currentStep: 'review',
    updatedAt: now(),
    artifacts: {
      ...run.artifacts,
      outputDir,
      petJson: path.join(outputDir, 'pet.json'),
      spritesheet: spritesheetPath,
      bundle: bundlePath,
      qa: path.join(qaDir, 'atlas-validation.json'),
      ...(creatorStudio ? { actionTaskQa: path.join(qaDir, 'action-generation-task.json') } : {})
    },
    reviewStatus: 'pending',
    error: ''
  }
  writeRun({ dataDir, run: nextRun })
  return {
    outputDir,
    bundlePath,
    sha256: sha256(bundlePath),
    run: nextRun
  }
}

module.exports = {
  createCreatorStudioMetadata,
  createMinimalWebp,
  generateFixturePetOutput,
  sha256,
  writeZip
}
