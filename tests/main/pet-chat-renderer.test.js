const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const rendererSource = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'main', 'pet-chat', 'renderer.js'), 'utf-8')

const createClassList = () => ({
  values: new Set(),
  toggle(value, force) {
    if (force === undefined) {
      if (this.values.has(value)) this.values.delete(value)
      else this.values.add(value)
      return this.values.has(value)
    }
    if (force) this.values.add(value)
    else this.values.delete(value)
    return force
  },
  contains(value) {
    return this.values.has(value)
  }
})

const createElement = (id = '') => ({
  id,
  hidden: false,
  disabled: false,
  textContent: '',
  value: '',
  innerHTML: '',
  scrollTop: 0,
  scrollHeight: 0,
  classList: createClassList(),
  listeners: {},
  attributes: {},
  focusCalled: 0,
  setAttribute(name, value) {
    this.attributes[name] = String(value)
  },
  addEventListener(eventName, callback) {
    this.listeners[eventName] ||= []
    this.listeners[eventName].push(callback)
  },
  focus() {
    this.focusCalled += 1
  }
})

const dispatch = async (target, eventName, event = {}) => {
  for (const listener of target.listeners?.[eventName] || []) {
    await listener(event)
  }
}

const dispatchDocument = async (documentListeners, eventName, event = {}) => {
  for (const listener of documentListeners[eventName] || []) {
    await listener(event)
  }
}

const createHarness = async () => {
  const apiCalls = {
    hide: [],
    openBubbleChat: [],
    openSettings: [],
    sendMessage: [],
    setAlwaysOnTop: []
  }
  let failOpenBubbleChat = false
  let latestState = {
    alwaysOnTop: true,
    ai: { ready: true, model: 'gpt-5.5' },
    petPack: { id: 'legacy-cat', displayName: 'Legacy Cat' },
    bubble: { text: '你好', source: 'ai', ttlMs: 6000, updatedAt: '2026-06-27T00:00:00.000Z' },
    messages: [{ role: 'assistant', content: '喵，我在。' }]
  }
  const documentListeners = {}
  const windowListeners = {}
  const stateListeners = []
  const elements = {
    'window-status': createElement('window-status'),
    'bubble-chat-button': createElement('bubble-chat-button'),
    'topmost-button': createElement('topmost-button'),
    'settings-button': createElement('settings-button'),
    'close-button': createElement('close-button'),
    'bubble-strip': createElement('bubble-strip'),
    'bubble-text': createElement('bubble-text'),
    messages: createElement('messages'),
    'chat-input': createElement('chat-input'),
    'send-button': createElement('send-button')
  }

  const context = {
    console,
    window: {
      addEventListener(eventName, callback) {
        windowListeners[eventName] ||= []
        windowListeners[eventName].push(callback)
      },
      petChatAPI: {
        getState: async () => latestState,
        hide: () => {
          apiCalls.hide.push(true)
        },
        setAlwaysOnTop: async (alwaysOnTop) => {
          apiCalls.setAlwaysOnTop.push(alwaysOnTop)
          latestState = { ...latestState, alwaysOnTop }
          return latestState
        },
        openBubbleChat: async () => {
          if (failOpenBubbleChat) throw new Error('bubble failed')
          apiCalls.openBubbleChat.push(true)
          return { visible: true }
        },
        openSettings: () => {
          apiCalls.openSettings.push(true)
        },
        sendMessage: async ({ message }) => {
          apiCalls.sendMessage.push(message)
          latestState = {
            ...latestState,
            messages: [
              ...(latestState.messages || []),
              { role: 'user', content: message },
              { role: 'assistant', content: '收到' }
            ]
          }
          return { state: latestState }
        },
        onStateChanged: (callback) => {
          stateListeners.push(callback)
        }
      }
    },
    document: {
      getElementById: (id) => elements[id],
      addEventListener(eventName, callback) {
        documentListeners[eventName] ||= []
        documentListeners[eventName].push(callback)
      }
    }
  }
  context.window.document = context.document
  context.globalThis = context
  vm.runInNewContext(rendererSource, context, { filename: 'pet-chat-renderer.js' })
  await Promise.resolve()
  await Promise.resolve()
  return {
    apiCalls,
    elements,
    documentListeners,
    windowListeners,
    stateListeners,
    setOpenBubbleChatFailure(value) {
      failOpenBubbleChat = Boolean(value)
    }
  }
}

test('pet chat renderer can hand off back to bubble chat and hide the full window', async () => {
  const harness = await createHarness()
  const { apiCalls, elements } = harness

  await dispatch(elements['bubble-chat-button'], 'click')

  assert.deepEqual(apiCalls.openBubbleChat, [true])
  assert.deepEqual(apiCalls.hide, [true])
})

test('pet chat renderer keeps the full window open when bubble chat handoff fails', async () => {
  const harness = await createHarness()
  const { apiCalls, elements, setOpenBubbleChatFailure } = harness
  setOpenBubbleChatFailure(true)

  await dispatch(elements['bubble-chat-button'], 'click')

  assert.deepEqual(apiCalls.openBubbleChat, [])
  assert.deepEqual(apiCalls.hide, [])
})

test('pet chat renderer still supports composer send flow after bubble handoff additions', async () => {
  const harness = await createHarness()
  const { apiCalls, elements } = harness
  const input = elements['chat-input']

  input.value = '你好呀'
  await dispatch(input, 'input')
  await dispatch(input, 'keydown', {
    key: 'Enter',
    shiftKey: false,
    preventDefault() {}
  })
  await Promise.resolve()
  await Promise.resolve()

  assert.deepEqual(apiCalls.sendMessage, ['你好呀'])
  assert.equal(input.value, '')
  assert.equal(elements.messages.innerHTML.includes('收到'), true)
})

test('pet chat renderer Escape still hides the full window', async () => {
  const harness = await createHarness()
  const { apiCalls, documentListeners } = harness

  await dispatchDocument(documentListeners, 'keydown', { key: 'Escape' })

  assert.deepEqual(apiCalls.hide, [true])
})
