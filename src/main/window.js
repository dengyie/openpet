/**
 * 窗口管理模块 —— 宠物窗口和设置窗口的创建与缩放。
 */
const path = require('path')
const electron = require('electron')

const projectRoot = path.join(__dirname, '..', '..')
const BASE_WIDTH = 300
const BASE_HEIGHT = 300
const CONTROL_CENTER_WIDTH = 900
const CONTROL_CENTER_HEIGHT = 640

const applyWindowScale = (petWindow, scale) => {
  if (!petWindow || petWindow.isDestroyed()) return
  const normalizedScale = Number.isFinite(scale) && scale > 0 ? scale : 1
  const targetWidth = Math.max(1, Math.round(BASE_WIDTH * normalizedScale))
  const targetHeight = Math.max(1, Math.round(BASE_HEIGHT * normalizedScale))
  const bounds = typeof petWindow.getContentBounds === 'function'
    ? petWindow.getContentBounds()
    : petWindow.getBounds()
  if (targetWidth === bounds.width && targetHeight === bounds.height) return
  const [x, y] = petWindow.getPosition()
  const deltaW = targetWidth - bounds.width
  const deltaH = targetHeight - bounds.height
  const nextBounds = {
    x: x - Math.round(deltaW / 2),
    y: y - deltaH,
    width: targetWidth,
    height: targetHeight
  }
  if (typeof petWindow.setContentBounds === 'function') {
    petWindow.setContentBounds(nextBounds)
  } else {
    petWindow.setBounds(nextBounds)
  }
}

const loadPetWindow = (petWindow) => petWindow.loadFile(path.join(projectRoot, 'index.html'))

const createWindow = ({ load = true, BrowserWindow = electron.BrowserWindow, screen = electron.screen } = {}) => {
  const petWindow = new BrowserWindow({
    width: BASE_WIDTH,
    height: BASE_HEIGHT,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(projectRoot, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const { workArea } = screen.getPrimaryDisplay()
  petWindow.setPosition(
    workArea.x + workArea.width - BASE_WIDTH - 40,
    workArea.y + workArea.height - BASE_HEIGHT - 40
  )
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  if (load) loadPetWindow(petWindow)

  return petWindow
}

const createSettingsWindow = (petWindow, { BrowserWindow = electron.BrowserWindow, screen = electron.screen } = {}) => {
  if (petWindow.settingsWindow && !petWindow.settingsWindow.isDestroyed()) {
    petWindow.settingsWindow.focus()
    return
  }

  const settingsWindow = new BrowserWindow({
    width: CONTROL_CENTER_WIDTH,
    height: CONTROL_CENTER_HEIGHT,
    minWidth: 760,
    minHeight: 560,
    resizable: true,
    frame: true,
    transparent: false,
    alwaysOnTop: true,
    backgroundColor: '#f5f5f5',
    hasShadow: true,
    title: 'OpenPet Control Center',
    webPreferences: {
      preload: path.join(projectRoot, 'control-center-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const petBounds = petWindow.getBounds()
  const [petX, petY] = petWindow.getPosition()
  const display = screen.getDisplayMatching(petBounds)
  const { workArea } = display
  let settingsX = petX + petBounds.width + 12
  if (settingsX + CONTROL_CENTER_WIDTH > workArea.x + workArea.width) {
    settingsX = petX - CONTROL_CENTER_WIDTH - 12
  }
  const maxSettingsX = Math.max(workArea.x, workArea.x + workArea.width - CONTROL_CENTER_WIDTH)
  settingsX = Math.min(Math.max(settingsX, workArea.x), maxSettingsX)
  const maxSettingsY = Math.max(workArea.y, workArea.y + workArea.height - CONTROL_CENTER_HEIGHT)
  const settingsY = Math.min(
    Math.max(petY, workArea.y),
    maxSettingsY
  )
  settingsWindow.setPosition(Math.round(settingsX), Math.round(settingsY))
  settingsWindow.loadFile(path.join(projectRoot, 'dist', 'control-center', 'index.html')).catch((error) => {
    settingsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><title>OpenPet Control Center</title><body style="font-family: system-ui; padding: 24px;"><h1>Control Center build missing</h1><p>${error.message}</p></body>`)}`)
  })
  settingsWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  petWindow.settingsWindow = settingsWindow
}

module.exports = { BASE_WIDTH, BASE_HEIGHT, applyWindowScale, createWindow, createSettingsWindow, loadPetWindow }
