const createPluginPolicyController = ({
  getInstalledMap,
  getPluginBlockStatus,
  getSignatureStatus
} = {}) => {
  if (typeof getInstalledMap !== 'function') throw new Error('getInstalledMap is required')
  if (typeof getPluginBlockStatus !== 'function') throw new Error('getPluginBlockStatus is required')
  if (typeof getSignatureStatus !== 'function') throw new Error('getSignatureStatus is required')

  const getPluginPolicyStatus = (manifestOrId) => {
    const pluginId = typeof manifestOrId === 'string' ? manifestOrId : manifestOrId?.id
    const installed = getInstalledMap()[pluginId] || {}
    return getPluginBlockStatus({
      id: pluginId,
      sha256: installed.packageHash || '',
      sourceSha256: installed.sourcePackageHash || ''
    }) || { blocked: false, reasons: [] }
  }

  const assertPluginAllowed = (manifestOrId) => {
    const status = getPluginPolicyStatus(manifestOrId)
    if (status.blocked) throw new Error(`Plugin is blocked: ${status.reasons.join(', ')}`)
    return status
  }

  const getPluginSignatureStatus = (manifest) => {
    if (manifest.source === 'official') return getSignatureStatus(manifest)
    const installed = getInstalledMap()[manifest.id]
    if (installed?.signatureStatus) {
      if (installed.signatureStatus === 'hash-verified') {
        return {
          status: 'hash-verified',
          label: 'Signature hash metadata verified',
          signer: installed.signer || '',
          algorithm: ''
        }
      }
      if (installed.signatureStatus === 'unsigned') {
        return {
          status: 'unsigned',
          label: 'Unsigned plugin',
          signer: '',
          algorithm: ''
        }
      }
      return {
        status: installed.signatureStatus,
        label: 'Signature metadata present, not verified',
        signer: installed.signer || '',
        algorithm: ''
      }
    }
    return getSignatureStatus(manifest)
  }

  return {
    getPluginPolicyStatus,
    assertPluginAllowed,
    getPluginSignatureStatus
  }
}

module.exports = {
  createPluginPolicyController
}
