import { describe, expect, it } from 'vitest'
import { defaultPlan } from './schema'
import { calculateWealthHealth, cashFlowTrend, compareDebtVsInvest, compareRefinance, reconcileWealth, simulateDebtStrategy } from './wealth'

describe('wealth reconciliation', () => {
  it('reconciles ledger accounts, annual cash flow, and debts', () => {
    const plan = { ...defaultPlan, cashFlows: [...defaultPlan.cashFlows, { id: 'bonus', name: 'โบนัส', type: 'income' as const, amount: 120_000, frequency: 'annual' as const, category: 'โบนัส' }] }
    const result = reconcileWealth(plan)
    expect(result.assets).toBe(5_480_000)
    expect(result.debt).toBe(1_450_000)
    expect(result.monthlyIncome).toBe(102_000)
    expect(result.netWorth).toBe(4_030_000)
  })

  it('aggregates monthly cash-flow history and compares debt with investing', () => {
    const trend = cashFlowTrend({ ...defaultPlan, cashFlowHistory: [
      { id: '1', month: '2026-07', category: 'งาน', type: 'income', amount: 50_000 },
      { id: '2', month: '2026-07', category: 'บ้าน', type: 'expense', amount: 30_000 },
      { id: '3', month: '2026-08', category: 'งาน', type: 'income', amount: 55_000 },
    ] })
    expect(trend).toEqual([{ month: '2026-07', income: 50_000, expense: 30_000 }, { month: '2026-08', income: 55_000, expense: 0 }])
    expect(compareDebtVsInvest(8, 9).preference).toBe('debt')
    expect(compareDebtVsInvest(4, 8).preference).toBe('invest')
  })

  it('returns an explainable score bounded to 0–100', () => {
    const result = calculateWealthHealth(defaultPlan)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.drivers).toHaveLength(3)
    expect(result.drivers.every((driver) => driver.reason && driver.action)).toBe(true)
  })

  it('handles empty income, expense, assets, and debt-only households', () => {
    const result = reconcileWealth({ ...defaultPlan, accounts: [], cashFlows: [], debts: [{ id: 'd', name: 'หนี้', balance: 10_000, annualRate: 0, minimumPayment: 100 }] })
    expect(result.emergencyMonths).toBe(0)
    expect(result.savingsRate).toBe(0)
    expect(result.debtToAssets).toBe(100)
  })

  it('labels middle and urgent health bands', () => {
    const watch = calculateWealthHealth({
      ...defaultPlan,
      accounts: [{ id: 'cash', name: 'เงินสด', type: 'cash', balance: 40_000, currency: 'THB' }, { id: 'asset', name: 'ทรัพย์สิน', type: 'other', balance: 60_000, currency: 'THB' }],
      cashFlows: [{ id: 'income', name: 'รายรับ', type: 'income', amount: 100_000, frequency: 'monthly', category: 'งาน' }, { id: 'expense', name: 'รายจ่าย', type: 'expense', amount: 88_000, frequency: 'monthly', category: 'บ้าน' }],
      debts: [{ id: 'debt', name: 'หนี้', balance: 40_000, annualRate: 5, minimumPayment: 2_000 }],
    })
    expect(watch.drivers.map((driver) => driver.status)).toEqual(['urgent', 'watch', 'watch'])
    const urgent = calculateWealthHealth({ ...defaultPlan, accounts: [], cashFlows: defaultPlan.cashFlows, debts: defaultPlan.debts })
    expect(urgent.drivers[2].status).toBe('urgent')
  })
})

describe('Debt Studio', () => {
  const debts = [
    { id: 'card', name: 'บัตร', balance: 80_000, annualRate: 18, minimumPayment: 4_000 },
    { id: 'home', name: 'บ้าน', balance: 500_000, annualRate: 4, minimumPayment: 8_000 },
  ]

  it('prioritizes highest rate for avalanche and lowest balance for snowball', () => {
    expect(simulateDebtStrategy(debts, 'avalanche', 5_000).payoffOrder[0]).toBe('card')
    expect(simulateDebtStrategy(debts, 'snowball', 5_000).payoffOrder[0]).toBe('card')
  })

  it('extra payment reduces interest and payoff time', () => {
    const minimum = simulateDebtStrategy(debts, 'avalanche', 0)
    const accelerated = simulateDebtStrategy(debts, 'avalanche', 8_000)
    expect(accelerated.totalInterest).toBeLessThan(minimum.totalInterest)
    expect(accelerated.months!).toBeLessThan(minimum.months!)
  })

  it('shows net refinancing saving after fees', () => {
    const result = compareRefinance(debts[1], 2.5, 5_000)
    expect(result.netSaving).toBeGreaterThan(0)
    expect(result.worthwhile).toBe(true)
  })

  it('reports an impossible payoff and handles an empty debt list', () => {
    const impossible = simulateDebtStrategy([{ id: 'stuck', name: 'หนี้ไม่ลด', balance: 10_000, annualRate: 30, minimumPayment: 0 }], 'snowball', -100)
    expect(impossible.feasible).toBe(false)
    expect(impossible.months).toBeNull()
    expect(simulateDebtStrategy([], 'avalanche', 0)).toMatchObject({ feasible: true, months: 0 })
  })

  it('keeps a refinance with higher costs marked not worthwhile', () => {
    const result = compareRefinance(debts[1], 3.9, 100_000)
    expect(result.worthwhile).toBe(false)
    expect(result.fee).toBe(100_000)
  })
})
