const toFiniteScale = (value, fallback = 1) => (
  Number.isFinite(Number(value)) ? Number(value) : fallback
)

const shouldRestoreScalePreview = ({ currentScale, originalScale }) => {
  return toFiniteScale(currentScale) !== toFiniteScale(originalScale)
}

module.exports = { shouldRestoreScalePreview }
