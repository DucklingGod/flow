import { describe, expect, it } from 'vitest'
import { releaseFlags, remoteCapabilities, transactionCapabilities } from '../config/releaseFlags'
import { createEmergencyRollbackPlan, evaluateRolloutPromotion, rolloutEvidenceIds, type RolloutEvidenceId, type RolloutEvidenceRegister } from './rolloutPolicy'

const now = '2026-08-07T08:00:00.000Z'
const approved = (id: RolloutEvidenceId, overrides = {}) => ({
  id,
  status: 'approved',
  reviewedAt: '2026-08-07T07:00:00.000Z',
  validUntil: '2027-08-07T07:00:00.000Z',
  artifactId: `artifact-${id}`,
  ...overrides,
})
const fullEvidence = Object.fromEntries(rolloutEvidenceIds.map((id) => [id, approved(id)])) as RolloutEvidenceRegister
/** Flags for a purely local build, so stage/evidence rules can be tested in isolation. */
const localOnlyFlags = { ...releaseFlags, account: false, subscriptionBilling: false }

describe('staged rollout policy', () => {
  it('allows only the first internal step when the local release mirror is approved', () => {
    const evidence = { localReleaseMirror: approved('localReleaseMirror') }
    expect(evaluateRolloutPromotion({ currentStage: 'off', targetStage: 'internal', evidence, flags: localOnlyFlags, now })).toEqual({ allowed: true, targetStage: 'internal', requiredEvidence: ['localReleaseMirror'] })
  })

  it('requires identity and billing evidence once accounts and subscriptions ship', () => {
    const evidence = { localReleaseMirror: approved('localReleaseMirror') }
    const decision = evaluateRolloutPromotion({ currentStage: 'off', targetStage: 'internal', evidence, now })
    expect(decision).toMatchObject({ allowed: false, reason: 'missing-evidence' })
    if (!decision.allowed) {
      expect(decision.missingEvidence).toContain('authenticationRecoveryDrill')
      expect(decision.missingEvidence).toContain('privacyReview')
      expect(decision.missingEvidence).toContain('billingComplianceReview')
    }
  })

  it('promotes to internal with accounts and billing once their evidence is approved', () => {
    const decision = evaluateRolloutPromotion({ currentStage: 'off', targetStage: 'internal', evidence: fullEvidence, now })
    expect(decision.allowed).toBe(true)
    if (decision.allowed) {
      expect(decision.requiredEvidence).toContain('billingComplianceReview')
      expect(decision.requiredEvidence).toContain('authenticationRecoveryDrill')
    }
  })

  it('rejects unknown, skipped, repeated, reverse, and invalid-time transitions', () => {
    expect(evaluateRolloutPromotion({ currentStage: 'mystery', targetStage: 'internal', evidence: fullEvidence, now })).toMatchObject({ allowed: false, reason: 'unknown-stage' })
    expect(evaluateRolloutPromotion({ currentStage: 'off', targetStage: 'closedBeta', evidence: fullEvidence, now })).toMatchObject({ allowed: false, reason: 'invalid-transition' })
    expect(evaluateRolloutPromotion({ currentStage: 'internal', targetStage: 'internal', evidence: fullEvidence, now })).toMatchObject({ allowed: false, reason: 'invalid-transition' })
    expect(evaluateRolloutPromotion({ currentStage: 'canary', targetStage: 'closedBeta', evidence: fullEvidence, now })).toMatchObject({ allowed: false, reason: 'invalid-transition' })
    expect(evaluateRolloutPromotion({ currentStage: 'off', targetStage: 'internal', evidence: fullEvidence, now: 'not-a-date' })).toMatchObject({ allowed: false, reason: 'invalid-time' })
  })

  it('reports every missing prerequisite for closed beta instead of inferring approval', () => {
    const decision = evaluateRolloutPromotion({ currentStage: 'internal', targetStage: 'closedBeta', evidence: { localReleaseMirror: approved('localReleaseMirror') }, now })
    expect(decision.allowed).toBe(false)
    if (decision.allowed) return
    expect(decision.reason).toBe('missing-evidence')
    expect(decision.missingEvidence).toContain('hostedCi')
    expect(decision.missingEvidence).toContain('firefoxSafariMatrix')
    expect(decision.missingEvidence).toContain('manualAccessibility')
    expect(decision.missingEvidence).toContain('incidentOwner')
  })

  it('rejects rejected, expired, future-dated, mismatched, or untraceable evidence', () => {
    for (const record of [
      approved('localReleaseMirror', { status: 'rejected' }),
      approved('localReleaseMirror', { validUntil: '2026-08-01T00:00:00.000Z' }),
      approved('localReleaseMirror', { reviewedAt: '2026-08-08T00:00:00.000Z' }),
      approved('hostedCi'),
      approved('localReleaseMirror', { artifactId: '../bad' }),
    ]) {
      const decision = evaluateRolloutPromotion({ currentStage: 'off', targetStage: 'internal', evidence: { localReleaseMirror: record }, flags: localOnlyFlags, now })
      expect(decision.allowed).toBe(false)
      if (!decision.allowed) expect(decision.reason).toBe('invalid-evidence')
    }
  })

  it('permanently blocks transaction, transfer/payment, and tax-filing capabilities', () => {
    for (const capability of transactionCapabilities) {
      const decision = evaluateRolloutPromotion({ currentStage: 'off', targetStage: 'internal', evidence: fullEvidence, flags: { ...releaseFlags, [capability]: true }, now })
      expect(decision).toMatchObject({ allowed: false, reason: 'prohibited-capability', prohibitedCapabilities: [capability] })
    }
  })

  it('does not allow an unapproved remote capability in the internal stage', () => {
    const decision = evaluateRolloutPromotion({ currentStage: 'off', targetStage: 'internal', evidence: fullEvidence, flags: { ...releaseFlags, account: true, cloudSync: true }, now })
    expect(decision).toMatchObject({ allowed: false, reason: 'remote-capability-before-beta', prohibitedCapabilities: ['cloudSync'] })
  })

  it('still blocks every other remote capability before beta', () => {
    for (const capability of ['cloudSync', 'householdCollaboration', 'advisorSharing', 'externalAnalytics', 'externalAi', 'liveMarketRetrieval'] as const) {
      const decision = evaluateRolloutPromotion({ currentStage: 'off', targetStage: 'internal', evidence: fullEvidence, flags: { ...releaseFlags, [capability]: true }, now })
      expect(decision, capability).toMatchObject({ allowed: false, reason: 'remote-capability-before-beta' })
    }
  })

  it('adds sharing and external-AI review only when those remote flags are requested', () => {
    const flags = { ...releaseFlags, cloudSync: true, householdCollaboration: true, advisorSharing: true, externalAi: true }
    const withoutConditional = { ...fullEvidence }
    delete withoutConditional.sharingSecurityReview
    delete withoutConditional.externalAiReview
    const decision = evaluateRolloutPromotion({ currentStage: 'internal', targetStage: 'closedBeta', evidence: withoutConditional, flags, now })
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) expect(decision.missingEvidence).toEqual(['sharingSecurityReview', 'externalAiReview'])
    expect(evaluateRolloutPromotion({ currentStage: 'internal', targetStage: 'closedBeta', evidence: fullEvidence, flags, now }).allowed).toBe(true)
  })

  it('requires G7 before live market retrieval even in closed beta', () => {
    const evidence = { ...fullEvidence }
    delete evidence.g7ProviderLegalReview
    const decision = evaluateRolloutPromotion({ currentStage: 'internal', targetStage: 'closedBeta', evidence, flags: { ...releaseFlags, liveMarketRetrieval: true }, now })
    expect(decision).toMatchObject({ allowed: false, reason: 'missing-evidence', missingEvidence: ['g7ProviderLegalReview'] })
  })

  it('requires G6, G7, beta acceptance, and explicit product-owner approval for Production', () => {
    const missing = { ...fullEvidence }
    delete missing.g6ExpertReview
    delete missing.g7ProviderLegalReview
    delete missing.externalBetaAcceptance
    delete missing.productOwnerApproval
    const decision = evaluateRolloutPromotion({ currentStage: 'canary', targetStage: 'production', evidence: missing, now })
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) expect(decision.missingEvidence).toEqual(['g6ExpertReview', 'g7ProviderLegalReview', 'externalBetaAcceptance', 'productOwnerApproval'])
    expect(evaluateRolloutPromotion({ currentStage: 'canary', targetStage: 'production', evidence: fullEvidence, now }).allowed).toBe(true)
  })
})

describe('emergency rollback policy', () => {
  it('disables every remote capability while preserving local planning and requiring manual reapproval', () => {
    const allEnabled = Object.fromEntries(Object.keys(releaseFlags).map((key) => [key, true])) as unknown as typeof releaseFlags
    const plan = createEmergencyRollbackPlan('incident-001', 'SEV-1', allEnabled, now)
    expect(plan?.disabledCapabilities).toEqual(remoteCapabilities)
    for (const capability of remoteCapabilities) expect(plan?.flags[capability]).toBe(false)
    expect(plan?.preservedLocalCapabilities).toEqual(['localPlanVault', 'localReports', 'localCopilot', 'calculationModelUpdates'])
    expect(plan).toMatchObject({ requiresManualReapproval: true, nextStage: 'off' })
    expect(Object.isFrozen(plan?.flags)).toBe(true)
  })

  it('rejects malformed incidents and severities that do not justify a global rollback', () => {
    expect(createEmergencyRollbackPlan('../bad', 'SEV-1', releaseFlags, now)).toBeNull()
    expect(createEmergencyRollbackPlan('incident-001', 'SEV-3', releaseFlags, now)).toBeNull()
    expect(createEmergencyRollbackPlan('incident-001', 'SEV-2', releaseFlags, 'not-a-date')).toBeNull()
  })
})
