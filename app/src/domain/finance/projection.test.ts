import { describe, expect, it } from 'vitest'
import { defaultPlan, type WealthPlan } from '../schema'
import {
  calculateProjection,
  calculateWealthMetrics,
  monthlyRateFromAnnualPercent,
  requiredInitialInvestment,
  requiredMonthlyContribution,
} from './projection'

const plan = (overrides: Partial<WealthPlan> = {}): WealthPlan => ({ ...defaultPlan, ...overrides })

describe('financial projection golden cases', () => {
  it('matches the zero-return end-of-month contribution identity', () => {
    const result = calculateProjection(plan({
      expectedReturn: 0,
      dividendYield: 0,
      annualFee: 0,
      inflation: 0,
      fxAnnualChange: 0,
      years: 2,
      initialInvestment: 500_000,
      monthlyContribution: 15_000,
    }))
    expect(result.futureValue).toBeCloseTo(860_000, 6)
    expect(result.contributed).toBe(860_000)
    expect(result.investmentGrowth).toBeCloseTo(0, 6)
  })

  it('ignores monthly contributions in lump-sum mode', () => {
    const base = plan({ investmentMode: 'lumpSum', monthlyContribution: 99_999, years: 5 })
    const withoutMonthly = calculateProjection({ ...base, monthlyContribution: 0 })
    expect(calculateProjection(base).futureValue).toBeCloseTo(withoutMonthly.futureValue, 8)
    expect(calculateProjection(base).contributed).toBe(base.initialInvestment)
  })

  it('gives beginning-of-month contributions more time to compound', () => {
    const end = calculateProjection(plan({ contributionTiming: 'end', years: 10 })).futureValue
    const beginning = calculateProjection(plan({ contributionTiming: 'beginning', years: 10 })).futureValue
    expect(beginning).toBeGreaterThan(end)
  })

  it('separates cash dividends from invested value', () => {
    const cash = calculateProjection(plan({ dividendMode: 'cash', dividendYield: 3, years: 15 }))
    const reinvest = calculateProjection(plan({ dividendMode: 'reinvest', dividendYield: 3, years: 15 }))
    expect(cash.cashDividends).toBeGreaterThan(0)
    expect(reinvest.cashDividends).toBe(0)
    expect(reinvest.futureValue).toBeGreaterThan(cash.futureValue)
  })

  it('keeps before-fee, before-tax, and after-tax values ordered', () => {
    const result = calculateProjection(plan({ annualFee: 1.2, dividendYield: 4, dividendTaxRate: 15 }))
    expect(result.grossFutureValue).toBeGreaterThan(result.afterFeeFutureValue)
    expect(result.afterFeeFutureValue).toBeGreaterThan(result.futureValue)
    expect(result.feeDrag).toBeGreaterThan(0)
    expect(result.taxDrag).toBeGreaterThan(0)
  })

  it('applies FX change only to the foreign allocation', () => {
    const neutral = calculateProjection(plan({ foreignAllocation: 60, fxAnnualChange: 0 })).futureValue
    const weakerBaht = calculateProjection(plan({ foreignAllocation: 60, fxAnnualChange: 2 })).futureValue
    expect(weakerBaht).toBeGreaterThan(neutral)
    expect(calculateProjection(plan({ foreignAllocation: 60, fxAnnualChange: 2 })).fxImpact).toBeCloseTo(1.2, 10)
  })

  it('calculates fixed-deposit interest tax separately', () => {
    const result = calculateProjection(plan({ depositRate: 2, depositInterestTaxRate: 15 }))
    expect(result.depositGrossFutureValue).toBeGreaterThan(result.depositNetFutureValue)
    expect(result.depositNetFutureValue).toBeGreaterThan(result.contributed)
  })

  it('applies irregular contributions in their specified months', () => {
    const withoutExtra = calculateProjection(plan({ years: 3, expectedReturn: 0, dividendYield: 0, annualFee: 0, monthlyContribution: 0 }))
    const withExtra = calculateProjection(plan({
      years: 3,
      expectedReturn: 0,
      dividendYield: 0,
      annualFee: 0,
      monthlyContribution: 0,
      irregularCashFlows: [
        { id: 'bonus-1', month: 6, amount: 50_000 },
        { id: 'bonus-2', month: 19, amount: 25_000 },
      ],
    }))
    expect(withExtra.contributed - withoutExtra.contributed).toBe(75_000)
    expect(withExtra.futureValue - withoutExtra.futureValue).toBeCloseTo(75_000, 6)
  })

  it('supports negative returns without NaN or Infinity', () => {
    const result = calculateProjection(plan({ expectedReturn: -20, annualFee: 2, years: 60 }))
    Object.values(result).filter((value) => typeof value === 'number').forEach((value) => expect(Number.isFinite(value)).toBe(true))
    result.points.forEach((point) => Object.values(point).forEach((value) => expect(Number.isFinite(value)).toBe(true)))
  })

  it('remains finite over the maximum horizon', () => {
    const result = calculateProjection(plan({ years: 60, expectedReturn: 25, monthlyContribution: 1_000_000 }))
    expect(Number.isFinite(result.futureValue)).toBe(true)
    expect(result.points).toHaveLength(61)
  })
})

describe('reverse goal calculator', () => {
  it('solves monthly contribution to the target within one baht', () => {
    const input = plan({ initialInvestment: 100_000, monthlyContribution: 0, targetAmount: 2_000_000, years: 10 })
    const required = requiredMonthlyContribution(input)
    const result = calculateProjection({ ...input, monthlyContribution: required })
    expect(required).toBeGreaterThan(8_000)
    expect(required).toBeLessThan(13_000)
    expect(result.futureValue).toBeCloseTo(input.targetAmount, 2)
  })

  it('solves required initial amount while keeping current DCA', () => {
    const input = plan({ initialInvestment: 0, monthlyContribution: 5_000, targetAmount: 5_000_000, years: 12 })
    const required = requiredInitialInvestment(input)
    const result = calculateProjection({ ...input, initialInvestment: required })
    expect(required).toBeGreaterThan(0)
    expect(result.futureValue).toBeCloseTo(input.targetAmount, 2)
  })

  it('returns zero required monthly in lump-sum mode', () => {
    expect(requiredMonthlyContribution(plan({ investmentMode: 'lumpSum' }))).toBe(0)
  })
})

describe('calculation invariants', () => {
  it('converts effective annual rate to a monthly rate', () => {
    const monthly = monthlyRateFromAnnualPercent(12)
    expect(Math.pow(1 + monthly, 12) - 1).toBeCloseTo(.12, 10)
  })

  it('does not produce non-finite values across a deterministic input grid', () => {
    for (let index = 0; index < 200; index += 1) {
      const result = calculateProjection(plan({
        years: 1 + index % 60,
        expectedReturn: -40 + index % 80,
        annualFee: index % 8,
        inflation: -3 + index % 20,
        dividendYield: index % 12,
        dividendTaxRate: index % 31,
        fxAnnualChange: -10 + index % 21,
        foreignAllocation: index % 101,
        initialInvestment: index * 10_000,
        monthlyContribution: index % 5 === 0 ? 0 : index * 100,
        irregularCashFlows: index % 4 === 0 ? [{ id: `flow-${index}`, month: 1 + index % 12, amount: index * 1_000 }] : [],
      }))
      expect(Number.isFinite(result.futureValue)).toBe(true)
      expect(Number.isFinite(result.realValue)).toBe(true)
      expect(Number.isFinite(result.requiredInitial)).toBe(true)
      expect(Number.isFinite(result.requiredMonthly)).toBe(true)
    }
  })
})

describe('wealth metrics', () => {
  it('reconciles net worth and monthly surplus', () => {
    const metrics = calculateWealthMetrics(defaultPlan)
    expect(metrics.netWorth).toBe(4_030_000)
    expect(metrics.monthlySurplus).toBe(41_000)
    expect(metrics.score).toBeGreaterThanOrEqual(0)
    expect(metrics.score).toBeLessThanOrEqual(100)
  })
})
