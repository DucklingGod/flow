import './zodRuntime'
import { z } from 'zod'

const gateIds = ['G6', 'G7', 'G9'] as const
const reviewerRoles = [
  'thai-financial-tax-expert',
  'licensed-data-provider-owner',
  'security-privacy-reviewer',
  'accessibility-reviewer',
  'incident-owner',
  'product-owner',
] as const

export type ExternalGateId = (typeof gateIds)[number]
export type ReviewerRole = (typeof reviewerRoles)[number]
export type ReviewDecision = 'pending' | 'approved' | 'approved-with-conditions' | 'rejected'
export type EffectiveGateStatus = 'invalid' | 'pending' | 'conditional' | 'rejected' | 'approved' | 'blocked-by-dependency'

const boundedText = z.string().max(500)
const boundedReference = z.string().max(1_000)
const stringList = z.array(boundedText).max(50)
const referenceList = z.array(boundedReference).max(25)

const conditionSchema = z.object({
  id: z.string().max(100),
  description: boundedText,
  status: z.enum(['open', 'resolved']),
  evidenceReference: boundedReference,
  resolvedAt: z.string().max(40),
  acceptedByProductOwner: z.boolean(),
}).strict()

const reviewerSchema = z.object({
  name: z.string().max(200),
  role: z.enum(reviewerRoles),
  organization: z.string().max(300),
  reviewedAt: z.string().max(40),
  expiresAt: z.string().max(40).nullable(),
  decision: z.enum(['pending', 'approved', 'approved-with-conditions', 'rejected']),
  findings: stringList,
  requiredChanges: stringList,
  residualRisks: stringList,
  conditions: z.array(conditionSchema).max(20),
  signatureReference: boundedReference,
}).strict()

const g6ReviewSchema = z.object({
  assertions: z.object({
    fixtureDispositionComplete: z.boolean(),
    disclaimerAndScopeApproved: z.boolean(),
    taxYearAndSourcesApproved: z.boolean(),
  }).strict(),
  evidenceReferences: referenceList,
  reviewers: z.array(reviewerSchema).max(6),
}).strict()

const g7ReviewSchema = z.object({
  assertions: z.object({
    realAccountReconciliationComplete: z.boolean(),
    legalAndLicensingApproved: z.boolean(),
    displayRetentionAndAttributionRightsApproved: z.boolean(),
  }).strict(),
  evidenceReferences: referenceList,
  reviewers: z.array(reviewerSchema).max(6),
}).strict()

const g9ReviewSchema = z.object({
  assertions: z.object({
    independentThreatAndPrivacyReviewComplete: z.boolean(),
    prioritySafariMatrixComplete: z.boolean(),
    manualAccessibilityReviewComplete: z.boolean(),
    hostedRecoveryPurgeAndRollbackDrillsComplete: z.boolean(),
    externalBetaApproved: z.boolean(),
  }).strict(),
  evidenceReferences: referenceList,
  reviewers: z.array(reviewerSchema).max(8),
}).strict()

const finalReviewSchema = z.object({
  assertions: z.object({
    fourQuestionsAccepted: z.boolean(),
    knownLimitationsAccepted: z.boolean(),
    rollbackPathAccepted: z.boolean(),
    noRealTransactionBoundaryAccepted: z.boolean(),
  }).strict(),
  acceptedGateDecisions: z.object({ G6: z.boolean(), G7: z.boolean(), G9: z.boolean() }).strict(),
  evidenceReferences: referenceList,
  reviewer: reviewerSchema,
}).strict()

export const externalReviewResponseSchema = z.object({
  schemaVersion: z.literal(1),
  bundle: z.object({
    runId: z.string().max(100),
    appVersion: z.string().max(100),
    manifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict(),
  gateReviews: z.object({ G6: g6ReviewSchema, G7: g7ReviewSchema, G9: g9ReviewSchema }).strict(),
  finalReview: finalReviewSchema,
}).strict()

const bundleManifestSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string(),
  generatedAt: z.string(),
  appVersion: z.string(),
  containsUserPlanData: z.literal(false),
  invariants: z.object({
    sharingDeferredToP9: z.literal(true),
    humanApprovalRequired: z.literal(true),
    noRealTrading: z.literal(true),
  }).passthrough(),
}).passthrough()

export type ExternalReviewResponse = z.infer<typeof externalReviewResponseSchema>
export type BundleManifest = z.infer<typeof bundleManifestSchema>

export interface ReviewEvidenceIssue {
  code: string
  path: string
  message: string
}

export interface ReviewEvidenceEvaluation {
  structurallyValid: boolean
  releaseReady: boolean
  gateStatus: Record<ExternalGateId | 'final', EffectiveGateStatus>
  issues: ReviewEvidenceIssue[]
  response: ExternalReviewResponse | null
}

const requiredRoles: Record<ExternalGateId, ReviewerRole[]> = {
  G6: ['thai-financial-tax-expert', 'product-owner'],
  G7: ['licensed-data-provider-owner', 'security-privacy-reviewer', 'product-owner'],
  G9: ['security-privacy-reviewer', 'accessibility-reviewer', 'incident-owner', 'product-owner'],
}

function blankReviewer(role: ReviewerRole): ExternalReviewResponse['gateReviews']['G6']['reviewers'][number] {
  return {
    name: '', role, organization: '', reviewedAt: '', expiresAt: null, decision: 'pending', findings: [], requiredChanges: [],
    residualRisks: [], conditions: [], signatureReference: '',
  }
}

export function buildExternalReviewResponseTemplate(manifest: BundleManifest, manifestSha256: string): ExternalReviewResponse {
  return {
    schemaVersion: 1,
    bundle: { runId: manifest.runId, appVersion: manifest.appVersion, manifestSha256 },
    gateReviews: {
      G6: {
        assertions: { fixtureDispositionComplete: false, disclaimerAndScopeApproved: false, taxYearAndSourcesApproved: false },
        evidenceReferences: [], reviewers: requiredRoles.G6.map(blankReviewer),
      },
      G7: {
        assertions: { realAccountReconciliationComplete: false, legalAndLicensingApproved: false, displayRetentionAndAttributionRightsApproved: false },
        evidenceReferences: [], reviewers: requiredRoles.G7.map(blankReviewer),
      },
      G9: {
        assertions: { independentThreatAndPrivacyReviewComplete: false, prioritySafariMatrixComplete: false, manualAccessibilityReviewComplete: false, hostedRecoveryPurgeAndRollbackDrillsComplete: false, externalBetaApproved: false },
        evidenceReferences: [], reviewers: requiredRoles.G9.map(blankReviewer),
      },
    },
    finalReview: {
      assertions: { fourQuestionsAccepted: false, knownLimitationsAccepted: false, rollbackPathAccepted: false, noRealTransactionBoundaryAccepted: false },
      acceptedGateDecisions: { G6: false, G7: false, G9: false },
      evidenceReferences: [], reviewer: blankReviewer('product-owner'),
    },
  }
}

function addIssue(issues: ReviewEvidenceIssue[], code: string, path: string, message: string) {
  issues.push({ code, path, message })
}

function parseReviewDate(value: string, path: string, bundleDate: number, now: number, issues: ReviewEvidenceIssue[]) {
  const parsed = Date.parse(value)
  if (!value || !Number.isFinite(parsed)) {
    addIssue(issues, 'invalid-review-date', path, 'Review date must be a valid ISO date.')
    return null
  }
  if (parsed < bundleDate) addIssue(issues, 'review-predates-bundle', path, 'Review cannot predate the evidence bundle.')
  if (parsed > now + 5 * 60_000) addIssue(issues, 'future-review-date', path, 'Review date cannot be in the future.')
  return parsed
}

function evaluateReviewer(
  reviewer: ExternalReviewResponse['gateReviews']['G6']['reviewers'][number],
  path: string,
  bundleDate: number,
  now: number,
  issues: ReviewEvidenceIssue[],
) {
  if (reviewer.name.trim().length < 2) addIssue(issues, 'missing-reviewer-name', `${path}.name`, 'A named human reviewer is required.')
  if (reviewer.role !== 'product-owner' && reviewer.organization.trim().length < 2) addIssue(issues, 'missing-reviewer-organization', `${path}.organization`, 'External reviewer organization is required.')
  const reviewedAt = parseReviewDate(reviewer.reviewedAt, `${path}.reviewedAt`, bundleDate, now, issues)
  if (reviewer.expiresAt) {
    const expiry = Date.parse(reviewer.expiresAt)
    if (!Number.isFinite(expiry)) addIssue(issues, 'invalid-expiry', `${path}.expiresAt`, 'Expiry must be a valid ISO date or null.')
    else {
      if (reviewedAt !== null && expiry <= reviewedAt) addIssue(issues, 'expiry-before-review', `${path}.expiresAt`, 'Expiry must be after the review date.')
      if (expiry <= now) addIssue(issues, 'expired-review', `${path}.expiresAt`, 'Review evidence has expired.')
    }
  }
  if (reviewer.decision === 'pending') addIssue(issues, 'decision-pending', `${path}.decision`, 'Reviewer decision is still pending.')
  if (reviewer.decision !== 'pending' && reviewer.signatureReference.trim().length < 3) addIssue(issues, 'missing-signature-reference', `${path}.signatureReference`, 'A verifiable approval/signature reference is required.')
  if (reviewer.decision === 'approved' && reviewer.conditions.length) addIssue(issues, 'conditions-on-unconditional-approval', `${path}.conditions`, 'Use approved-with-conditions when conditions exist.')
  if (reviewer.decision === 'approved-with-conditions' && reviewer.conditions.length === 0) addIssue(issues, 'missing-conditions', `${path}.conditions`, 'Conditional approval must list at least one condition.')
  if (reviewer.decision === 'approved-with-conditions') reviewer.conditions.forEach((condition, index) => {
    const conditionPath = `${path}.conditions.${index}`
    if (!condition.id.trim() || !condition.description.trim()) addIssue(issues, 'incomplete-condition', conditionPath, 'Condition ID and description are required.')
    if (condition.status !== 'resolved' || !condition.acceptedByProductOwner || condition.evidenceReference.trim().length < 3) addIssue(issues, 'unresolved-condition', conditionPath, 'Every condition must be resolved, evidenced, and accepted by the Product Owner.')
    if (!condition.resolvedAt || !Number.isFinite(Date.parse(condition.resolvedAt)) || Date.parse(condition.resolvedAt) > now + 5 * 60_000) addIssue(issues, 'invalid-condition-resolution-date', `${conditionPath}.resolvedAt`, 'Resolved condition requires a valid non-future date.')
  })
}

function evaluateGate(
  gate: ExternalGateId,
  review: ExternalReviewResponse['gateReviews'][ExternalGateId],
  bundleDate: number,
  now: number,
  issues: ReviewEvidenceIssue[],
) {
  const gatePath = `gateReviews.${gate}`
  const issueStart = issues.length
  if (!Object.values(review.assertions).every(Boolean)) addIssue(issues, 'incomplete-gate-assertions', `${gatePath}.assertions`, 'Every required gate assertion must be confirmed by human evidence.')
  if (review.evidenceReferences.length === 0 || review.evidenceReferences.some((item) => item.trim().length < 3)) addIssue(issues, 'missing-gate-evidence', `${gatePath}.evidenceReferences`, 'At least one non-empty evidence reference is required.')

  const roles = new Map<ReviewerRole, number[]>()
  review.reviewers.forEach((reviewer, index) => {
    const indexes = roles.get(reviewer.role) ?? []
    indexes.push(index)
    roles.set(reviewer.role, indexes)
    if (!requiredRoles[gate].includes(reviewer.role)) addIssue(issues, 'unexpected-reviewer-role', `${gatePath}.reviewers.${index}.role`, `Role ${reviewer.role} is not accepted for ${gate}.`)
    evaluateReviewer(reviewer, `${gatePath}.reviewers.${index}`, bundleDate, now, issues)
  })
  for (const role of requiredRoles[gate]) {
    const indexes = roles.get(role) ?? []
    if (indexes.length === 0) addIssue(issues, 'missing-required-role', `${gatePath}.reviewers`, `${gate} requires role ${role}.`)
    if (indexes.length > 1) addIssue(issues, 'duplicate-reviewer-role', `${gatePath}.reviewers`, `${gate} contains duplicate role ${role}.`)
  }
  const named = review.reviewers.filter((item) => item.name.trim()).map((item) => item.name.trim().toLocaleLowerCase('en-US'))
  if (new Set(named).size !== named.length) addIssue(issues, 'reviewer-role-separation', `${gatePath}.reviewers`, 'Required gate roles must be held by distinct named people.')

  if (review.reviewers.some((item) => item.decision === 'rejected')) return { rawStatus: 'rejected' as const, approved: false }
  if (review.reviewers.some((item) => item.decision === 'approved-with-conditions') && issues.slice(issueStart).some((item) => item.code.includes('condition'))) return { rawStatus: 'conditional' as const, approved: false }
  const approved = issues.length === issueStart && review.reviewers.length === requiredRoles[gate].length && review.reviewers.every((item) => item.decision === 'approved' || item.decision === 'approved-with-conditions')
  return { rawStatus: approved ? 'approved' as const : 'pending' as const, approved }
}

export function evaluateExternalReviewResponse(
  input: unknown,
  manifestInput: unknown,
  actualManifestSha256: string,
  now = new Date(),
): ReviewEvidenceEvaluation {
  const emptyStatus: ReviewEvidenceEvaluation['gateStatus'] = { G6: 'invalid', G7: 'invalid', G9: 'invalid', final: 'invalid' }
  const responseResult = externalReviewResponseSchema.safeParse(input)
  const manifestResult = bundleManifestSchema.safeParse(manifestInput)
  if (!responseResult.success || !manifestResult.success) {
    const issues: ReviewEvidenceIssue[] = []
    for (const issue of [...(responseResult.success ? [] : responseResult.error.issues), ...(manifestResult.success ? [] : manifestResult.error.issues)]) addIssue(issues, 'schema-invalid', issue.path.join('.'), issue.message)
    return { structurallyValid: false, releaseReady: false, gateStatus: emptyStatus, issues, response: null }
  }

  const response = responseResult.data
  const manifest = manifestResult.data
  const issues: ReviewEvidenceIssue[] = []
  if (response.bundle.runId !== manifest.runId) addIssue(issues, 'bundle-run-mismatch', 'bundle.runId', 'Response does not match this bundle run ID.')
  if (response.bundle.appVersion !== manifest.appVersion) addIssue(issues, 'bundle-version-mismatch', 'bundle.appVersion', 'Response does not match this app version.')
  if (response.bundle.manifestSha256 !== actualManifestSha256) addIssue(issues, 'manifest-hash-mismatch', 'bundle.manifestSha256', 'Response is not anchored to the current manifest bytes.')
  const bundleDate = Date.parse(manifest.generatedAt)
  if (!Number.isFinite(bundleDate)) addIssue(issues, 'invalid-bundle-date', 'manifest.generatedAt', 'Bundle generation date is invalid.')

  const nowMs = now.getTime()
  const g6 = evaluateGate('G6', response.gateReviews.G6, bundleDate, nowMs, issues)
  const g7 = evaluateGate('G7', response.gateReviews.G7, bundleDate, nowMs, issues)
  const g9 = evaluateGate('G9', response.gateReviews.G9, bundleDate, nowMs, issues)
  const gateStatus: ReviewEvidenceEvaluation['gateStatus'] = { G6: g6.rawStatus, G7: g7.rawStatus, G9: g9.rawStatus, final: 'pending' }
  if (g7.approved && !g6.approved) gateStatus.G7 = 'blocked-by-dependency'
  if (g9.approved && !(g6.approved && g7.approved)) gateStatus.G9 = 'blocked-by-dependency'

  const finalStart = issues.length
  const finalPath = 'finalReview'
  if (!Object.values(response.finalReview.assertions).every(Boolean)) addIssue(issues, 'incomplete-final-assertions', `${finalPath}.assertions`, 'All four Product Acceptance assertions must be confirmed.')
  if (!Object.values(response.finalReview.acceptedGateDecisions).every(Boolean)) addIssue(issues, 'gate-decisions-not-accepted', `${finalPath}.acceptedGateDecisions`, 'Product Owner must explicitly accept G6, G7, and G9 decisions.')
  if (response.finalReview.evidenceReferences.length === 0 || response.finalReview.evidenceReferences.some((item) => item.trim().length < 3)) addIssue(issues, 'missing-final-evidence', `${finalPath}.evidenceReferences`, 'Final review requires evidence references.')
  if (response.finalReview.reviewer.role !== 'product-owner') addIssue(issues, 'invalid-final-reviewer-role', `${finalPath}.reviewer.role`, 'Final review must be signed by the Product Owner.')
  evaluateReviewer(response.finalReview.reviewer, `${finalPath}.reviewer`, bundleDate, nowMs, issues)

  const productOwnerNames = [...gateIds.map((gate) => response.gateReviews[gate].reviewers.find((item) => item.role === 'product-owner')?.name.trim().toLocaleLowerCase('en-US') ?? ''), response.finalReview.reviewer.name.trim().toLocaleLowerCase('en-US')]
  if (productOwnerNames.some((name) => !name) || new Set(productOwnerNames).size !== 1) addIssue(issues, 'product-owner-identity-mismatch', 'finalReview.reviewer.name', 'The same named Product Owner must accept every gate and the Final review.')

  const finalReviewerApproved = response.finalReview.reviewer.decision === 'approved' || response.finalReview.reviewer.decision === 'approved-with-conditions'
  const prerequisitesApproved = g6.approved && g7.approved && g9.approved
  if (response.finalReview.reviewer.decision === 'rejected') gateStatus.final = 'rejected'
  else if (issues.slice(finalStart).some((item) => item.code.includes('condition'))) gateStatus.final = 'conditional'
  else if (!prerequisitesApproved && finalReviewerApproved && issues.length === finalStart) gateStatus.final = 'blocked-by-dependency'
  else if (prerequisitesApproved && finalReviewerApproved && issues.length === finalStart) gateStatus.final = 'approved'

  return { structurallyValid: true, releaseReady: gateStatus.final === 'approved' && issues.length === 0, gateStatus, issues, response }
}
