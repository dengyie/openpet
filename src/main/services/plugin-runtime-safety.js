const sanitizePluginCommandText = (value = '') => {
  let sanitized = String(value || '')
  sanitized = sanitized.replace(/\bsk-[A-Za-z0-9_-]+\b/g, '[redacted-secret]')
  sanitized = sanitized.replace(/\b[A-Za-z0-9_-]*token[A-Za-z0-9_-]*\b/gi, '[redacted-token]')
  sanitized = sanitized.replace(/\[redacted-token\]\s*[:=]\s*[^\s,，。)]+/gi, '[redacted-token]=[redacted-secret]')
  sanitized = sanitized.replace(/https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/[^\s]*)?/gi, '[redacted-local-url]')
  sanitized = sanitized.replace(/\b(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/[^\s]*)?/gi, '[redacted-local-url]')
  sanitized = sanitized.replace(/\[::1\](?::\d+)?(?:\/[^\s]*)?/gi, '[redacted-local-url]')
  sanitized = sanitized.replace(/(?:\/Users|\/var|\/tmp|\/private|\/Volumes)\/[^\s,，。)]+/g, '[redacted-path]')
  sanitized = sanitized.replace(/[A-Za-z]:\\[^\s,，。)]+/g, '[redacted-path]')
  sanitized = sanitized.replace(/\[\[redacted-token\]\]/g, '[redacted-token]')
  return sanitized.trim()
}

const isPluginCommandOutputKey = (key = '') => /^(error|stderr|stdout)$/i.test(String(key || ''))

const isSensitivePluginResultKey = (key = '') => (
  /(?:api[_-]?key|authorization|credential|password|secret|token)/i.test(String(key || ''))
)

const sanitizePluginCommandResultValue = (value, key = '') => {
  if (typeof value === 'string') {
    if (isSensitivePluginResultKey(key)) return value ? '[redacted-secret]' : value
    const sanitized = sanitizePluginCommandText(value)
    return isPluginCommandOutputKey(key) || sanitized !== value.trim() ? sanitized : value
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizePluginCommandResultValue(entry, key))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [
    entryKey,
    sanitizePluginCommandResultValue(entryValue, entryKey)
  ]))
}

module.exports = {
  sanitizePluginCommandResultValue,
  sanitizePluginCommandText
}
