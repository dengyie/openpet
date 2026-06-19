const test = require('node:test')
const assert = require('node:assert/strict')

const { shouldRestoreScalePreview } = require('../../src/control-center/src/lib/pet-scale-preview')

test('does not restore scale preview when the user never changed the preview scale', () => {
  assert.equal(shouldRestoreScalePreview({ currentScale: 1, originalScale: 1 }), false)
})

test('restores scale preview when the current preview differs from the saved scale', () => {
  assert.equal(shouldRestoreScalePreview({ currentScale: 0.75, originalScale: 1 }), true)
})
