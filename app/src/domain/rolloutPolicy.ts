import { releaseFlags, remoteCapabilities, transactionCapabilities, type ReleaseCapability } from '../config/releaseFlags'

export const rolloutStages = ['off', 'internal', 'closedBeta', 'canary', 'production'] as const
export type RolloutStage = typeof rolloutStages[number]

export const rolloutEvidenceIds = [
  'localReleaseMirror',
  'hostedCi',
  'branchProtection',
  'g6ExpertReview',
  'g7ProviderLegalReview',
  'threatModelReview',
  'privacyReview',
  'authenticationRecoveryDrill',
  'authorizationDrill',
  'cloudKeyRecoveryDrill',
  'syncConflictDrill',
  'deletePurgeDrill',
  'firefoxSafariMatrix',
  'manualAccessibility',
  'incidentOwner',
  'onCallCoverage',
  'rollbackDrill',
  'metricsPrivacyApproval',
  'externalBetaAcceptance',
  'sharingSecurityReview',
  'externalAiReview',
  'productOwnerApproval',
] as const
export type RolloutEvidenceId = typeof rolloutEvidenceIds[number]

export interface RolloutEvidenceRecord {
  id: RolloutEvidenceId | string
  status: 'pending' | 'approved' | 'rejected' | string
  reviewedAt: string | null
  validUntil: string | null
  artifactId: string | null
}

export type RolloutEvidenceRegister = Partial<Record<RolloutEvidenceId, RolloutEvidenceRecord>>

export interface RolloutPromotionRequest {
  currentStage: RolloutStage | string
  targetStage: RolloutStage | string
  evidence: RolloutEvidenceRegister
  flags?: Readonly<Record<ReleaseCapability, boolean>>
  now: string
}

export type RolloutPromotionDecision =
  | { allowed: true; targetStage: RolloutStage; requiredEvidence: readonly RolloutEvidenceId[] }
  | {
      allowed: false
      reason: 'unknown-stage' | 'invalid-transition' | 'invalid-time' | 'prohibited-capability' | 'remote-capability-before-beta' | 'missing-evidence' | 'invalid-evidence'
      missingEvidence: readonly RolloutEvidenceId[]
      invalidEvidence: readonly RolloutEvidenceId[]
      prohibitedCapabilities: readonly ReleaseCapability[]
    }

const stageSet = new Set<string>(rolloutStages)
const evidenceSet = new Set<string>(rolloutEvidenceIds)
const artifactPattern = /^[a-zA-Z0-9._:-]{8,128}$/

const requirements: Record<Exclude<RolloutStage, 'off'>, readonly RolloutEvidenceId[]> = {
  internal: ['localReleaseMirror'],
  closedBeta: [
    'localReleaseMirror', 'hostedCi', 'branchProtection', 'threatModelReview', 'privacyReview',
    'authenticationRecoveryDrill', 'authorizationDrill', 'cloudKeyRecoveryDrill', 'syncConflictDrill', 'deletePurgeDrill',
    'firefoxSafariMatrix', 'manualAccessibility', 'incidentOwner', 'onCallCoverage', 'rollbackDrill', 'metricsPrivacyApproval',
  ],
  canary: [
    'localReleaseMirror', 'hostedCi', 'branchProtection', 'threatModelReview', 'privacyReview',
    'authenticationRecoveryDrill', 'authorizationDrill', 'cloudKeyRecoveryDrill', 'syncConflictDrill', 'deletePurgeDrill',
    'firefoxSafariMatrix', 'manualAccessibility', 'incidentOwner', 'onCallCoverage', 'rollbackDrill', 'metricsPrivacyApproval',
    'externalBetaAcceptance',
  ],
  production: [
    'localReleaseMirror', 'hostedCi', 'branchProtection', 'g6ExpertReview', 'g7ProviderLegalReview', 'threatModelReview', 'privacyReview',
    'authenticationRecoveryDrill', 'authorizationDrill', 'cloudKeyRecoveryDrill', 'syncConflictDrill', 'deletePurgeDrill',
    'firefoxSafariMatrix', 'manualAccessibility', 'incidentOwner', 'onCallCoverage', 'rollbackDrill', 'metricsPrivacyApproval',
    'externalBetaAcceptance', 'productOwnerApproval',
  ],
}

const denied = (
  reason: Exclude<RolloutPromotionDecision, { allowed: true }>['reason'],
  missingEvidence: readonly RolloutEvidenceId[] = [],
  invalidEvidence: readonly RolloutEvidenceId[] = [],
  prohibitedCapabilities: readonly ReleaseCapability[] = [],
): RolloutPromotionDecision => ({ allowed: false, reason, missingEvidence, invalidEvidence, prohibitedCapabilities })

function requiredEvidence(targetStage: Exclude<RolloutStage, 'off'>, flags: Readonly<Record<ReleaseCapability, boolean>>) {
  const required = new Set<RolloutEvidenceId>(requirements[targetStage])
  if (flags.householdCollaboration || flags.advisorSharing) required.add('sharingSecurityReview')
  if (flags.externalAi) required.add('externalAiReview')
  if (flags.liveMarketRetrieval) required.add('g7ProviderLegalReview')
  return [...required]
}

function evidenceIsValid(record: RolloutEvidenceRecord, expectedId: RolloutEvidenceId, now: number) {
  if (record.id !== expectedId || !evidenceSet.has(record.id) || record.status !== 'approved' || !record.artifactId || !artifactPattern.test(record.artifactId)) return false
  const reviewedAt = record.reviewedAt ? Date.parse(record.reviewedAt) : Number.NaN
  const validUntil = record.validUntil ? Date.parse(record.validUntil) : null
  if (!Number.isFinite(reviewedAt) || reviewedAt > now + 60_000) return false
  return validUntil === null || (Number.isFinite(validUntil) && validUntil >= now && validUntil >= reviewedAt)
}

export function evaluateRolloutPromotion(request: RolloutPromotionRequest): RolloutPromotionDecision {
  if (!stageSet.has(request.currentStage) || !stageSet.has(request.targetStage)) return denied('unknown-stage')
  const current = request.currentStage as RolloutStage
  const target = request.targetStage as RolloutStage
  if (rolloutStages.indexOf(target) !== rolloutStages.indexOf(current) + 1 || target === 'off') return denied('invalid-transition')
  const now = Date.parse(request.now)
  if (!Number.isFinite(now)) return denied('invalid-time')
  const flags = request.flags ?? releaseFlags
  const prohibited = transactionCapabilities.filter((capability) => flags[capability])
  if (prohibited.length) return denied('prohibited-capability', [], [], prohibited)
  const enabledRemote = remoteCapabilities.filter((capability) => flags[capability])
  if (target === 'internal' && enabledRemote.length) return denied('remote-capability-before-beta', [], [], enabledRemote)
  const required = requiredEvidence(target as Exclude<RolloutStage, 'off'>, flags)
  const missing = required.filter((id) => !request.evidence[id])
  if (missing.length) return denied('missing-evidence', missing)
  const invalid = required.filter((id) => !evidenceIsValid(request.evidence[id] as RolloutEvidenceRecord, id, now))
  if (invalid.length) return denied('invalid-evidence', [], invalid)
  return { allowed: true, targetStage: target, requiredEvidence: required }
}

export interface EmergencyRollbackPlan {
  incidentId: string
  severity: 'SEV-1' | 'SEV-2'
  createdAt: string
  flags: Readonly<Record<ReleaseCapability, boolean>>
  disabledCapabilities: readonly ReleaseCapability[]
  preservedLocalCapabilities: readonly ReleaseCapability[]
  requiresManualReapproval: true
  nextStage: 'off'
}

export function createEmergencyRollbackPlan(
  incidentId: string,
  severity: 'SEV-1' | 'SEV-2' | string,
  currentFlags: Readonly<Record<ReleaseCapability, boolean>>,
  createdAt: string,
): EmergencyRollbackPlan | null {
  if (!/^[a-zA-Z0-9._:-]{8,128}$/.test(incidentId) || (severity !== 'SEV-1' && severity !== 'SEV-2') || !Number.isFinite(Date.parse(createdAt))) return null
  const disabledCapabilities = remoteCapabilities.filter((capability) => currentFlags[capability])
  const flags = { ...currentFlags }
  for (const capability of remoteCapabilities) flags[capability] = false
  const preservedLocalCapabilities = (Object.keys(flags) as ReleaseCapability[]).filter((capability) => !remoteCapabilities.includes(capability as typeof remoteCapabilities[number]) && flags[capability])
  return { incidentId, severity, createdAt, flags: Object.freeze(flags), disabledCapabilities, preservedLocalCapabilities, requiresManualReapproval: true, nextStage: 'off' }
}
