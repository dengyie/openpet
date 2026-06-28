const test = require('node:test')
const assert = require('node:assert/strict')

const { IPC } = require('../../src/shared/ipc-channels')
const { registerPetRuntimeIpc } = require('../../src/main/ipc/register-pet-runtime-ipc')
const { registerSettingsIpc } = require('../../src/main/ipc/register-settings-ipc')
const { registerSystemIpc } = require('../../src/main/ipc/register-system-ipc')

const createIpcMainStub = () => {
  const handlers = new Map()
  const listeners = new Map()
  return {
    handlers,
    listeners,
    handle(channel, handler) {
      handlers.set(channel, handler)
    },
    on(channel, handler) {
      listeners.set(channel, handler)
    }
  }
}

test('registerSystemIpc wires quit and settings-open channels', () => {
  const ipcMain = createIpcMainStub()
  const quitSources = []
  const openedWith = []
  const petWindow = { id: 'pet-window' }

  registerSystemIpc({
    ipcMainService: ipcMain,
    getPetWindow: () => petWindow,
    createSettingsWindow: (window) => openedWith.push(window),
    requestAppQuit: (source) => quitSources.push(source)
  })

  ipcMain.listeners.get(IPC.PET_QUIT)()
  ipcMain.listeners.get(IPC.SETTINGS_OPEN)()

  assert.deepEqual(quitSources, ['pet-renderer'])
  assert.deepEqual(openedWith, [petWindow])
})

test('registerSettingsIpc wires settings preview and close flows', () => {
  const ipcMain = createIpcMainStub()
  const previewCalls = []
  const sentMessages = []
  const settingsWindow = {
    closeCalled: 0,
    close() {
      this.closeCalled += 1
    }
  }
  const petWindow = {
    settingsWindow
  }

  registerSettingsIpc({
    ipcMainService: ipcMain,
    petService: {
      previewSettings: (payload) => previewCalls.push(payload),
      getSettings: () => ({ customCursors: [], localHttp: {}, petBehavior: {} }),
      saveSettings: (settings) => settings
    },
    getPetWindow: () => petWindow,
    browserWindowService: {
      fromWebContents: () => settingsWindow
    },
    sendToPetWindow: (_getWindow, channel, payload) => sentMessages.push({ channel, payload }),
    createPetRendererSettings: (settings) => settings,
    collectCustomCursorAssetPaths: () => [],
    mergePetSettingsViewIntoHostSettings: (current, patch) => ({ ...current, ...patch }),
    recordAppLog: () => {}
  })

  ipcMain.listeners.get(IPC.SETTINGS_PREVIEW_SCALE)(null, 1.25)
  ipcMain.listeners.get(IPC.SETTINGS_CLOSE)({ sender: { id: 'settings-web-contents' } })

  assert.deepEqual(previewCalls, [{ scale: 1.25 }])
  assert.deepEqual(sentMessages, [{ channel: IPC.SETTINGS_CHANGED, payload: { scale: 1.25 } }])
  assert.equal(settingsWindow.closeCalled, 1)
  assert.equal(petWindow.settingsWindow, null)
})

test('registerPetRuntimeIpc wires pet movement and focus handlers', () => {
  const ipcMain = createIpcMainStub()
  const syncCalls = []
  const appFocusCalls = []
  const win = {
    position: [10, 20],
    getPosition() {
      return this.position
    },
    getBounds() {
      return { x: this.position[0], y: this.position[1], width: 120, height: 80 }
    },
    setPosition(x, y) {
      this.position = [x, y]
    },
    focusCalled: 0,
    focus() {
      this.focusCalled += 1
    },
    moveTopCalled: 0,
    moveTop() {
      this.moveTopCalled += 1
    },
    isFocused: () => false,
    isMinimized: () => false,
    isDestroyed: () => false,
    webContents: {}
  }

  registerPetRuntimeIpc({
    ipcMainService: ipcMain,
    petService: {
      getAnimations: () => ({ actions: [] }),
      getSettings: () => ({ petBehavior: {}, menuPosition: 'auto' })
    },
    getPetWindow: () => win,
    browserWindowService: {
      fromWebContents: () => win
    },
    appService: {
      focus: (payload) => appFocusCalls.push(payload)
    },
    applyPetViewport: () => {},
    clampToWorkArea: (_target, x, y) => ({ x, y }),
    getMovementState: () => ({ mode: 'idle' }),
    petMovementPolicy: null,
    petBubbleChatWindowService: {
      syncToPetWindow: () => syncCalls.push('sync')
    },
    screenService: {
      getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 800, height: 600 } })
    },
    createSettingsWindow: () => {},
    choosePetContextMenuPoint: () => ({ placement: 'bottom', screenPoint: { x: 0, y: 0 }, windowPoint: { x: 0, y: 0 } }),
    estimatePetContextMenuSize: () => ({ width: 100, height: 100 }),
    showContextMenuWindow: () => {},
    sendToPetWindow: () => {},
    createPetRendererSettings: (settings) => settings,
    recordAppLog: () => {},
    requestAppQuit: () => {}
  })

  const moveResult = ipcMain.handlers.get(IPC.PET_MOVE_BY)({ sender: win.webContents }, { x: 5, y: 7 })
  ipcMain.listeners.get(IPC.PET_REQUEST_FOCUS_FOR_CURSOR)({ sender: win.webContents })

  assert.deepEqual(moveResult, { x: 15, y: 27 })
  assert.deepEqual(win.position, [15, 27])
  assert.deepEqual(syncCalls, ['sync'])
  assert.deepEqual(appFocusCalls, [{ steal: true }])
  assert.equal(win.moveTopCalled, 1)
  assert.equal(win.focusCalled, 1)
})
