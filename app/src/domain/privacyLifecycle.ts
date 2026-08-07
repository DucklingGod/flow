import { releaseFlags, type ReleaseCapability } from '../config/releaseFlags'
import type { RemoteAuthorizationDecision } from './remoteSecurity'

export const remoteDataCategories = ['plan', 'portfolio', 'goals', 'retirement', 'protection', 'tax', 'legacy', 'reviewHistory', 'usageMetrics'] as const
export type RemoteDataCategory = typeof remoteDataCategories[number]

export const remoteDataPurposes = ['cloudSync', 'householdCollaboration', 'advisorSharing', 'externalAnalytics'] as const
export type RemoteDataPurpose = typeof remoteDataPurposes[number]

const purposeCapability: Record<RemoteDataPurpose, Extract<ReleaseCapability, 'cloudSync' | 'householdCollaboration' | 'advisorSharing' | 'externalAnalytics'>> = {
  cloudSync: 'cloudSync',
  householdCollaboration: 'householdCollaboration',
  advisorSharing: 'advisorSharing',
  externalAnalytics: 'externalAnalytics',
}

const categorySet = new Set<string>(remoteDataCategories)
const purposeSet = new Set<string>(remoteDataPurposes)
const tokenPattern = /^[a-zA-Z0-9._:-]+$/

const validToken = (value: string, minimum = 1) => value.length >= minimum && value.length <= 128 && tokenPattern.test(value)
const timestamp = (value: string) => {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export interface ConsentReceipt {
  receiptId: string
  subjectId: string
  category: RemoteDataCategory | string
  purpose: RemoteDataPurpose | string
  policyVersion: string
  grantedAt: string
  revokedAt: string | null
}

export type RemoteDataUseReason =
  | 'allowed'
  | 'unknown-category'
  | 'unknown-purpose'
  | 'capability-disabled'
  | 'consent-missing'
  | 'invalid-consent-receipt'
  | 'consent-subject-mismatch'
  | 'consent-scope-mismatch'
  | 'consent-policy-mismatch'
  | 'consent-not-yet-valid'
  | 'consent-revoked'

export interface RemoteDataUseRequest {
  subjectId: string
  category: RemoteDataCategory | string
  purpose: RemoteDataPurpose | string
  currentPolicyVersion: string
  receipt: ConsentReceipt | null
  now: string
}

export interface RemoteDataUseDecision {
  allowed: boolean
  reason: RemoteDataUseReason
  capability: ReleaseCapability | null
}

function validReceipt(receipt: ConsentReceipt) {
  const grantedAt = timestamp(receipt.grantedAt)
  const revokedAt = receipt.revokedAt ? timestamp(receipt.revokedAt) : null
  return validToken(receipt.receiptId, 8)
    && validToken(receipt.subjectId)
    && categorySet.has(receipt.category)
    && purposeSet.has(receipt.purpose)
    && validToken(receipt.policyVersion)
    && grantedAt !== null
    && (receipt.revokedAt === null || (revokedAt !== null && revokedAt >= grantedAt))
}

export function authorizeRemoteDataUse(
  request: RemoteDataUseRequest,
  flags: Readonly<Record<ReleaseCapability, boolean>> = releaseFlags,
): RemoteDataUseDecision {
  if (!categorySet.has(request.category)) return { allowed: false, reason: 'unknown-category', capability: null }
  if (!purposeSet.has(request.purpose)) return { allowed: false, reason: 'unknown-purpose', capability: null }
  const capability = purposeCapability[request.purpose as RemoteDataPurpose]
  if (!flags[capability]) return { allowed: false, reason: 'capability-disabled', capability }
  if (!request.receipt) return { allowed: false, reason: 'consent-missing', capability }
  if (!validReceipt(request.receipt) || !validToken(request.subjectId) || !validToken(request.currentPolicyVersion) || timestamp(request.now) === null) return { allowed: false, reason: 'invalid-consent-receipt', capability }
  if (request.receipt.subjectId !== request.subjectId) return { allowed: false, reason: 'consent-subject-mismatch', capability }
  if (request.receipt.category !== request.category || request.receipt.purpose !== request.purpose) return { allowed: false, reason: 'consent-scope-mismatch', capability }
  if (request.receipt.policyVersion !== request.currentPolicyVersion) return { allowed: false, reason: 'consent-policy-mismatch', capability }
  const now = timestamp(request.now) as number
  const grantedAt = timestamp(request.receipt.grantedAt) as number
  if (grantedAt > now + 60_000) return { allowed: false, reason: 'consent-not-yet-valid', capability }
  if (request.receipt.revokedAt !== null) return { allowed: false, reason: 'consent-revoked', capability }
  return { allowed: true, reason: 'allowed', capability }
}

export interface ConsentRevocationPlan {
  receipt: ConsentReceipt
  actions: readonly ['suspend-processing', 'revoke-purpose-access', 'clear-pending-uploads', 'offer-export', 'request-delete-or-retain-choice', 'retain-minimal-consent-audit']
}

export function planConsentRevocation(receipt: ConsentReceipt, revokedAt: string): ConsentRevocationPlan | null {
  if (!validReceipt(receipt)) return null
  const revoked = timestamp(revokedAt)
  const granted = timestamp(receipt.grantedAt)
  if (revoked === null || granted === null || revoked < granted) return null
  if (receipt.revokedAt && receipt.revokedAt !== revokedAt) return null
  return {
    receipt: { ...receipt, revokedAt },
    actions: ['suspend-processing', 'revoke-purpose-access', 'clear-pending-uploads', 'offer-export', 'request-delete-or-retain-choice', 'retain-minimal-consent-audit'],
  }
}

export const remoteDeletionScopes = [
  'primary-plan-ciphertext',
  'version-history-ciphertext',
  'sync-queue',
  'cloud-backups',
  'key-envelopes',
  'advisor-share-grants',
  'provider-cache',
  'remote-metrics',
] as const
export type RemoteDeletionScope = typeof remoteDeletionScopes[number]

export interface RemoteDeletionEvidence {
  scope: RemoteDeletionScope
  status: 'pending' | 'verified'
  recordsDeleted: number | null
  evidenceDigest: string | null
  completedAt: string | null
}

export interface RemoteDeletionManifest {
  requestId: string
  subjectId: string
  householdId: string
  requestedAt: string
  status: 'pending' | 'verified'
  scopes: readonly RemoteDeletionEvidence[]
  completedAt: string | null
}

function lifecycleAuthorizationMatches(authorization: RemoteAuthorizationDecision, action: 'exportPlan' | 'deleteCloudData', subjectId: string, householdId: string) {
  return authorization.allowed
    && authorization.action === action
    && authorization.subjectId === subjectId
    && authorization.resourceHouseholdId === householdId
}

export function createRemoteDeletionManifest(
  requestId: string,
  subjectId: string,
  householdId: string,
  requestedAt: string,
  authorization: RemoteAuthorizationDecision,
): RemoteDeletionManifest | null {
  if (!validToken(requestId, 8) || !validToken(subjectId) || !validToken(householdId) || timestamp(requestedAt) === null) return null
  if (!lifecycleAuthorizationMatches(authorization, 'deleteCloudData', subjectId, householdId)) return null
  return {
    requestId,
    subjectId,
    householdId,
    requestedAt,
    status: 'pending',
    scopes: remoteDeletionScopes.map((scope) => ({ scope, status: 'pending', recordsDeleted: null, evidenceDigest: null, completedAt: null })),
    completedAt: null,
  }
}

export function recordRemoteDeletionEvidence(
  manifest: RemoteDeletionManifest,
  scope: RemoteDeletionScope | string,
  recordsDeleted: number,
  evidenceDigest: string,
  completedAt: string,
): RemoteDeletionManifest | null {
  if (manifest.status !== 'pending' || !remoteDeletionScopes.includes(scope as RemoteDeletionScope)) return null
  const completed = timestamp(completedAt)
  const requested = timestamp(manifest.requestedAt)
  if (!Number.isSafeInteger(recordsDeleted) || recordsDeleted < 0 || !validToken(evidenceDigest, 16) || completed === null || requested === null || completed < requested) return null
  const existing = manifest.scopes.find((item) => item.scope === scope)
  if (!existing) return null
  if (existing.status === 'verified') {
    return existing.recordsDeleted === recordsDeleted && existing.evidenceDigest === evidenceDigest && existing.completedAt === completedAt ? manifest : null
  }
  return {
    ...manifest,
    scopes: manifest.scopes.map((item) => item.scope === scope ? { ...item, status: 'verified', recordsDeleted, evidenceDigest, completedAt } : item),
  }
}

export function completeRemoteDeletionManifest(
  manifest: RemoteDeletionManifest,
  completedAt: string,
  authorization: RemoteAuthorizationDecision,
): RemoteDeletionManifest | null {
  if (!lifecycleAuthorizationMatches(authorization, 'deleteCloudData', manifest.subjectId, manifest.householdId)) return null
  const completed = timestamp(completedAt)
  const requested = timestamp(manifest.requestedAt)
  if (!validToken(manifest.requestId, 8) || !validToken(manifest.subjectId) || !validToken(manifest.householdId)) return null
  if (manifest.status !== 'pending' || completed === null || requested === null || completed < requested || manifest.scopes.length !== remoteDeletionScopes.length) return null
  const validEvidence = remoteDeletionScopes.every((scope) => {
    const matches = manifest.scopes.filter((item) => item.scope === scope)
    if (matches.length !== 1) return false
    const item = matches[0]
    const evidenceTime = item.completedAt ? timestamp(item.completedAt) : null
    return item.status === 'verified'
      && item.recordsDeleted !== null
      && Number.isSafeInteger(item.recordsDeleted)
      && item.recordsDeleted >= 0
      && item.evidenceDigest !== null
      && validToken(item.evidenceDigest, 16)
      && evidenceTime !== null
      && evidenceTime >= requested
      && evidenceTime <= completed
  })
  if (!validEvidence) return null
  return { ...manifest, status: 'verified', completedAt }
}

export interface RemoteExportManifest {
  requestId: string
  subjectId: string
  householdId: string
  requestedAt: string
  format: 'encrypted-json'
  keyOwnership: 'user-held'
  scopes: readonly ['current-plan', 'version-history', 'consent-audit']
}

export function createRemoteExportManifest(
  requestId: string,
  subjectId: string,
  householdId: string,
  requestedAt: string,
  authorization: RemoteAuthorizationDecision,
): RemoteExportManifest | null {
  if (!validToken(requestId, 8) || !validToken(subjectId) || !validToken(householdId) || timestamp(requestedAt) === null) return null
  if (!lifecycleAuthorizationMatches(authorization, 'exportPlan', subjectId, householdId)) return null
  return { requestId, subjectId, householdId, requestedAt, format: 'encrypted-json', keyOwnership: 'user-held', scopes: ['current-plan', 'version-history', 'consent-audit'] }
}
