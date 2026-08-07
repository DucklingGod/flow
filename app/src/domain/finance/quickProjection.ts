import { monthlyRateFromAnnualPercent } from './projection'

/**
 * A deliberately small projection for the marketing page's try-it control.
 *
 * It exists so the landing page can demonstrate the real compounding
 * convention without pulling the full plan schema (and Zod) into the marketing
 * bundle. It reuses `monthlyRateFromAnnualPercent`, and `quickProjection.test.ts`
 * pins its output to `calculateProjection` for the equivalent plan — so the two
 * cannot silently drift apart.
 *
 * Scope: no fees, dividends, tax, FX, inflation, or irregular cash flows. The
 * landing page says so next to the result; the full model lives in the app.
 */
export interface QuickProjectionInput {
  /** Lump sum already invested, THB. */
  initial: number
  /** Contributed at the start of each month, THB. */
  monthly: number
  years: number
  /** Expected nominal return, percent per year. */
  annualReturnPercent: number
}

export interface QuickProjectionResult {
  futureValue: number
  contributed: number
  growth: number
}

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min

export function quickProjection(input: QuickProjectionInput): QuickProjectionResult {
  const initial = clamp(input.initial, 0, 1_000_000_000)
  const monthly = clamp(input.monthly, 0, 10_000_000)
  const months = Math.round(clamp(input.years, 0, 50)) * 12
  const rate = monthlyRateFromAnnualPercent(clamp(input.annualReturnPercent, -99, 100))

  let balance = initial
  let contributed = initial
  for (let month = 1; month <= months; month += 1) {
    // Contribution at the beginning of the month, then one month of growth —
    // matching the planner's default `contributionTiming: 'beginning'`.
    balance += monthly
    contributed += monthly
    balance *= 1 + rate
  }

  const futureValue = Number.isFinite(balance) ? balance : 0
  return { futureValue, contributed, growth: futureValue - contributed }
}
