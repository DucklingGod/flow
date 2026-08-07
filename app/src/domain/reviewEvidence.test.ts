import { describe, expect, it } from 'vitest'
import { buildExternalReviewResponseTemplate, evaluateExternalReviewResponse, type BundleManifest, type ExternalReviewResponse } from './reviewEvidence'

const now = new Date('2026-08-08T00:00:00.000Z')
const manifest: BundleManifest = {
  schemaVersion: 1,
  runId: 'review-run',
  generatedAt: '2026-08-07T00:00:00.000Z',
  appVersion: '1.0.0-alpha.3',
  containsUserPlanData: false,
  invariants: { sharingDeferredToP9: true, humanApprovalRequired: true, noRealTrading: true },
}
const manifestHash = 'a'.repeat(64)

function approvedResponse() {
  const response = buildExternalReviewResponseTemplate(manifest, manifestHash)
  const gateEvidence = {
    G6: ['signed-fixture-disposition.pdf'],
    G7: ['completed-provider-reconciliation.csv'],
    G9: ['security-accessibility-beta-record.pdf'],
  }
  const names = {
    'thai-financial-tax-expert': 'Dr Thai Expert',
    'licensed-data-provider-owner': 'Provider Owner',
    'security-privacy-reviewer': 'Security Reviewer',
    'accessibility-reviewer': 'Accessibility Reviewer',
    'incident-owner': 'Incident Owner',
    'product-owner': 'Flow Product Owner',
  }
  for (const gate of ['G6', 'G7', 'G9'] as const) {
    Object.keys(response.gateReviews[gate].assertions).forEach((key) => {
      ;(response.gateReviews[gate].assertions as Record<string, boolean>)[key] = true
    })
    response.gateReviews[gate].evidenceReferences = gateEvidence[gate]
    response.gateReviews[gate].reviewers.forEach((reviewer) => Object.assign(reviewer, {
      name: names[reviewer.role],
      organization: reviewer.role === 'product-owner' ? 'Flow' : `${names[reviewer.role]} Org`,
      reviewedAt: '2026-08-07T12:00:00.000Z',
      decision: 'approved',
      signatureReference: `signature:${reviewer.role}`,
    }))
  }
  Object.keys(response.finalReview.assertions).forEach((key) => {
    ;(response.finalReview.assertions as Record<string, boolean>)[key] = true
  })
  response.finalReview.acceptedGateDecisions = { G6: true, G7: true, G9: true }
  response.finalReview.evidenceReferences = ['product-acceptance-packet.pdf']
  Object.assign(response.finalReview.reviewer, {
    name: names['product-owner'], organization: 'Flow', reviewedAt: '2026-08-07T13:00:00.000Z',
    decision: 'approved', signatureReference: 'signature:final-product-owner',
  })
  return response
}

describe('external review evidence', () => {
  it('builds a fail-closed pending template anchored to the manifest', () => {
    const response = buildExternalReviewResponseTemplate(manifest, manifestHash)
    const result = evaluateExternalReviewResponse(response, manifest, manifestHash, now)
    expect(result.structurallyValid).toBe(true)
    expect(result.releaseReady).toBe(false)
    expect(result.gateStatus).toEqual({ G6: 'pending', G7: 'pending', G9: 'pending', final: 'pending' })
    expect(result.issues.some((issue) => issue.code === 'decision-pending')).toBe(true)
  })

  it('accepts a complete sequentially approved response without enabling any capability', () => {
    const response = approvedResponse()
    const result = evaluateExternalReviewResponse(response, manifest, manifestHash, now)
    expect(result.issues).toEqual([])
    expect(result.gateStatus).toEqual({ G6: 'approved', G7: 'approved', G9: 'approved', final: 'approved' })
    expect(result.releaseReady).toBe(true)
    expect(JSON.stringify(response)).not.toMatch(/enable|tradingEnabled|sharingEnabled/i)
  })

  it('rejects a response copied to a different bundle', () => {
    const result = evaluateExternalReviewResponse(approvedResponse(), { ...manifest, runId: 'other-run' }, 'b'.repeat(64), now)
    expect(result.releaseReady).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['bundle-run-mismatch', 'manifest-hash-mismatch']))
  })

  it('fails closed for missing roles, duplicate people, and future dates', () => {
    const response = approvedResponse()
    response.gateReviews.G7.reviewers = response.gateReviews.G7.reviewers.filter((reviewer) => reviewer.role !== 'security-privacy-reviewer')
    response.gateReviews.G9.reviewers[1].name = response.gateReviews.G9.reviewers[0].name
    response.gateReviews.G6.reviewers[0].reviewedAt = '2026-09-01T00:00:00.000Z'
    const result = evaluateExternalReviewResponse(response, manifest, manifestHash, now)
    expect(result.releaseReady).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['missing-required-role', 'reviewer-role-separation', 'future-review-date']))
  })

  it('does not treat unresolved or unaccepted conditions as approval', () => {
    const response = approvedResponse()
    const reviewer = response.gateReviews.G6.reviewers[0]
    reviewer.decision = 'approved-with-conditions'
    reviewer.conditions = [{ id: 'G6-C1', description: 'Correct disclaimer', status: 'open', evidenceReference: '', resolvedAt: '', acceptedByProductOwner: false }]
    const result = evaluateExternalReviewResponse(response, manifest, manifestHash, now)
    expect(result.gateStatus.G6).toBe('conditional')
    expect(result.gateStatus.G7).toBe('blocked-by-dependency')
    expect(result.releaseReady).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'unresolved-condition')).toBe(true)
  })

  it('accepts conditions only after resolution evidence and Product Owner acceptance', () => {
    const response = approvedResponse()
    const reviewer = response.gateReviews.G6.reviewers[0]
    reviewer.decision = 'approved-with-conditions'
    reviewer.conditions = [{ id: 'G6-C1', description: 'Correct disclaimer', status: 'resolved', evidenceReference: 'change:G6-C1', resolvedAt: '2026-08-07T14:00:00.000Z', acceptedByProductOwner: true }]
    const result = evaluateExternalReviewResponse(response, manifest, manifestHash, now)
    expect(result.issues).toEqual([])
    expect(result.releaseReady).toBe(true)
  })

  it('preserves a rejected decision even when all checkboxes are true', () => {
    const response = approvedResponse()
    response.gateReviews.G9.reviewers[0].decision = 'rejected'
    const result = evaluateExternalReviewResponse(response, manifest, manifestHash, now)
    expect(result.gateStatus.G9).toBe('rejected')
    expect(result.releaseReady).toBe(false)
  })

  it('rejects unknown fields and oversized untrusted collections', () => {
    const unknown = { ...approvedResponse(), capabilityOverride: { sharing: true } }
    expect(evaluateExternalReviewResponse(unknown, manifest, manifestHash, now).structurallyValid).toBe(false)
    const response = approvedResponse() as ExternalReviewResponse
    response.gateReviews.G6.evidenceReferences = Array.from({ length: 26 }, (_, index) => `ref-${index}`)
    expect(evaluateExternalReviewResponse(response, manifest, manifestHash, now).structurallyValid).toBe(false)
  })

  it('requires one stable Product Owner identity across every approval', () => {
    const response = approvedResponse()
    response.finalReview.reviewer.name = 'Different Owner'
    const result = evaluateExternalReviewResponse(response, manifest, manifestHash, now)
    expect(result.releaseReady).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'product-owner-identity-mismatch')).toBe(true)
  })
})
