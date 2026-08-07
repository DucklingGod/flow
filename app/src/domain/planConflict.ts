import { PlanSchema, type WealthPlan } from './schema'

export const planSectionIds = ['identity', 'projection', 'wealth', 'life', 'portfolio', 'scenario', 'retirement', 'protection', 'tax', 'legacy', 'reviews'] as const
export type PlanSectionId = typeof planSectionIds[number]
export type PlanSectionChoice = 'current' | 'incoming'

const sectionKeys = {
  identity: ['name'],
  projection: ['scenario', 'investmentMode', 'contributionTiming', 'dividendMode', 'initialInvestment', 'monthlyContribution', 'years', 'expectedReturn', 'dividendYield', 'dividendTaxRate', 'annualFee', 'inflation', 'foreignAllocation', 'fxAnnualChange', 'depositRate', 'depositInterestTaxRate', 'irregularCashFlows', 'targetAmount', 'calculationModel'],
  wealth: ['netWorth', 'accounts', 'cashFlows', 'cashFlowHistory', 'debts', 'debtExtraPayment', 'netWorthHistory'],
  life: ['householdMembers', 'goals', 'monthlyGoalBudget'],
  portfolio: ['portfolioAccounts', 'holdings', 'transactions', 'investmentPolicy', 'benchmark'],
  scenario: ['simulationConfig'],
  retirement: ['retirementConfig'],
  protection: ['protectionConfig'],
  tax: ['taxProfile'],
  legacy: ['legacyConfig'],
  reviews: ['copilotConfig', 'wealthReviewConfig'],
} as const satisfies Record<PlanSectionId, readonly (keyof WealthPlan)[]>

export const planSectionLabels: Record<PlanSectionId, string> = {
  identity: 'ชื่อแผน', projection: 'สมมติฐานการเติบโต', wealth: 'Wealth Map และหนี้', life: 'สมาชิกและเป้าหมาย', portfolio: 'พอร์ตและธุรกรรม', scenario: 'Scenario Studio', retirement: 'Retirement', protection: 'Protection', tax: 'Tax', legacy: 'Family & Legacy', reviews: 'Reviews และ Copilot',
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).toSorted(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  return JSON.stringify(value)
}

function digest(value: unknown) {
  const text = canonical(value)
  let hash = 2_166_136_261
  for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16_777_619) }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function sectionValue(plan: WealthPlan, section: PlanSectionId) {
  return Object.fromEntries(sectionKeys[section].map((key) => [key, plan[key]]))
}

function summary(plan: WealthPlan, section: PlanSectionId) {
  switch (section) {
    case 'identity': return plan.name
    case 'projection': return `${plan.years} ปี · ${plan.expectedReturn}% · ${plan.monthlyContribution.toLocaleString('th-TH')} บาท/เดือน · ${plan.calculationModel.version}`
    case 'wealth': return `${plan.accounts.length} บัญชี · ${plan.debts.length} หนี้ · ${plan.cashFlows.length} cash flows`
    case 'life': return `${plan.householdMembers.length} สมาชิก · ${plan.goals.length} เป้าหมาย`
    case 'portfolio': return `${plan.holdings.length} holdings · ${plan.transactions.length} transactions`
    case 'scenario': return `${plan.simulationConfig.simulations.toLocaleString('th-TH')} paths · seed ${plan.simulationConfig.seed}`
    case 'retirement': return `อายุ ${plan.retirementConfig.currentAge} → ${plan.retirementConfig.retirementAge} · ${plan.retirementConfig.incomeSources.length} รายได้`
    case 'protection': return `${plan.protectionConfig.enabled ? 'เปิด estimate' : 'ปิด'} · review ${plan.protectionConfig.expertReviewStatus}`
    case 'tax': return `ปี ${plan.taxProfile.taxYear} · ${plan.taxProfile.enabled ? 'เปิด estimate' : 'ปิด'} · ${plan.taxProfile.datasetVersion}`
    case 'legacy': return `${plan.legacyConfig.items.length} checklist items`
    case 'reviews': return `${plan.wealthReviewConfig.actions.length} actions · ${plan.wealthReviewConfig.journal.length} journal · ${plan.copilotConfig.recommendations.length} recommendations`
  }
}

export interface PlanSectionDiff {
  id: PlanSectionId
  label: string
  changed: boolean
  currentDigest: string
  incomingDigest: string
  currentSummary: string
  incomingSummary: string
}

export function diffPlanSections(current: WealthPlan, incoming: WealthPlan): PlanSectionDiff[] {
  return planSectionIds.map((id) => {
    const currentDigest = digest(sectionValue(current, id))
    const incomingDigest = digest(sectionValue(incoming, id))
    return { id, label: planSectionLabels[id], changed: currentDigest !== incomingDigest, currentDigest, incomingDigest, currentSummary: summary(current, id), incomingSummary: summary(incoming, id) }
  })
}

export function validatePlanReferences(plan: WealthPlan) {
  const issues: string[] = []
  const accountIds = new Set(plan.accounts.map((item) => item.id))
  const memberIds = new Set(plan.householdMembers.map((item) => item.id))
  const portfolioAccountIds = new Set(plan.portfolioAccounts.map((item) => item.id))
  const holdingIds = new Set(plan.holdings.map((item) => item.id))
  for (const goal of plan.goals) {
    if (goal.fundingAccountId && !accountIds.has(goal.fundingAccountId)) issues.push(`เป้าหมาย “${goal.name}” อ้างบัญชีที่ไม่มี`)
    if (goal.memberId && !memberIds.has(goal.memberId)) issues.push(`เป้าหมาย “${goal.name}” อ้างสมาชิกที่ไม่มี`)
  }
  for (const accountId of plan.retirementConfig.fundingAccountIds) if (!accountIds.has(accountId)) issues.push(`Retirement อ้างบัญชี ${accountId} ที่ไม่มี`)
  for (const holding of plan.holdings) if (!portfolioAccountIds.has(holding.accountId)) issues.push(`Holding ${holding.symbol} อ้าง portfolio account ที่ไม่มี`)
  for (const transaction of plan.transactions) {
    if (!portfolioAccountIds.has(transaction.accountId)) issues.push(`Transaction ${transaction.id} อ้าง portfolio account ที่ไม่มี`)
    if (transaction.holdingId && !holdingIds.has(transaction.holdingId)) issues.push(`Transaction ${transaction.id} อ้าง holding ที่ไม่มี`)
  }
  for (const item of plan.legacyConfig.items) if (item.ownerMemberId && !memberIds.has(item.ownerMemberId)) issues.push(`Legacy item “${item.title}” อ้างสมาชิกที่ไม่มี`)
  return [...new Set(issues)]
}

export function resolvePlanSections(current: WealthPlan, incoming: WealthPlan, choices: Partial<Record<PlanSectionId, PlanSectionChoice>>, now = new Date()) {
  const candidate: WealthPlan = JSON.parse(JSON.stringify(current))
  for (const section of planSectionIds) {
    if (choices[section] !== 'incoming') continue
    for (const key of sectionKeys[section]) (candidate as unknown as Record<string, unknown>)[key] = JSON.parse(JSON.stringify(incoming[key]))
  }
  candidate.updatedAt = now.toISOString()
  const parsed = PlanSchema.safeParse(candidate)
  if (!parsed.success) return { plan: current, issues: ['ข้อมูลที่รวมกันไม่ผ่าน schema ปัจจุบัน'] }
  return { plan: parsed.data, issues: validatePlanReferences(parsed.data) }
}
