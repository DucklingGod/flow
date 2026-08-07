import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'

const rootDir = path.resolve('..')
const runId = new Date().toISOString().replaceAll(/[:.]/g, '-')
const generatedAt = new Date().toISOString()
const outputDir = path.resolve('work', 'external-review', runId)
await mkdir(outputDir, { recursive: true })

const packageJson = JSON.parse(await readFile(path.resolve('package.json'), 'utf8'))
const vite = await createServer({ root: path.resolve('.'), logLevel: 'silent', appType: 'custom', server: { middlewareMode: true } })

let defaultPlan
let calculateTax
let TAX_DATASETS
let calculateProtection
let calculateRetirement
let buildPlanningContext
let buildExternalReviewResponseTemplate
let evaluateExternalReviewResponse
try {
  ;({ defaultPlan } = await vite.ssrLoadModule('/src/domain/schema.ts'))
  ;({ calculateTax, TAX_DATASETS } = await vite.ssrLoadModule('/src/domain/tax.ts'))
  ;({ calculateProtection } = await vite.ssrLoadModule('/src/domain/protection.ts'))
  ;({ calculateRetirement } = await vite.ssrLoadModule('/src/domain/retirement.ts'))
  ;({ buildPlanningContext } = await vite.ssrLoadModule('/src/domain/copilot.ts'))
  ;({ buildExternalReviewResponseTemplate, evaluateExternalReviewResponse } = await vite.ssrLoadModule('/src/domain/reviewEvidence.ts'))
} finally {
  await vite.close()
}

function selectTax(result) {
  return {
    status: result.status,
    datasetVersion: result.dataset?.version ?? null,
    grossIncome: result.grossIncome,
    employmentExpense: result.employmentExpense,
    totalAllowancesBeforeDonation: result.totalAllowancesBeforeDonation,
    donationAllowance: result.donationAllowance,
    taxableIncome: result.taxableIncome,
    taxBeforeWithholding: result.taxBeforeWithholding,
    withholdingTax: result.withholdingTax,
    taxPayable: result.taxPayable,
    estimatedRefund: result.estimatedRefund,
    marginalRate: result.marginalRate,
    effectiveRate: result.effectiveRate,
    eligible: result.eligible,
    remainingRoom: result.remainingRoom,
    warningCount: result.warnings.length,
  }
}

function selectProtection(result) {
  return {
    monthlyIncome: result.monthlyIncome,
    monthlyExpense: result.monthlyExpense,
    availableEmergencyCash: result.availableEmergencyCash,
    emergencyReserveTarget: result.emergencyReserveTarget,
    emergencyReserveGap: result.emergencyReserveGap,
    debtPayoffNeed: result.debtPayoffNeed,
    incomeReplacementNeed: result.incomeReplacementNeed,
    educationNeed: result.educationNeed,
    finalExpenseNeed: result.finalExpenseNeed,
    lifeCoverageNeed: result.lifeCoverageNeed,
    lifeCoverageGap: result.lifeCoverageGap,
    healthAnnualTarget: result.healthAnnualTarget,
    healthAnnualGap: result.healthAnnualGap,
    disabilityMonthlyTarget: result.disabilityMonthlyTarget,
    disabilityMonthlyGap: result.disabilityMonthlyGap,
    dependantCount: result.dependantCount,
    duplicateDebtIds: result.duplicateDebtIds,
    warningCount: result.warnings.length,
  }
}

function selectRetirement(result) {
  return {
    currentSavings: result.currentSavings,
    capitalAtRetirement: result.capitalAtRetirement,
    requiredCapitalAtRetirement: result.requiredCapitalAtRetirement,
    fundingGapAtRetirement: result.fundingGapAtRetirement,
    firstUnmetAge: result.firstUnmetAge,
    depletionAge: result.depletionAge,
    legacyAtMaxAge: result.legacyAtMaxAge,
    totalWithdrawals: result.totalWithdrawals,
    pointCount: result.points.length,
    lastAge: result.points.at(-1)?.age ?? null,
    duplicateIncomeIds: result.duplicateIncomeIds,
    warningCount: result.warnings.length,
  }
}

const taxDataset = TAX_DATASETS[2025]
const enabledTax = (overrides = {}) => ({ ...defaultPlan.taxProfile, enabled: true, datasetVersion: taxDataset.version, ...overrides })
const specialistConsent = { netWorth: false, goals: false, portfolio: false, retirement: false, protection: true, tax: true }
const lockedSpecialistContext = buildPlanningContext(defaultPlan, specialistConsent, new Date(generatedAt))
const taxFixtures = [
  { id: 'TAX-01', purpose: 'Disabled-by-default boundary', inputs: { enabled: false, taxYear: defaultPlan.taxProfile.taxYear }, expected: { status: calculateTax(defaultPlan.taxProfile).status, copilotContext: lockedSpecialistContext.tax } },
  { id: 'TAX-02', purpose: 'Salary expense and progressive brackets', inputs: { employmentIncome: 1_104_000, otherTaxableIncome: 0 }, expected: selectTax(calculateTax(enabledTax({ employmentIncome: 1_104_000, otherTaxableIncome: 0 }))) },
  { id: 'TAX-03', purpose: 'Contribution and insurance caps', inputs: { employmentIncome: 2_000_000, socialSecurityContribution: 20_000, providentFundContribution: 450_000, rmfContribution: 400_000, thaiEsgContribution: 900_000, lifeInsurancePremium: 100_000, healthInsurancePremium: 25_000 }, expected: selectTax(calculateTax(enabledTax({ employmentIncome: 2_000_000, socialSecurityContribution: 20_000, providentFundContribution: 450_000, rmfContribution: 400_000, thaiEsgContribution: 900_000, lifeInsurancePremium: 100_000, healthInsurancePremium: 25_000 }))) },
  { id: 'TAX-04', purpose: 'Donation cap after other allowances', inputs: { employmentIncome: 800_000, donations: 1_000_000 }, expected: selectTax(calculateTax(enabledTax({ employmentIncome: 800_000, donations: 1_000_000 }))) },
  { id: 'TAX-05', purpose: 'Spouse, children, and parents', inputs: { employmentIncome: 1_500_000, spouseAllowance: true, childCount: 2, parentAllowanceCount: 2 }, expected: selectTax(calculateTax(enabledTax({ employmentIncome: 1_500_000, spouseAllowance: true, childCount: 2, parentAllowanceCount: 2 }))) },
  { id: 'TAX-06', purpose: 'Withholding cannot create negative payable tax', inputs: { employmentIncome: 300_000, withholdingTax: 50_000 }, expected: selectTax(calculateTax(enabledTax({ employmentIncome: 300_000, withholdingTax: 50_000 }))) },
  { id: 'TAX-07', purpose: 'Unsupported tax year fails closed', inputs: { enabled: true, taxYear: 2026 }, expected: selectTax(calculateTax({ ...defaultPlan.taxProfile, enabled: true, taxYear: 2026 })) },
]

const dependantPlan = structuredClone(defaultPlan)
dependantPlan.protectionConfig = { ...dependantPlan.protectionConfig, dependantCount: 2, incomeReplacementYears: 8, incomeReplacementPercent: 60 }
const overinsuredPlan = structuredClone(defaultPlan)
overinsuredPlan.protectionConfig = { ...overinsuredPlan.protectionConfig, existingLifeCover: 100_000_000, existingHealthAnnualLimit: 2_000_000, existingDisabilityMonthlyBenefit: 100_000 }
const duplicateDebtPlan = structuredClone(defaultPlan)
duplicateDebtPlan.debts = [duplicateDebtPlan.debts[0], { ...duplicateDebtPlan.debts[0] }]
const protectionFixtures = [
  { id: 'PROTECTION-01', purpose: 'Separate emergency/life/health/disability needs', inputs: { dataset: 'synthetic default plan' }, expected: selectProtection(calculateProtection(defaultPlan)) },
  { id: 'PROTECTION-02', purpose: 'Income replacement only with dependants', inputs: { dependantCount: 2, incomeReplacementYears: 8, incomeReplacementPercent: 60 }, expected: selectProtection(calculateProtection(dependantPlan)) },
  { id: 'PROTECTION-03', purpose: 'Existing cover cannot produce negative gaps', inputs: { existingLifeCover: 100_000_000, existingHealthAnnualLimit: 2_000_000, existingDisabilityMonthlyBenefit: 100_000 }, expected: selectProtection(calculateProtection(overinsuredPlan)) },
  { id: 'PROTECTION-04', purpose: 'Duplicate debt IDs are not double-counted', inputs: { duplicatedDebtId: duplicateDebtPlan.debts[0].id }, expected: selectProtection(calculateProtection(duplicateDebtPlan)) },
]

const oneTimeIncome = { id: 'pvd-review', name: 'Synthetic PVD', type: 'providentFund', frequency: 'oneTime', amount: 10_000, startAge: 60, endAge: null, inflationRate: 0, taxablePercent: 0, sourceNote: 'synthetic review fixture' }
const oneTimePlan = structuredClone(defaultPlan)
oneTimePlan.accounts = [{ id: 'review-cash', name: 'Synthetic cash', type: 'cash', balance: 100_000, currency: 'THB' }]
oneTimePlan.retirementConfig = { ...oneTimePlan.retirementConfig, currentAge: 59, retirementAge: 60, maxAge: 61, fundingAccountIds: ['review-cash'], monthlyContribution: 0, preRetirementReturn: 0, postRetirementReturn: 0, glidePathStartEquity: 50, glidePathEndEquity: 50, monthlyLivingExpenseToday: 0, monthlyHealthcareToday: 0, legacyTargetToday: 0, incomeSources: [oneTimeIncome] }
const oneTimeResult = calculateRetirement(oneTimePlan)
const depletionPlan = structuredClone(defaultPlan)
depletionPlan.accounts = [{ id: 'review-tiny', name: 'Synthetic investment', type: 'investment', balance: 100_000, currency: 'THB' }]
depletionPlan.retirementConfig = { ...depletionPlan.retirementConfig, currentAge: 59, retirementAge: 60, maxAge: 65, fundingAccountIds: ['review-tiny'], monthlyContribution: 0, preRetirementReturn: 0, postRetirementReturn: 0, monthlyLivingExpenseToday: 50_000, monthlyHealthcareToday: 0, incomeSources: [], withdrawalStrategy: 'fixedReal', legacyTargetToday: 0 }
const retirementFixtures = [
  { id: 'RETIREMENT-01', purpose: 'Current plan accumulation and retirement run through max age', inputs: { dataset: 'synthetic default plan' }, expected: selectRetirement(calculateRetirement(defaultPlan)) },
  { id: 'RETIREMENT-02', purpose: 'One-time income is counted once', inputs: { currentAge: 59, retirementAge: 60, maxAge: 61, openingCapital: 100_000, oneTimeIncome: 10_000, returns: 0, expenses: 0 }, expected: { ...selectRetirement(oneTimeResult), annualRows: oneTimeResult.points.filter((point) => point.phase === 'retirement').map((point) => ({ age: point.age, oneTimeIncome: point.oneTimeIncome, recurringIncome: point.recurringIncome, endingBalance: point.endingBalance })) } },
  { id: 'RETIREMENT-03', purpose: 'Shortfall is reported without a negative balance', inputs: { currentAge: 59, retirementAge: 60, maxAge: 65, openingCapital: 100_000, monthlyLivingExpenseToday: 50_000, returns: 0 }, expected: { ...selectRetirement(calculateRetirement(depletionPlan)), allEndingBalancesNonNegative: calculateRetirement(depletionPlan).points.every((point) => point.endingBalance >= 0) } },
]
const gateBoundaryFixtures = [
  { id: 'SPECIALIST-LOCK-01', purpose: 'Consent does not expose numeric Tax/Protection estimates while each studio is disabled', inputs: { consent: specialistConsent, taxEnabled: false, protectionEnabled: false }, expected: { tax: lockedSpecialistContext.tax, protection: lockedSpecialistContext.protection } },
]

const g6Fixtures = {
  schemaVersion: 1,
  generatedAt,
  appVersion: packageJson.version,
  classification: 'synthetic-test-data-only',
  gateDecision: 'pending-external-review',
  tolerancePolicy: { currencyTHB: 0.01, ratesPercentagePoints: 0.000001, retirementFloatingPoint: 0.000001 },
  sourceReviewBoundary: 'Public-source reconciliation is preliminary. A qualified Thai tax/financial reviewer must approve year applicability, eligibility, wording, and every expected result.',
  officialSources: taxDataset.sources,
  taxDataset: {
    taxYear: taxDataset.taxYear,
    version: taxDataset.version,
    status: taxDataset.status,
    constants: Object.fromEntries(Object.entries(taxDataset).filter(([key]) => !['sources', 'brackets'].includes(key))),
    brackets: taxDataset.brackets.map((bracket) => ({ upTo: Number.isFinite(bracket.upTo) ? bracket.upTo : null, rate: bracket.rate })),
  },
  fixtures: { gateBoundaries: gateBoundaryFixtures, tax: taxFixtures, protection: protectionFixtures, retirement: retirementFixtures },
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.resolve(relativePath), 'utf8'))
}

const axe = await readJson('work/accessibility/latest-report.json')
const axeSummary = { scans: 0, violations: 0, incomplete: 0, failures: axe.failures.length, engines: [] }
for (const engine of axe.engines) {
  axeSummary.engines.push({ engine: engine.engine, browserVersion: engine.browserVersion })
  for (const viewport of engine.viewports) for (const route of viewport.routes) {
    axeSummary.scans += 1
    axeSummary.violations += route.violations.length
    axeSummary.incomplete += route.incomplete.length
  }
}
const responsive = await readJson('work/responsive-accessibility/latest-report.json')
const responsiveSummary = {
  routeAudits: responsive.engines.reduce((total, item) => total + item.routes.length, 0),
  failures: responsive.failures.length,
  engines: [...new Set(responsive.engines.map((item) => `${item.engine} ${item.browserVersion}`))],
  profiles: responsive.profiles.map((profile) => profile.name),
}
const crossBrowser = await readJson('work/cross-browser/latest-report.json')
const webkitSummary = {
  reports: crossBrowser.reports.map((report) => ({ engine: report.engine, browserVersion: report.browserVersion, viewport: report.viewport, routeAudits: report.routeAudits.length, specialistContextLock: report.specialistContextLock, llmConnectorControls: report.llmConnectorControls, runtimeIssues: report.runtimeIssues, consoleIssues: report.consoleIssues, pageNetworkOrigins: report.pageNetworkOrigins })),
  failures: crossBrowser.failures.length,
}
const llmConnector = await readJson('work/llm-connectors/latest-report.json')
const llmConnectorSummary = {
  reports: llmConnector.reports.map((report) => ({ profile: report.profile, structuredItems: report.structuredItems, zdr: report.zdr, tools: report.tools, htmlExecuted: report.htmlExecuted, credentialSessionOnly: report.credentialSessionOnly, actualExternalRequest: report.actualExternalRequest })),
  failures: llmConnector.failures.length,
}
const acceptanceSnapshot = await readJson('work/acceptance-snapshot/latest-report.json')
const acceptanceSnapshotSummary = {
  reports: acceptanceSnapshot.reports.map((report) => ({ profile: report.profile, questions: report.questions, monthlyActions: report.monthlyActions, decision: report.decision, printablePacket: report.printablePacket, planMutation: report.planMutation, overflow: report.overflow, networkOrigins: report.networkOrigins })),
  failures: acceptanceSnapshot.failures.length,
}
const studioInteractions = await readJson('work/studio-interactions/latest-report.json')
const studioInteractionsSummary = {
  engine: studioInteractions.engine,
  reports: studioInteractions.reports.map((report) => ({
    profile: report.profile,
    chart: report.chart,
    numericInput: report.numericInput,
    routeAudits: report.routeAudits.length,
    nativeNumberInputs: report.routeAudits.reduce((total, route) => total + route.nativeNumberInputs, 0),
    overflowingRoutes: report.routeAudits.filter((route) => route.overflow).length,
    runtimeIssues: report.runtimeIssues.length,
    consoleIssues: report.consoleIssues.length,
    networkOrigins: report.networkOrigins,
  })),
  failures: studioInteractions.failures.length,
}
const criticalCandidates = []
for (const file of (await readdir(path.resolve('work', 'e2e'))).filter((name) => name.startsWith('latest-') && name.endsWith('-report.json'))) {
  const report = await readJson(path.join('work', 'e2e', file))
  if (!report.browserProduct || !report.viewport || !Array.isArray(report.accessibilityRoutes)) continue
  const fileInfo = await stat(path.resolve('work', 'e2e', file))
  const browserFamily = String(report.browserProduct).startsWith('Edg/') ? 'Edge' : 'Chrome'
  criticalCandidates.push({
    file,
    modifiedAt: fileInfo.mtime.toISOString(),
    browserFamily,
    browser: report.browser,
    browserProduct: report.browserProduct,
    viewport: report.viewport,
    routeAudits: report.accessibilityRoutes.length,
    runtimeIssues: report.runtimeIssues?.length ?? 0,
    consoleIssues: report.consoleIssues?.length ?? 0,
    pageNetworkOrigins: report.pageNetworkOrigins,
    overflow: report.restored?.overflow ?? null,
  })
}
criticalCandidates.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))
const criticalByFamilyViewport = new Map()
for (const item of criticalCandidates) {
  const key = `${item.browserFamily}:${item.viewport.width}x${item.viewport.height}`
  if (!criticalByFamilyViewport.has(key)) criticalByFamilyViewport.set(key, item)
}
const criticalJourneys = [...criticalByFamilyViewport.values()].filter((item) => ['1440x1000', '390x844'].includes(`${item.viewport.width}x${item.viewport.height}`))
if (axeSummary.scans < 60 || !['chrome', 'webkit'].every((engine) => axeSummary.engines.some((item) => item.engine === engine)) || axeSummary.violations || axeSummary.incomplete || axeSummary.failures) throw new Error(`Axe evidence is not release-clean: ${JSON.stringify(axeSummary)}`)
if (responsiveSummary.routeAudits < 104 || !['chrome ', 'webkit '].every((engine) => responsiveSummary.engines.some((item) => item.startsWith(engine))) || responsiveSummary.failures) throw new Error(`Responsive accessibility evidence is not release-clean: ${JSON.stringify(responsiveSummary)}`)
if (webkitSummary.reports.length !== 2 || webkitSummary.failures) throw new Error(`WebKit evidence is not release-clean: ${JSON.stringify(webkitSummary)}`)
if (llmConnectorSummary.reports.length !== 2 || llmConnectorSummary.failures || llmConnectorSummary.reports.some((report) => report.structuredItems < 2 || !report.zdr || report.tools || report.htmlExecuted || !report.credentialSessionOnly || report.actualExternalRequest)) throw new Error(`LLM connector UI evidence is not release-clean: ${JSON.stringify(llmConnectorSummary)}`)
if (acceptanceSnapshotSummary.reports.length !== 2 || acceptanceSnapshotSummary.failures || acceptanceSnapshotSummary.reports.some((report) => report.questions !== 4 || report.monthlyActions < 1 || report.decision !== 'pending' || !report.printablePacket || report.planMutation || report.overflow || report.networkOrigins.some((origin) => !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)))) throw new Error(`Acceptance snapshot evidence is not release-clean: ${JSON.stringify(acceptanceSnapshotSummary)}`)
if (studioInteractionsSummary.reports.length !== 2 || studioInteractionsSummary.failures || studioInteractionsSummary.reports.some((report) => report.routeAudits !== 13 || report.nativeNumberInputs || report.overflowingRoutes || report.runtimeIssues || report.consoleIssues || !report.chart.legendToggle || report.numericInput.sevenDigits !== '1,234,567' || report.numericInput.committed !== '22,000' || report.networkOrigins.some((origin) => !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)))) throw new Error(`Studio interaction evidence is not release-clean: ${JSON.stringify(studioInteractionsSummary)}`)
if (!['1440x1000', '390x844'].every((viewport) => criticalJourneys.some((item) => item.browserFamily === 'Chrome' && `${item.viewport.width}x${item.viewport.height}` === viewport))) throw new Error('Chrome desktop/mobile critical-journey evidence is missing')
if (criticalJourneys.some((item) => item.routeAudits !== 13 || item.runtimeIssues || item.consoleIssues || item.overflow)) throw new Error('Available Chrome/Edge critical-journey evidence is not release-clean')

const g9LocalEvidence = {
  schemaVersion: 1,
  generatedAt,
  appVersion: packageJson.version,
  classification: 'privacy-safe-aggregate-evidence',
  gateDecision: 'pending-external-review-and-hosted-implementation',
  automatedEvidence: { axe: axeSummary, responsiveAccessibility: responsiveSummary, webkitCriticalJourneys: webkitSummary, llmConnectorUiContract: llmConnectorSummary, productAcceptanceSnapshot: acceptanceSnapshotSummary, studioInteractions: studioInteractionsSummary, chromeEdgeCriticalJourneys: criticalJourneys },
  explicitNonEvidence: ['Safari browser', 'VoiceOver', 'NVDA', 'Narrator', 'TalkBack', ...(criticalJourneys.some((item) => item.browserFamily === 'Edge') ? [] : ['Edge browser']), 'independent threat/privacy review', 'hosted authentication/sync/purge/recovery drills', 'external beta approval'],
  productBoundaries: { sharingDeferredToP9: true, humanApprovalRequired: true, externalAiProductionRolloutEnabled: false, directLlmAdaptersDeveloperPreview: true, realTradingEnabled: false, transferOrPaymentEnabled: false, taxFilingEnabled: false },
}

const reviewFiles = [
  'PLAN.md', 'README.md', 'docs/ASSUMPTIONS.md', 'docs/DATA_SOURCES.md', 'docs/EXTERNAL_REVIEW_PACKETS.md',
  'docs/THREAT_MODEL.md', 'docs/SECURITY.md', 'docs/PRIVACY.md', 'docs/INCIDENT_RUNBOOK.md', 'docs/RELEASE_CHECKLIST.md', 'docs/KNOWN_LIMITATIONS.md',
  'docs/MANUAL_ACCESSIBILITY_PROTOCOL.md', 'app/src/domain/tax.ts', 'app/src/domain/tax.test.ts', 'app/src/domain/protection.ts',
  'app/src/domain/protection.test.ts', 'app/src/domain/retirement.ts', 'app/src/domain/retirement.test.ts', 'app/src/domain/llmConnector.ts',
  'app/src/domain/llmConnector.test.ts', 'app/src/domain/acceptanceSnapshot.ts', 'app/src/domain/acceptanceSnapshot.test.ts', 'app/src/components/WealthReviewStudio.tsx', '.github/workflows/ci.yml',
  'app/src/domain/reviewEvidence.ts', 'app/src/domain/reviewEvidence.test.ts', 'app/scripts/generate-external-review-bundle.mjs', 'app/scripts/verify-external-review-response.mjs',
  'app/scripts/review-evidence-integrity.mjs', 'app/scripts/review-evidence-integrity.test.mjs',
  'app/src/App.tsx', 'app/src/App.css', 'app/src/components/FormattedNumberInput.tsx', 'app/src/components/FormattedNumberInput.test.tsx',
  'app/src/components/ProjectionChart.tsx', 'app/src/components/ProjectionChart.test.tsx', 'app/src/components/numericInputInventory.test.ts', 'app/src/domain/numericFormatting.ts',
  'app/src/components/LifeCanvas.tsx', 'app/src/components/PortfolioStudio.tsx', 'app/src/components/ProtectionStudio.tsx', 'app/src/components/RetirementStudio.tsx',
  'app/src/components/ScenarioStudio.tsx', 'app/src/components/TaxStudio.tsx', 'app/src/components/WealthStudio.tsx', 'app/scripts/studio-interactions-e2e.mjs', 'app/vitest.config.ts',
  'docs/ADR-002-REMOTE-SECURITY-FOUNDATION.md', 'app/src/domain/syncEnvelope.ts', 'app/src/domain/syncEnvelope.test.ts', 'app/src/domain/syncQueue.ts', 'app/src/domain/syncQueue.test.ts', 'vercel.json',
  'app/src/data/planRepository.ts', 'app/src/data/planRepository.integration.test.ts', 'app/scripts/responsive-accessibility.mjs',
  'app/scripts/axe-accessibility.mjs',
]
const fileManifest = []
for (const relativePath of reviewFiles) {
  const bytes = await readFile(path.join(rootDir, relativePath))
  fileManifest.push({ path: relativePath.replaceAll('\\', '/'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
}

const g6Text = JSON.stringify(g6Fixtures, null, 2)
const g9Text = JSON.stringify(g9LocalEvidence, null, 2)
const g7Csv = [
  'review_id,provider,environment,data_kind,identifier,provider_value,official_reference_value,as_of,timezone,currency,share_class,distribution_mode,hedging,license_display_rights,license_retention_rights,attribution_required,http_case,result,difference,reviewer,reviewed_at,notes',
  ...['nav', 'price', 'fx', 'dividend', 'benchmark', 'factsheet', 'fee', 'deposit-rate', 'official-rule'].map((kind) => `G7-${kind.toUpperCase()},,,,,,,,,,,,,,,,,pending,,,,`),
].join('\r\n')
const evidenceArtifacts = [
  ['g6-fixtures.json', g6Text],
  ['g7-reconciliation-template.csv', g7Csv],
  ['g9-local-evidence.json', g9Text],
].map(([artifactPath, content]) => ({ path: artifactPath, bytes: Buffer.byteLength(content), sha256: createHash('sha256').update(content).digest('hex') }))

const manifest = {
  schemaVersion: 1,
  runId,
  generatedAt,
  appVersion: packageJson.version,
  classification: 'synthetic-and-aggregate-evidence-only',
  containsUserPlanData: false,
  gateStatus: { G6: 'pending-external-review', G7: 'pending-provider-reconciliation-and-licensing', G9: 'pending-external-hosted-and-manual-review', final: 'pending-product-owner' },
  invariants: { sharingDeferredToP9: true, humanApprovalRequired: true, noRealTrading: true },
  evidenceFiles: ['g6-fixtures.json', 'g7-reconciliation-template.csv', 'g9-local-evidence.json', 'REVIEW_RESPONSE.json', 'SIGN_OFF.md'],
  evidenceArtifacts,
  sourceFiles: fileManifest,
}
const manifestText = JSON.stringify(manifest, null, 2)
const manifestSha256 = createHash('sha256').update(manifestText).digest('hex')
const reviewResponseTemplate = buildExternalReviewResponseTemplate(manifest, manifestSha256)
const templateEvaluation = evaluateExternalReviewResponse(reviewResponseTemplate, manifest, manifestSha256, new Date(generatedAt))
if (!templateEvaluation.structurallyValid || templateEvaluation.releaseReady || Object.values(templateEvaluation.gateStatus).some((status) => status !== 'pending')) {
  throw new Error(`Generated review-response template is not fail-closed: ${JSON.stringify({ structurallyValid: templateEvaluation.structurallyValid, releaseReady: templateEvaluation.releaseReady, gateStatus: templateEvaluation.gateStatus })}`)
}

const signOff = `# External review sign-off\n\nThis template does not approve any gate until completed by the named external owner and accepted by PRODUCT.\n\n## Review identity\n\n- Gate: G6 / G7 / G9 / Final\n- Reviewer name:\n- Role and organization:\n- Date:\n- Bundle run ID: ${runId}\n- App version: ${packageJson.version}\n- Source archive or commit SHA:\n\n## Decision\n\n- Decision: approved / approved with conditions / rejected\n- Findings and issue IDs:\n- Required changes:\n- Residual risks:\n- Conditions and expiry/re-review date:\n- Signature or verifiable approval reference:\n\n## Product acceptance\n\n- Product owner:\n- Accepted decision and conditions: yes / no\n- Date:\n- Evidence reference:\n\nNo approval may enable sharing, live providers, external AI, trading, transfer/payment, tax filing, or silent portfolio mutation without the separate release controls and human approval required by PLAN.md.\n`

const bundleReadme = `# Flow Wealth Studio external review bundle\n\nGenerated: ${generatedAt}\nManifest SHA-256: ${manifestSha256}\n\nThis directory contains synthetic G6 calculation fixtures, an empty G7 provider reconciliation template, privacy-safe aggregate G9 browser evidence, hashes of the reviewed source files, a machine-checkable REVIEW_RESPONSE.json template, and a human-readable sign-off form. It contains no user plan, credential, backup, cookie, storage dump, or real provider response.\n\nGate decisions remain pending until each named independent reviewer and PRODUCT complete the response with evidence and verifiable signature references. The verifier checks structure, bundle/hash binding, role separation, dates/expiry, resolved conditions, and G6 -> G7 -> G9 -> Final dependencies; it does not authenticate a signature reference or enable any capability.\n\nVerify a completed copy with:\n\n\`npm.cmd run verify:external-review -- "<bundle-directory>" "<completed-response.json>"\`\n\nRun \`npm.cmd run evidence:external-review\` again after any calculation, source, disclaimer, provider-contract, security, or release-evidence change.\n`

await Promise.all([
  writeFile(path.join(outputDir, 'manifest.json'), manifestText),
  writeFile(path.join(outputDir, 'g6-fixtures.json'), g6Text),
  writeFile(path.join(outputDir, 'g7-reconciliation-template.csv'), g7Csv),
  writeFile(path.join(outputDir, 'g9-local-evidence.json'), g9Text),
  writeFile(path.join(outputDir, 'REVIEW_RESPONSE.json'), JSON.stringify(reviewResponseTemplate, null, 2)),
  writeFile(path.join(outputDir, 'SIGN_OFF.md'), signOff),
  writeFile(path.join(outputDir, 'README.md'), bundleReadme),
  writeFile(path.resolve('work', 'external-review', 'latest-manifest.json'), JSON.stringify(manifest, null, 2)),
])

console.log(JSON.stringify({ runId, outputDir, appVersion: packageJson.version, manifestSha256, g6Fixtures: gateBoundaryFixtures.length + taxFixtures.length + protectionFixtures.length + retirementFixtures.length, g7Rows: 9, g9: { axeScans: axeSummary.scans, responsiveRouteAudits: responsiveSummary.routeAudits, webkitReports: webkitSummary.reports.length, studioInteractionReports: studioInteractionsSummary.reports.length, chromeEdgeReports: criticalJourneys.length }, reviewResponse: { structurallyValid: templateEvaluation.structurallyValid, releaseReady: templateEvaluation.releaseReady, gateStatus: templateEvaluation.gateStatus }, gates: manifest.gateStatus }, null, 2))
