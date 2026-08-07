import { describe, expect, it } from 'vitest'
import { defaultPlan } from './schema'
import { planToMonteCarloInput, runMonteCarlo, withStressPreset } from './scenario'

describe('scenario studio engine', () => {
  it('repeats the same distribution with the same seed', () => {
    const input = planToMonteCarloInput({ ...defaultPlan, simulationConfig: { ...defaultPlan.simulationConfig, simulations: 1_000, seed: 123_456 } })
    const first = runMonteCarlo(input)
    const second = runMonteCarlo(input)
    expect(second.p10).toBe(first.p10)
    expect(second.p50).toBe(first.p50)
    expect(second.p90).toBe(first.p90)
    expect(second.probabilityOfSuccess).toBe(first.probabilityOfSuccess)
  })

  it('returns ordered percentiles and a bounded success rate', () => {
    const result = runMonteCarlo(planToMonteCarloInput({ ...defaultPlan, simulationConfig: { ...defaultPlan.simulationConfig, simulations: 2_000 } }))
    expect(result.p10).toBeLessThanOrEqual(result.p50)
    expect(result.p50).toBeLessThanOrEqual(result.p90)
    expect(result.probabilityOfSuccess).toBeGreaterThanOrEqual(0)
    expect(result.probabilityOfSuccess).toBeLessThanOrEqual(100)
    expect(result.comparison).toHaveLength(3)
    expect(result.sensitivity).toHaveLength(5)
  })

  it('moves the median in the expected direction when returns change', () => {
    const base = planToMonteCarloInput({ ...defaultPlan, simulationConfig: { ...defaultPlan.simulationConfig, simulations: 1_500, seed: 81 } })
    const low = runMonteCarlo({ ...base, config: { ...base.config, expectedReturn: 2 } })
    const high = runMonteCarlo({ ...base, config: { ...base.config, expectedReturn: 10 } })
    expect(high.p50).toBeGreaterThan(low.p50)
  })

  it('prices contribution pauses, overruns and early drawdowns into the result', () => {
    const base = planToMonteCarloInput({ ...defaultPlan, simulationConfig: { ...defaultPlan.simulationConfig, simulations: 1_200, seed: 555, earlyDrawdownPercent: 0 } })
    const stressed = runMonteCarlo({ ...base, config: { ...base.config, contributionPauseMonths: 18, homeOverrunPercent: 20, earlyDrawdownPercent: 30, recoveryYears: 4 } })
    const normal = runMonteCarlo(base)
    expect(stressed.p50).toBeLessThan(normal.p50)
    expect(stressed.targetWithOverrun).toBeGreaterThan(normal.targetWithOverrun)
    expect(stressed.sequenceRiskCost).toBeGreaterThan(0)
  })

  it('applies named shocks without hiding their parameters', () => {
    const crash = withStressPreset(defaultPlan.simulationConfig, 'equityCrash')
    expect(crash.stressPreset).toBe('equityCrash')
    expect(crash.equityShock).toBeLessThan(0)
    expect(crash.earlyDrawdownPercent).toBeGreaterThan(0)
  })

  it('keeps 5,000 paths within the worker performance budget', () => {
    const result = runMonteCarlo(planToMonteCarloInput(defaultPlan))
    expect(result.simulations).toBe(5_000)
    expect(result.durationMs).toBeLessThan(1_500)
  })
})
