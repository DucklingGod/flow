import { describe, expect, it } from 'vitest'
import { quickProjection } from './quickProjection'
import { calculateProjection } from './projection'
import { defaultPlan } from '../schema'

/**
 * Build a plan whose every complicating factor is neutral, so the full engine
 * reduces to exactly what the landing-page control models.
 */
function neutralPlan(overrides: { initial: number; monthly: number; years: number; rate: number }) {
  return {
    ...defaultPlan,
    investmentMode: 'dca' as const,
    contributionTiming: 'beginning' as const,
    dividendMode: 'reinvest' as const,
    scenario: 'base' as const,
    initialInvestment: overrides.initial,
    monthlyContribution: overrides.monthly,
    years: overrides.years,
    expectedReturn: overrides.rate,
    annualFee: 0,
    dividendYield: 0,
    dividendTaxRate: 0,
    foreignAllocation: 0,
    fxAnnualChange: 0,
    irregularCashFlows: [],
  }
}

describe('quick projection', () => {
  it('matches the full projection engine for an equivalent plan', () => {
    const cases = [
      { initial: 0, monthly: 5_000, years: 10, rate: 7 },
      { initial: 100_000, monthly: 10_000, years: 20, rate: 6 },
      { initial: 500_000, monthly: 0, years: 30, rate: 5 },
      { initial: 50_000, monthly: 25_000, years: 5, rate: 9.5 },
      { initial: 0, monthly: 1_000, years: 1, rate: 0 },
    ]
    for (const input of cases) {
      const quick = quickProjection({
        initial: input.initial, monthly: input.monthly, years: input.years, annualReturnPercent: input.rate,
      })
      const full = calculateProjection(neutralPlan(input))
      const label = JSON.stringify(input)
      // Sub-baht agreement: the marketing number must be the product's number.
      expect(Math.abs(quick.futureValue - full.futureValue), label).toBeLessThan(1)
      expect(Math.abs(quick.contributed - full.contributed), label).toBeLessThan(1)
    }
  })

  it('returns the principal when nothing is invested and nothing grows', () => {
    expect(quickProjection({ initial: 0, monthly: 0, years: 10, annualReturnPercent: 7 })).toEqual({
      futureValue: 0, contributed: 0, growth: 0,
    })
    const flat = quickProjection({ initial: 1_000, monthly: 100, years: 2, annualReturnPercent: 0 })
    expect(flat.futureValue).toBeCloseTo(1_000 + 100 * 24, 6)
    expect(flat.growth).toBeCloseTo(0, 6)
  })

  it('clamps hostile input instead of producing a non-finite result', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1e30]) {
      const result = quickProjection({ initial: bad, monthly: bad, years: bad, annualReturnPercent: bad })
      expect(Number.isFinite(result.futureValue)).toBe(true)
      expect(result.futureValue).toBeGreaterThanOrEqual(0)
    }
  })

  it('grows monotonically with rate, contribution, and time', () => {
    const base = { initial: 10_000, monthly: 5_000, years: 10, annualReturnPercent: 6 }
    expect(quickProjection({ ...base, annualReturnPercent: 8 }).futureValue).toBeGreaterThan(quickProjection(base).futureValue)
    expect(quickProjection({ ...base, monthly: 6_000 }).futureValue).toBeGreaterThan(quickProjection(base).futureValue)
    expect(quickProjection({ ...base, years: 12 }).futureValue).toBeGreaterThan(quickProjection(base).futureValue)
  })
})
