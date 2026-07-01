const SETTINGS_CHANGED = 'settings:changed'
const SETTINGS_PREVIEW = 'settings:preview'

const createSettingsService = ({ eventBus, loadSettings, saveSettings, syncSideEffects }) => {
  let currentSettings = loadSettings()

  const get = () => ({ ...currentSettings })

  const save = (settings) => {
    currentSettings = { ...settings }
    saveSettings(currentSettings)
    syncSideEffects?.(currentSettings)
    eventBus?.emit(SETTINGS_CHANGED, get())
    return get()
  }

  // Atomic read-modify-write: the updater receives the current settings
  // snapshot at save-time (not at a prior get() call), eliminating the
  // stale-snapshot race when concurrent async callers write different fields.
  const update = (updater) => {
    const nextSettings = updater({ ...currentSettings })
    return save(nextSettings)
  }

  const preview = (partialSettings) => {
    const nextSettings = { ...currentSettings, ...partialSettings }
    eventBus?.emit(SETTINGS_PREVIEW, { ...nextSettings })
    return nextSettings
  }

  const reload = () => {
    currentSettings = loadSettings()
    return get()
  }

  return { get, save, update, preview, reload }
}

module.exports = { SETTINGS_CHANGED, SETTINGS_PREVIEW, createSettingsService }
