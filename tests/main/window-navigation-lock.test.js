const test = require('node:test')
const assert = require('node:assert/strict')

const { applyNavigationLock } = require('../../src/main/window')

// Minimal stand-in for a BrowserWindow's webContents. applyNavigationLock
// registers handlers we can then invoke with crafted URLs to assert which
// navigations are blocked vs allowed.
const createMockWebContents = () => {
  const handlers = {}
  return {
    on: (event, handler) => { handlers[event] = handler },
    setWindowOpenHandler: (handler) => { handlers.windowOpen = handler },
    emit: (event, ...args) => handlers[event]?.(...args),
    callOpen: () => handlers.windowOpen?.({ url: '' }),
    hasHandler: (event) => Boolean(handlers[event])
  }
}

test('navigation lock blocks remote navigations but allows bundled file content', () => {
  const wc = createMockWebContents()
  applyNavigationLock({ webContents: wc })

  const blocked = []
  const remoteUrls = [
    'http://evil.example.com/',
    'https://evil.example.com/x',
    'javascript:alert(1)'
  ]
  for (const url of remoteUrls) {
    const event = { preventDefault: () => blocked.push(url) }
    wc.emit('will-navigate', event, url)
  }
  assert.deepEqual(blocked, remoteUrls)

  const allowed = []
  const event = { preventDefault: () => allowed.push('blocked') }
  wc.emit('will-navigate', event, 'file:///app/dist/control-center/index.html')
  assert.deepEqual(allowed, [])
})

test('navigation lock denies all window.open and webview attachment', () => {
  const wc = createMockWebContents()
  applyNavigationLock({ webContents: wc })

  assert.deepEqual(wc.callOpen(), { action: 'deny' })

  const prevented = []
  wc.emit('will-attach-webview', { preventDefault: () => prevented.push('webview') })
  assert.deepEqual(prevented, ['webview'])
})
