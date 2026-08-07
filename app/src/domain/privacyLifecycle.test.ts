import { describe, expect, it } from 'vitest'
import { releaseFlags } from '../config/releaseFlags'
import { authorizeRemoteAction, type RemoteSecurityContext } from './remoteSecurity'
import {
  authorizeRemoteDataUse,
  completeRemoteDeletionManifest,
  createRemoteDeletionManifest,
  createRemoteExportManifest,
  planConsentRevocation,
  recordRemoteDeletionEvidence,
  remoteDeletionScopes,
  type ConsentReceipt,
} from './privacyLifecycle'

const now = '2026-08-07T08:00:00.000Z'
const flags = { ...releaseFlags, account: true, cloudSync: true, householdCollaboration: true, advisorSharing: true, externalAnalytics: true }
const owner: RemoteSecurityContext = {
  sessionKind: 'authenticated', subjectId: 'user-owner', householdId: 'household-a', membershipStatus: 'active', role: 'owner',
  mfaVerified: true, recoveryFactorVerified: false, authenticatedAt: '2026-08-07T07:55:00.000Z',
}
const receipt: ConsentReceipt = {
  receiptId: 'receipt-001', subjectId: 'user-owner', category: 'plan', purpose: 'cloudSync', policyVersion: 'privacy-v1',
  grantedAt: '2026-08-07T07:00:00.000Z', revokedAt: null,
}

describe('remote consent contract', () => {
  it('keeps data use disabled under the actual alpha flags even with a valid receipt', () => {
    expect(authorizeRemoteDataUse({ subjectId: 'user-owner', category: 'plan', purpose: 'cloudSync', currentPolicyVersion: 'privacy-v1', receipt, now })).toEqual({ allowed: false, reason: 'capability-disabled', capability: 'cloudSync' })
  })

  it('requires an exact, current, active consent receipt', () => {
    const request = { subjectId: 'user-owner', category: 'plan', purpose: 'cloudSync', currentPolicyVersion: 'privacy-v1', receipt, now }
    expect(authorizeRemoteDataUse(request, flags)).toEqual({ allowed: true, reason: 'allowed', capability: 'cloudSync' })
    expect(authorizeRemoteDataUse({ ...request, receipt: null }, flags).reason).toBe('consent-missing')
    expect(authorizeRemoteDataUse({ ...request, subjectId: 'other-user' }, flags).reason).toBe('consent-subject-mismatch')
    expect(authorizeRemoteDataUse({ ...request, category: 'portfolio' }, flags).reason).toBe('consent-scope-mismatch')
    expect(authorizeRemoteDataUse({ ...request, currentPolicyVersion: 'privacy-v2' }, flags).reason).toBe('consent-policy-mismatch')
    expect(authorizeRemoteDataUse({ ...request, receipt: { ...receipt, revokedAt: now } }, flags).reason).toBe('consent-revoked')
  })

  it('fails closed on unknown scopes, malformed receipts, and future consent', () => {
    const request = { subjectId: 'user-owner', category: 'plan', purpose: 'cloudSync', currentPolicyVersion: 'privacy-v1', receipt, now }
    expect(authorizeRemoteDataUse({ ...request, category: 'rawBankCredentials' }, flags).reason).toBe('unknown-category')
    expect(authorizeRemoteDataUse({ ...request, purpose: 'sellData' }, flags).reason).toBe('unknown-purpose')
    expect(authorizeRemoteDataUse({ ...request, receipt: { ...receipt, receiptId: '../bad' } }, flags).reason).toBe('invalid-consent-receipt')
    expect(authorizeRemoteDataUse({ ...request, receipt: { ...receipt, grantedAt: '2026-08-08T00:00:00.000Z' } }, flags).reason).toBe('consent-not-yet-valid')
    expect(authorizeRemoteDataUse({ ...request, receipt: { ...receipt, revokedAt: '2026-08-06T00:00:00.000Z' } }, flags).reason).toBe('invalid-consent-receipt')
  })

  it('plans revocation without pretending that revocation alone proves deletion', () => {
    const plan = planConsentRevocation(receipt, now)
    expect(plan?.receipt.revokedAt).toBe(now)
    expect(plan?.actions).toContain('request-delete-or-retain-choice')
    expect(plan?.actions).not.toContain('deletion-complete')
    expect(planConsentRevocation({ ...receipt, revokedAt: now }, now)?.receipt.revokedAt).toBe(now)
    expect(planConsentRevocation({ ...receipt, revokedAt: now }, '2026-08-07T09:00:00.000Z')).toBeNull()
  })
})

describe('remote export and deletion evidence contract', () => {
  const deleteAuthorization = authorizeRemoteAction({ action: 'deleteCloudData', resourceHouseholdId: 'household-a', context: owner, now }, flags)
  const exportAuthorization = authorizeRemoteAction({ action: 'exportPlan', resourceHouseholdId: 'household-a', context: owner, now }, flags)

  it('requires a recently verified owner bound to the same subject and household', () => {
    const editor = authorizeRemoteAction({ action: 'deleteCloudData', resourceHouseholdId: 'household-a', context: { ...owner, role: 'householdEditor' }, now }, flags)
    expect(createRemoteDeletionManifest('deletion-001', 'user-owner', 'household-a', now, editor)).toBeNull()
    expect(createRemoteDeletionManifest('deletion-001', 'other-user', 'household-a', now, deleteAuthorization)).toBeNull()
    expect(createRemoteDeletionManifest('deletion-001', 'user-owner', 'household-b', now, deleteAuthorization)).toBeNull()
    expect(createRemoteDeletionManifest('../bad', 'user-owner', 'household-a', now, deleteAuthorization)).toBeNull()
  })

  it('requires verified evidence for every store including backups and key envelopes', () => {
    let manifest = createRemoteDeletionManifest('deletion-001', 'user-owner', 'household-a', now, deleteAuthorization)
    expect(manifest?.scopes.map((item) => item.scope)).toEqual(remoteDeletionScopes)
    if (!manifest) return
    for (const scope of remoteDeletionScopes.filter((item) => item !== 'cloud-backups')) {
      const updated = recordRemoteDeletionEvidence(manifest, scope, 0, `evidence-${scope}-0001`, '2026-08-07T08:01:00.000Z')
      expect(updated).not.toBeNull()
      manifest = updated as typeof manifest
    }
    expect(completeRemoteDeletionManifest(manifest, '2026-08-07T08:02:00.000Z', deleteAuthorization)).toBeNull()
    manifest = recordRemoteDeletionEvidence(manifest, 'cloud-backups', 2, 'evidence-cloud-backups-0001', '2026-08-07T08:01:30.000Z') as typeof manifest
    const completed = completeRemoteDeletionManifest(manifest, '2026-08-07T08:02:00.000Z', deleteAuthorization)
    expect(completed).toMatchObject({ status: 'verified', completedAt: '2026-08-07T08:02:00.000Z' })
    expect(completed?.scopes.find((item) => item.scope === 'key-envelopes')?.status).toBe('verified')
  })

  it('rejects forged, conflicting, stale, or incomplete purge evidence', () => {
    const manifest = createRemoteDeletionManifest('deletion-001', 'user-owner', 'household-a', now, deleteAuthorization)
    if (!manifest) return
    expect(recordRemoteDeletionEvidence(manifest, 'unknown-store', 0, 'evidence-unknown-0001', now)).toBeNull()
    expect(recordRemoteDeletionEvidence(manifest, 'cloud-backups', -1, 'evidence-cloud-backups-0001', now)).toBeNull()
    expect(recordRemoteDeletionEvidence(manifest, 'cloud-backups', 1, 'short', now)).toBeNull()
    expect(recordRemoteDeletionEvidence(manifest, 'cloud-backups', 1, 'evidence-cloud-backups-0001', '2026-08-07T07:00:00.000Z')).toBeNull()
    const recorded = recordRemoteDeletionEvidence(manifest, 'cloud-backups', 1, 'evidence-cloud-backups-0001', now)
    expect(recorded).not.toBeNull()
    if (!recorded) return
    expect(recordRemoteDeletionEvidence(recorded, 'cloud-backups', 1, 'evidence-cloud-backups-0001', now)).toBe(recorded)
    expect(recordRemoteDeletionEvidence(recorded, 'cloud-backups', 2, 'evidence-cloud-backups-0002', now)).toBeNull()
    const forged = {
      ...manifest,
      scopes: manifest.scopes.map((item) => ({ ...item, status: 'verified' as const, recordsDeleted: 0, evidenceDigest: 'short', completedAt: now })),
    }
    expect(completeRemoteDeletionManifest(forged, '2026-08-07T08:02:00.000Z', deleteAuthorization)).toBeNull()
  })

  it('produces only an owner-authorized encrypted export manifest', () => {
    expect(createRemoteExportManifest('export-0001', 'user-owner', 'household-a', now, exportAuthorization)).toEqual({
      requestId: 'export-0001', subjectId: 'user-owner', householdId: 'household-a', requestedAt: now,
      format: 'encrypted-json', keyOwnership: 'user-held', scopes: ['current-plan', 'version-history', 'consent-audit'],
    })
    const editor = authorizeRemoteAction({ action: 'exportPlan', resourceHouseholdId: 'household-a', context: { ...owner, role: 'householdEditor' }, now }, flags)
    expect(createRemoteExportManifest('export-0001', 'user-owner', 'household-a', now, editor)).toBeNull()
    expect(createRemoteExportManifest('export-0001', 'other-user', 'household-a', now, exportAuthorization)).toBeNull()
  })
})
