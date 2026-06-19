const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const Module = require('module')

const projectRoot = path.join(__dirname, '..', '..')
const petIndexPath = path.join(projectRoot, 'index.html')
const windowModulePath = require.resolve('../../src/main/window')

const createScreenStub = () => ({
  getPrimaryDisplay: () => ({
    workArea: { x: 0, y: 0, width: 1440, height: 900 }
  })
})

const createBrowserWindowStub = (instances) => class BrowserWindowStub {
  constructor(options) {
    this.options = options
    this.loadedFiles = []
    this.visibleOnAllWorkspaces = null
    this.position = null
    instances.push(this)
  }

  setPosition(x, y) {
    this.position = { x, y }
  }

  setVisibleOnAllWorkspaces(value, options) {
    this.visibleOnAllWorkspaces = { value, options }
  }

  loadFile(filePath) {
    this.loadedFiles.push(filePath)
    return Promise.resolve()
  }
}

const loadWindowModule = (electronStub = {}) => {
  delete require.cache[windowModulePath]
  const originalLoad = Module._load
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'electron') return electronStub
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    return require(windowModulePath)
  } finally {
    Module._load = originalLoad
  }
}

test('createWindow can defer loading so callers register lifecycle handlers first', () => {
  const instances = []
  const { createWindow, loadPetWindow } = loadWindowModule()
  const petWindow = createWindow({
    load: false,
    BrowserWindow: createBrowserWindowStub(instances),
    screen: createScreenStub()
  })

  assert.equal(instances.length, 1)
  assert.equal(petWindow.loadedFiles.length, 0)
  loadPetWindow(petWindow)
  assert.deepEqual(petWindow.loadedFiles, [petIndexPath])
})

test('createWindow preserves automatic loading by default', () => {
  const instances = []
  const { createWindow } = loadWindowModule()
  const petWindow = createWindow({
    BrowserWindow: createBrowserWindowStub(instances),
    screen: createScreenStub()
  })

  assert.deepEqual(petWindow.loadedFiles, [petIndexPath])
  assert.equal(petWindow.options.transparent, true)
  assert.equal(petWindow.options.alwaysOnTop, true)
})

test('applyWindowScale shrinks the pet window proportionally for scales below 1', () => {
  const { BASE_HEIGHT, BASE_WIDTH, applyWindowScale } = loadWindowModule()
  const setContentBoundsCalls = []
  const setBoundsCalls = []
  const petWindow = {
    isDestroyed: () => false,
    getContentBounds: () => ({ x: 1000, y: 500, width: BASE_WIDTH, height: BASE_HEIGHT }),
    getBounds: () => ({ x: 1000, y: 500, width: BASE_WIDTH, height: BASE_HEIGHT }),
    getPosition: () => [1000, 500],
    setContentBounds: (bounds) => setContentBoundsCalls.push(bounds),
    setBounds: (bounds) => setBoundsCalls.push(bounds)
  }

  applyWindowScale(petWindow, 0.5)

  assert.deepEqual(setContentBoundsCalls, [{
    x: 1075,
    y: 650,
    width: 150,
    height: 150
  }])
  assert.deepEqual(setBoundsCalls, [])
})
