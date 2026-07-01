const test = require('node:test')
const assert = require('node:assert/strict')

const { createEventBus } = require('../../src/main/services/event-bus')
const { createSettingsService } = require('../../src/main/services/settings-service')

test('settings service saves settings and emits the persisted value', () => {
  const bus = createEventBus()
  const saved = []
  const events = []
  const sideEffects = []
  const service = createSettingsService({
    eventBus: bus,
    loadSettings: () => ({ scale: 1, walkSpeed: 2 }),
    saveSettings: (settings) => saved.push(settings),
    syncSideEffects: (settings) => sideEffects.push(settings)
  })

  bus.on('settings:changed', (settings) => events.push(settings))

  const next = service.save({ scale: 1.25, walkSpeed: 3 })

  assert.deepEqual(next, { scale: 1.25, walkSpeed: 3 })
  assert.deepEqual(saved, [{ scale: 1.25, walkSpeed: 3 }])
  assert.deepEqual(sideEffects, [{ scale: 1.25, walkSpeed: 3 }])
  assert.deepEqual(events, [{ scale: 1.25, walkSpeed: 3 }])
})

test('settings service previews partial settings without persisting', () => {
  const bus = createEventBus()
  const saved = []
  const previews = []
  const service = createSettingsService({
    eventBus: bus,
    loadSettings: () => ({ scale: 1, walkSpeed: 2 }),
    saveSettings: (settings) => saved.push(settings)
  })

  bus.on('settings:preview', (settings) => previews.push(settings))

  const next = service.preview({ scale: 1.5 })

  assert.deepEqual(next, { scale: 1.5, walkSpeed: 2 })
  assert.deepEqual(saved, [])
  assert.deepEqual(previews, [{ scale: 1.5, walkSpeed: 2 }])
})

test('settings service update applies an atomic read-modify-write', () => {
  const bus = createEventBus()
  const service = createSettingsService({
    eventBus: bus,
    loadSettings: () => ({ ai: { conversations: [], behavior: { enabled: false } } }),
    saveSettings: (settings) => settings
  })

  // Simulate two concurrent writers touching different fields: update reads
  // the freshest settings at write-time, so neither field clobbers the other.
  service.update((settings) => ({
    ...settings,
    ai: { ...settings.ai, conversations: ['c1'] }
  }))
  const result = service.update((settings) => ({
    ...settings,
    ai: { ...settings.ai, behavior: { ...settings.ai.behavior, enabled: true } }
  }))

  assert.deepEqual(result.ai, { conversations: ['c1'], behavior: { enabled: true } })
})

