import { describe, expect, it } from 'vitest'
import { defaultPlan, migratePlan, parseImportablePlan, PlanSchema } from './schema'

describe('plan schema and migrations', () => {
  it('accepts the current default plan', () => {
    expect(PlanSchema.parse(defaultPlan)).toEqual(defaultPlan)
  })

  it('migrates a version 1 plan without losing user inputs', () => {
    const legacy = {
      id: 'primary-plan',
      version: 1,
      name: 'Legacy plan',
      updatedAt: '2026-01-01T00:00:00.000Z',
      scenario: 'bear',
      initialInvestment: 123_000,
      monthlyContribution: 4_500,
      years: 12,
      expectedReturn: 5,
      dividendYield: 2,
      annualFee: .7,
      inflation: 3,
      targetAmount: 3_000_000,
      netWorth: defaultPlan.netWorth,
    }
    const migrated = migratePlan(legacy)
    expect(migrated.version).toBe(10)
    expect(migrated.calculationModel.appliedBy).toBe('migration')
    expect(migrated.name).toBe('Legacy plan')
    expect(migrated.initialInvestment).toBe(123_000)
    expect(migrated.investmentMode).toBe(defaultPlan.investmentMode)
    expect(migrated.dividendTaxRate).toBe(defaultPlan.dividendTaxRate)
    expect(migrated.accounts).toHaveLength(3)
    expect(migrated.cashFlows).toHaveLength(2)
    expect(migrated.netWorthHistory).toHaveLength(1)
    expect(migrated.goals).toHaveLength(3)
    expect(migrated.simulationConfig.expectedReturn).toBe(5)
  })

  it('falls back safely for invalid input', () => {
    const migrated = migratePlan({ version: 99, initialInvestment: -1 })
    expect(migrated.version).toBe(10)
    expect(migrated.initialInvestment).toBe(defaultPlan.initialInvestment)
  })

  it('migrates a version 2 plan and supports a debt-free ledger', () => {
    const v2: Record<string, unknown> = { ...defaultPlan, version: 2, netWorth: { ...defaultPlan.netWorth, debt: 0 } }
    for (const key of ['accounts', 'cashFlows', 'debts', 'debtExtraPayment', 'netWorthHistory']) delete v2[key]
    const parsed = parseImportablePlan(v2)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.version).toBe(10)
      expect(parsed.data.debts).toEqual([])
    }
  })

  it('migrates an in-memory version 3 plan during hot reload', () => {
    const v3: Record<string, unknown> = { ...defaultPlan, version: 3 }
    for (const key of ['householdMembers', 'goals', 'monthlyGoalBudget']) delete v3[key]
    const parsed = parseImportablePlan(v3)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.version).toBe(10)
      expect(parsed.data.householdMembers[0].name).toBe('ฉัน')
      expect(parsed.data.goals).toHaveLength(3)
    }
  })

  it('migrates a version 4 plan with portfolio seed data', () => {
    const v4: Record<string, unknown> = { ...defaultPlan, version: 4 }
    for (const key of ['portfolioAccounts', 'holdings', 'transactions', 'investmentPolicy', 'benchmark']) delete v4[key]
    const parsed = parseImportablePlan(v4)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.version).toBe(10)
      expect(parsed.data.holdings.length).toBeGreaterThan(3)
      expect(parsed.data.investmentPolicy.approvalStatus).toBe('draft')
    }
  })

  it('migrates a version 5 plan with reproducible simulation defaults', () => {
    const v5: Record<string, unknown> = { ...defaultPlan, version: 5 }
    delete v5.simulationConfig
    const parsed = parseImportablePlan(v5)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.version).toBe(10)
      expect(parsed.data.simulationConfig.seed).toBe(42_052_026)
      expect(parsed.data.simulationConfig.simulations).toBe(5_000)
    }
  })

  it('migrates a version 6 plan with retirement, protection, tax, and legacy defaults', () => {
    const v6: Record<string, unknown> = { ...defaultPlan, version: 6 }
    for (const key of ['retirementConfig', 'protectionConfig', 'taxProfile', 'legacyConfig']) delete v6[key]
    const parsed = parseImportablePlan(v6)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.version).toBe(10)
      expect(parsed.data.retirementConfig.maxAge).toBe(100)
      expect(parsed.data.protectionConfig.emergencyMonthsTarget).toBe(6)
      expect(parsed.data.protectionConfig.enabled).toBe(false)
      expect(parsed.data.protectionConfig.expertReviewStatus).toBe('pending')
      expect(parsed.data.taxProfile.enabled).toBe(false)
      expect(parsed.data.taxProfile.expertReviewStatus).toBe('pending')
      expect(parsed.data.taxProfile.datasetVersion).toBe('pending-expert-review')
      expect(parsed.data.legacyConfig.items).toHaveLength(6)
    }
  })

  it('migrates version 7 holdings with explicit data provenance defaults', () => {
    const v7: Record<string, unknown> = { ...defaultPlan, version: 7, holdings: defaultPlan.holdings.map((holding) => {
      const legacy = { ...holding } as Record<string, unknown>
      for (const key of ['sourceProvider', 'sourceUrl', 'sourceFetchedAt', 'sourceStaleAfterHours', 'sourceLicensingStatus', 'sourceConfidence', 'sourceValidationStatus']) delete legacy[key]
      return legacy
    }) }
    const parsed = parseImportablePlan(v7)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.version).toBe(10)
      expect(parsed.data.holdings[0].sourceProvider).toBe('user-input')
      expect(parsed.data.holdings[0].sourceConfidence).toBe('userProvided')
      expect(parsed.data.holdings[0].sourceUrl).toBeNull()
    }
  })

  it('migrates version 8 plans with Copilot disabled and sensitive consent off by default', () => {
    const v8: Record<string, unknown> = { ...defaultPlan, version: 8 }
    delete v8.copilotConfig
    delete v8.wealthReviewConfig
    const parsed = parseImportablePlan(v8)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.version).toBe(10)
      expect(parsed.data.copilotConfig.enabled).toBe(false)
      expect(parsed.data.copilotConfig.consent.tax).toBe(false)
      expect(parsed.data.wealthReviewConfig.actions).toHaveLength(1)
    }
  })

  it('migrates version 9 without silently adopting the current calculation model', () => {
    const v9: Record<string, unknown> = { ...defaultPlan, version: 9 }
    delete v9.calculationModel
    const parsed = parseImportablePlan(v9)
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.version).toBe(10)
      expect(parsed.data.calculationModel.version).toBe('wealth-model-2026.08.0')
      expect(parsed.data.calculationModel.appliedBy).toBe('migration')
    }
  })
})
