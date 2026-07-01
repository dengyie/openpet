const fs = require('fs')
const path = require('path')

const getDefaultStorePath = () => {
  const { app } = require('electron')
  return path.join(app.getPath('userData'), 'secrets.json')
}

// Lazily resolve Electron safeStorage. Production passes it via the factory
// option; when absent (tests, non-Electron) we fall back to plaintext so the
// service still works, just without at-rest encryption.
const resolveSafeStorage = (safeStorage) => {
  if (safeStorage && typeof safeStorage.encryptString === 'function' && typeof safeStorage.decryptString === 'function') {
    return safeStorage
  }
  try {
    const { safeStorage: electronSafeStorage } = require('electron')
    if (electronSafeStorage && typeof electronSafeStorage.encryptString === 'function') {
      return electronSafeStorage
    }
  } catch (_) {}
  return null
}

const isSafeStorageAvailable = (safeStorage) => Boolean(safeStorage?.isEncryptionAvailable?.())

const encryptValue = (safeStorage, value) => {
  if (!safeStorage || !isSafeStorageAvailable(safeStorage)) return { encrypted: false, value: String(value || '') }
  return { encrypted: true, value: safeStorage.encryptString(String(value || '')).toString('base64') }
}

const decryptEntry = (safeStorage, entry) => {
  if (!entry || typeof entry !== 'object') return ''
  if (entry.encrypted === true) {
    if (!safeStorage || !isSafeStorageAvailable(safeStorage)) return ''
    try {
      return safeStorage.decryptString(Buffer.from(entry.value, 'base64'))
    } catch (_) {
      return ''
    }
  }
  // Legacy plaintext entry — return as-is (and will be re-encrypted on next setSecret).
  return String(entry.value || '')
}

const readStore = (storePath, safeStorage) => {
  try {
    if (!fs.existsSync(storePath)) return { secrets: {} }
    const parsed = JSON.parse(fs.readFileSync(storePath, 'utf-8'))
    const rawSecrets = parsed.secrets || {}
    const secrets = {}
    for (const [id, entry] of Object.entries(rawSecrets)) {
      secrets[id] = {
        label: entry?.label || id,
        value: decryptEntry(safeStorage, entry),
        encrypted: entry?.encrypted === true,
        updatedAt: entry?.updatedAt || ''
      }
    }
    return { secrets }
  } catch (_) {
    return { secrets: {} }
  }
}

const writeStore = (storePath, store) => {
  fs.mkdirSync(path.dirname(storePath), { recursive: true })
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), { encoding: 'utf-8', mode: 0o600 })
  if (process.platform !== 'win32') fs.chmodSync(storePath, 0o600)
}

const createSecretService = ({ storePath = getDefaultStorePath(), safeStorage } = {}) => {
  const resolvedSafeStorage = resolveSafeStorage(safeStorage)
  let store = readStore(storePath, resolvedSafeStorage)

  const persist = () => writeStore(storePath, store)

  const setSecret = ({ id, value, label = id }) => {
    if (!id) throw new Error('Secret id is required')
    const encrypted = encryptValue(resolvedSafeStorage, value)
    store.secrets[id] = {
      label,
      encrypted: encrypted.encrypted,
      value: encrypted.value,
      updatedAt: new Date().toISOString()
    }
    persist()
    return { id, label, hasValue: Boolean(value) }
  }

  const getSecretValue = (id) => store.secrets[id]?.value || ''

  const deleteSecret = (id) => {
    delete store.secrets[id]
    persist()
  }

  const listSecretRefs = () => Object.entries(store.secrets)
    .map(([id, secret]) => ({
      id,
      label: secret.label || id,
      hasValue: Boolean(secret.value)
    }))

  return { setSecret, getSecretValue, deleteSecret, listSecretRefs }
}

module.exports = { createSecretService }
