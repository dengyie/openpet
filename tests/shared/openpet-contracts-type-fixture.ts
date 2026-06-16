import type {
  CatalogInstallSelection,
  PluginPackageReviewViewState,
  ReleaseEvidenceArchiveSummary,
  SignedReleaseClaimSummary
} from '../../src/shared/openpet-contracts'

const pluginReviewFixture = {
  installMode: 'install',
  existingVersion: '',
  riskLevel: 'review',
  plugin: {
    id: 'openpet.fixture.plugin',
    name: 'Fixture Plugin',
    version: '1.0.0',
    permissions: ['pet:say'],
    commands: [{ id: 'run', title: 'Run' }]
  },
  permissionDiff: {
    permissions: {
      added: ['pet:say'],
      removed: [],
      unchanged: []
    },
    networkAllowlist: {
      added: [],
      removed: [],
      unchanged: []
    }
  },
  signature: {
    status: 'unsigned',
    label: 'Unsigned plugin',
    errors: []
  },
  blockStatus: {
    blocked: false,
    reasons: []
  },
  packageHash: 'a'.repeat(64),
  fileCount: 3,
  byteSize: 2048
} satisfies PluginPackageReviewViewState

const catalogSelectionFixture = {
  kind: 'plugin',
  itemId: 'openpet.fixture.plugin',
  selectionId: 'fixture-selection',
  sourcePackageHash: pluginReviewFixture.packageHash,
  pluginReview: pluginReviewFixture
} satisfies CatalogInstallSelection

const releaseArchiveFixture = {
  generatedAt: '2026-06-17T00:00:00.000Z',
  archiveDir: '/tmp/openpet-release-evidence',
  releaseReady: false,
  files: [
    {
      path: 'signed-release-closure-report.json',
      sha256: 'b'.repeat(64),
      byteSize: 1024
    }
  ],
  blockers: ['Windows signed smoke evidence is missing.']
} satisfies ReleaseEvidenceArchiveSummary

const signedReleaseClaimFixture = {
  generatedAt: releaseArchiveFixture.generatedAt,
  officialDesktopReleaseReady: false,
  macosReleaseReady: false,
  windowsReleaseReady: false,
  blockers: releaseArchiveFixture.blockers
} satisfies SignedReleaseClaimSummary

export {
  catalogSelectionFixture,
  pluginReviewFixture,
  releaseArchiveFixture,
  signedReleaseClaimFixture
}
