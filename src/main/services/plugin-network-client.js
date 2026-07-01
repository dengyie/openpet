const { hasOwn } = require('./plugin-json-utils')

const MAX_PLUGIN_NETWORK_REQUEST_BYTES = 64 * 1024
const MAX_PLUGIN_NETWORK_RESPONSE_BYTES = 128 * 1024

// Reject DNS-rebinding SSRF: even when a manifest allowlist host is a public
// domain, an attacker can point its A record at 127.0.0.1 / 169.254.169.254 /
// an internal RFC1918 address. After resolving, we require every resolved IP to
// fall outside private/loopback/link-local/multicast/reserved ranges.
const isPrivateAddress = (ip) => {
  if (typeof ip !== 'string' || !ip) return true
  // IPv6 — loopback, link-local, unique-local, unspecified, multicast.
  const bare = ip.replace(/^\[|]$/g, '')
  if (bare.includes(':')) {
    if (bare === '::1' || bare === '::') return true
    if (bare.toLowerCase().startsWith('fe80:')) return true
    if (bare.toLowerCase().startsWith('fc') || bare.toLowerCase().startsWith('fd')) return true
    if (bare.toLowerCase().startsWith('ff')) return true
    return false
  }
  // IPv4
  const parts = bare.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  if (a >= 224) return true // multicast (224-239) + reserved (240-255)
  return false
}

// Default resolver: dns.lookup over the real network. Callers (tests) can inject
// a stub so SSRF checks are exercised deterministically without real DNS.
const defaultResolveAddress = async (hostname) => {
  const dns = require('dns')
  try {
    const records = await dns.promises.lookup(hostname, { all: true })
    return records.map((record) => record.address)
  } catch (error) {
    throw new Error(`Plugin network host could not be resolved: ${hostname}`)
  }
}

// Known limit (TOCTOU window): we resolve the hostname and check the IPs here,
// but the actual fetch in plugin-service.js re-resolves via the system resolver.
// A rebinding DNS server can answer this check with a public IP and answer the
// fetch with a private IP moments later. Pinning the fetched IP is not possible
// with Node's fetch API (no connect-time IP override). This narrows but does not
// fully close DNS-rebinding SSRF; see docs/code-quality-remediation-plan.md Task 6.
const assertResolvedAddressesSafe = async (hostname, resolveAddress = defaultResolveAddress) => {
  const addresses = await resolveAddress(hostname)
  const resolved = Array.isArray(addresses) ? addresses : [addresses]
  for (const address of resolved) {
    if (isPrivateAddress(address)) {
      throw new Error(`Plugin network host resolves to a non-public address (${address}); DNS-rebinding SSRF blocked`)
    }
  }
}

const normalizeNetworkRequest = (manifest, { url, options = {} } = {}) => {
  const targetUrl = new URL(String(url || ''))
  if (targetUrl.protocol !== 'https:') throw new Error('Plugin network requests must use HTTPS')
  if (!manifest.network.allowlist.includes(targetUrl.host.toLowerCase())) {
    throw new Error(`Plugin ${manifest.id} cannot access network host: ${targetUrl.host}`)
  }
  const method = String(options.method || 'GET').toUpperCase()
  if (!['GET', 'POST'].includes(method)) throw new Error('Plugin network requests only support GET and POST')
  const headers = Object.entries(options.headers || {}).reduce((nextHeaders, [key, value]) => {
    const headerName = String(key).toLowerCase()
    if (!/^[a-z0-9-]+$/.test(headerName)) throw new Error(`Plugin network header is invalid: ${key}`)
    if (['authorization', 'cookie', 'set-cookie', 'proxy-authorization'].includes(headerName)) {
      throw new Error(`Plugin network header is not allowed: ${key}`)
    }
    nextHeaders[headerName] = String(value)
    return nextHeaders
  }, {})
  const request = { method, headers }
  if (hasOwn(options, 'body')) {
    request.body = String(options.body)
    if (Buffer.byteLength(request.body, 'utf-8') > MAX_PLUGIN_NETWORK_REQUEST_BYTES) {
      throw new Error(`Plugin network request body exceeds ${MAX_PLUGIN_NETWORK_REQUEST_BYTES} bytes`)
    }
  }
  return { url: targetUrl.toString(), request }
}

const readLimitedResponseText = async (response) => {
  const contentLength = Number(response.headers?.get?.('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_PLUGIN_NETWORK_RESPONSE_BYTES) {
    throw new Error(`Plugin network response exceeds ${MAX_PLUGIN_NETWORK_RESPONSE_BYTES} bytes`)
  }
  if (!response.body?.getReader) {
    const text = await response.text()
    if (Buffer.byteLength(text, 'utf-8') > MAX_PLUGIN_NETWORK_RESPONSE_BYTES) {
      throw new Error(`Plugin network response exceeds ${MAX_PLUGIN_NETWORK_RESPONSE_BYTES} bytes`)
    }
    return text
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let byteLength = 0
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    byteLength += value.byteLength
    if (byteLength > MAX_PLUGIN_NETWORK_RESPONSE_BYTES) {
      await reader.cancel().catch(() => {})
      throw new Error(`Plugin network response exceeds ${MAX_PLUGIN_NETWORK_RESPONSE_BYTES} bytes`)
    }
    text += decoder.decode(value, { stream: true })
  }
  text += decoder.decode()
  return text
}

module.exports = {
  MAX_PLUGIN_NETWORK_REQUEST_BYTES,
  MAX_PLUGIN_NETWORK_RESPONSE_BYTES,
  isPrivateAddress,
  assertResolvedAddressesSafe,
  normalizeNetworkRequest,
  readLimitedResponseText
}
