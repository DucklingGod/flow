import { describe, expect, it } from 'vitest'
import { defaultPlan } from './schema'
import { calculateProtection } from './protection'

describe('protection gap engine', () => {
  it('keeps emergency, life, health, and disability gaps separate', () => {
    const result = calculateProtection(defaultPlan)
    expect(result.emergencyReserveTarget).toBe(defaultPlan.netWorth.monthlyExpense * 6)
    expect(result.emergencyReserveGap).toBe(0)
    expect(result.lifeCoverageNeed).toBe(result.debtPayoffNeed + result.finalExpenseNeed)
    expect(result.healthAnnualGap).toBe(1_000_000)
    expect(result.disabilityMonthlyGap).toBeCloseTo(defaultPlan.netWorth.monthlyIncome * .7)
  })

  it('adds income replacement only when there are dependants', () => {
    const plan = { ...defaultPlan, protectionConfig: { ...defaultPlan.protectionConfig, dependantCount: 2, incomeReplacementYears: 8, incomeReplacementPercent: 60 } }
    const result = calculateProtection(plan)
    expect(result.incomeReplacementNeed).toBe(defaultPlan.netWorth.monthlyIncome * 12 * 8 * .6)
    expect(result.lifeCoverageNeed).toBe(result.debtPayoffNeed + result.incomeReplacementNeed + result.educationNeed + result.finalExpenseNeed)
  })

  it('subtracts existing cover without allowing negative gaps', () => {
    const plan = { ...defaultPlan, protectionConfig: { ...defaultPlan.protectionConfig, existingLifeCover: 100_000_000, existingHealthAnnualLimit: 2_000_000, existingDisabilityMonthlyBenefit: 100_000 } }
    const result = calculateProtection(plan)
    expect(result.lifeCoverageGap).toBe(0)
    expect(result.healthAnnualGap).toBe(0)
    expect(result.disabilityMonthlyGap).toBe(0)
  })

  it('deduplicates debt IDs and prefers the detailed debt ledger', () => {
    const duplicate = defaultPlan.debts[0]
    const plan = { ...defaultPlan, debts: [duplicate, { ...duplicate }] }
    const result = calculateProtection(plan)
    expect(result.debtPayoffNeed).toBe(duplicate.balance)
    expect(result.duplicateDebtIds).toEqual([duplicate.id])
  })
})
