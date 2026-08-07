import { describe, expect, it } from 'vitest'
import { defaultPlan, type RetirementConfig, type WealthPlan } from './schema'
import { calculateRetirement } from './retirement'

const plan = (patch: Partial<RetirementConfig>, planPatch: Partial<WealthPlan> = {}): WealthPlan => ({
  ...defaultPlan,
  ...planPatch,
  retirementConfig: { ...defaultPlan.retirementConfig, ...patch },
})

describe('retirement cash-flow engine', () => {
  it('separates accumulation capital from retirement cash flow through age 100', () => {
    const result = calculateRetirement(defaultPlan)
    expect(result.currentSavings).toBe(1_860_000)
    expect(result.capitalAtRetirement).toBeGreaterThan(result.currentSavings)
    expect(result.points[0].phase).toBe('accumulation')
    expect(result.points.at(-1)?.age).toBe(100)
    expect(result.requiredCapitalAtRetirement).toBeGreaterThan(0)
  })

  it('counts one-time income once and does not mix it with recurring income', () => {
    const source = { id: 'pvd', name: 'PVD', type: 'providentFund' as const, frequency: 'oneTime' as const, amount: 10_000, startAge: 60, endAge: null, inflationRate: 0, taxablePercent: 0, sourceNote: '' }
    const result = calculateRetirement(plan({ currentAge: 59, retirementAge: 60, maxAge: 61, fundingAccountIds: ['cash-main'], monthlyContribution: 0, preRetirementReturn: 0, postRetirementReturn: 0, glidePathStartEquity: 50, glidePathEndEquity: 50, monthlyLivingExpenseToday: 0, monthlyHealthcareToday: 0, legacyTargetToday: 0, incomeSources: [source] }, { accounts: [{ id: 'cash-main', name: 'cash', type: 'cash', balance: 100_000, currency: 'THB' }] }))
    const retirementYears = result.points.filter((point) => point.phase === 'retirement')
    expect(retirementYears[0].oneTimeIncome).toBe(10_000)
    expect(retirementYears[1].oneTimeIncome).toBe(0)
    expect(retirementYears[0].recurringIncome).toBe(0)
    expect(result.legacyAtMaxAge).toBeCloseTo(110_000, 6)
  })

  it('deduplicates repeated income IDs rather than silently double-counting them', () => {
    const source = { id: 'same', name: 'บำนาญ', type: 'pension' as const, frequency: 'monthly' as const, amount: 1_000, startAge: 60, endAge: 60, inflationRate: 0, taxablePercent: 0, sourceNote: '' }
    const result = calculateRetirement(plan({ currentAge: 59, retirementAge: 60, maxAge: 61, incomeSources: [source, { ...source, amount: 99_000 }] }))
    const age60 = result.points.find((point) => point.age === 60 && point.phase === 'retirement')
    expect(age60?.recurringIncome).toBe(12_000)
    expect(result.duplicateIncomeIds).toEqual(['same'])
    expect(result.warnings.some((warning) => warning.includes('ID ซ้ำ'))).toBe(true)
  })

  it('reports the first unmet year and depletion instead of allowing a negative balance', () => {
    const result = calculateRetirement(plan({ currentAge: 59, retirementAge: 60, maxAge: 65, fundingAccountIds: ['tiny'], monthlyContribution: 0, preRetirementReturn: 0, postRetirementReturn: 0, monthlyLivingExpenseToday: 50_000, monthlyHealthcareToday: 0, incomeSources: [], withdrawalStrategy: 'fixedReal', legacyTargetToday: 0 }, { accounts: [{ id: 'tiny', name: 'tiny', type: 'investment', balance: 100_000, currency: 'THB' }] }))
    expect(result.firstUnmetAge).toBe(60)
    expect(result.depletionAge).toBe(60)
    expect(result.points.every((point) => point.endingBalance >= 0)).toBe(true)
  })

  it('increases retirement capital when contributions rise', () => {
    const low = calculateRetirement(plan({ monthlyContribution: 0 }))
    const high = calculateRetirement(plan({ monthlyContribution: 30_000 }))
    expect(high.capitalAtRetirement).toBeGreaterThan(low.capitalAtRetirement)
    expect(high.fundingGapAtRetirement).toBeLessThanOrEqual(low.fundingGapAtRetirement)
  })

  it('supports all withdrawal strategies with finite, auditable yearly rows', () => {
    for (const withdrawalStrategy of ['fixedReal', 'percentage', 'guardrails', 'bucket'] as const) {
      const result = calculateRetirement(plan({ withdrawalStrategy, maxAge: 75 }))
      expect(result.points.length).toBeGreaterThan(20)
      expect(result.points.every((point) => Number.isFinite(point.endingBalance))).toBe(true)
      expect(result.totalWithdrawals).toBeGreaterThanOrEqual(0)
    }
  })
})
