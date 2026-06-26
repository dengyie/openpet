const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createPluginPolicyController
} = require('../../src/main/services/plugin-policy-controller')

test('policy controller returns blocked status from installed hashes and rejects blocked plugins', () => {
  const controller = createPluginPolicyController({
    getInstalledMap: () => ({
      'official.basic-behavior': {
        packageHash: 'pkg-hash-1',
        sourcePackageHash: 'src-hash-1'
      }
    }),
    getPluginBlockStatus: ({ id, sha256, sourceSha256 }) => {
      assert.equal(id, 'official.basic-behavior')
      assert.equal(sha256, 'pkg-hash-1')
      assert.equal(sourceSha256, 'src-hash-1')
      return { blocked: true, reasons: ['pluginId:official.basic-behavior'] }
    },
    getSignatureStatus: () => ({ status: 'unused' })
  })

  const status = controller.getPluginPolicyStatus('official.basic-behavior')

  assert.deepEqual(status, {
    blocked: true,
    reasons: ['pluginId:official.basic-behavior']
  })
  assert.throws(
    () => controller.assertPluginAllowed('official.basic-behavior'),
    /Plugin is blocked: pluginId:official\.basic-behavior/
  )
})

test('policy controller resolves official and installed signature states', () => {
  const controller = createPluginPolicyController({
    getInstalledMap: () => ({
      verified: { signatureStatus: 'hash-verified', signer: 'codex' },
      unsigned: { signatureStatus: 'unsigned' },
      present: { signatureStatus: 'metadata-present', signer: 'dev-signer' }
    }),
    getPluginBlockStatus: () => ({ blocked: false, reasons: [] }),
    getSignatureStatus: (manifest) => ({
      status: manifest.source === 'official' ? 'official' : 'unsigned-fallback',
      label: manifest.source === 'official' ? 'Official plugin' : 'Unsigned plugin',
      signer: manifest.source === 'official' ? 'openpet' : '',
      algorithm: manifest.source === 'official' ? 'bundled' : ''
    })
  })

  assert.deepEqual(
    controller.getPluginSignatureStatus({ id: 'official.basic-behavior', source: 'official' }),
    { status: 'official', label: 'Official plugin', signer: 'openpet', algorithm: 'bundled' }
  )
  assert.deepEqual(
    controller.getPluginSignatureStatus({ id: 'verified', source: 'local' }),
    { status: 'hash-verified', label: 'Signature hash metadata verified', signer: 'codex', algorithm: '' }
  )
  assert.deepEqual(
    controller.getPluginSignatureStatus({ id: 'unsigned', source: 'local' }),
    { status: 'unsigned', label: 'Unsigned plugin', signer: '', algorithm: '' }
  )
  assert.deepEqual(
    controller.getPluginSignatureStatus({ id: 'present', source: 'local' }),
    { status: 'metadata-present', label: 'Signature metadata present, not verified', signer: 'dev-signer', algorithm: '' }
  )
})

test('policy controller falls back to generic signature status and unblocked defaults', () => {
  const controller = createPluginPolicyController({
    getInstalledMap: () => ({}),
    getPluginBlockStatus: () => null,
    getSignatureStatus: () => ({
      status: 'present-unverified',
      label: 'Signature metadata present, not verified',
      signer: 'fallback-signer',
      algorithm: 'unknown'
    })
  })

  assert.deepEqual(
    controller.getPluginPolicyStatus({ id: 'local-runner' }),
    { blocked: false, reasons: [] }
  )
  assert.deepEqual(
    controller.getPluginSignatureStatus({ id: 'local-runner', source: 'local' }),
    {
      status: 'present-unverified',
      label: 'Signature metadata present, not verified',
      signer: 'fallback-signer',
      algorithm: 'unknown'
    }
  )
})
