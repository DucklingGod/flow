import type { Scenario, SimulationConfig, StressPreset, WealthPlan } from './schema'

export interface MonteCarloInput {
  initialInvestment: number
  monthlyContribution: number
  monthlyIncome: number
  years: number
  targetAmount: number
  foreignAllocation: number
  annualFee: number
  contributionTiming: 'beginning' | 'end'
  scenario: Scenario
  config: SimulationConfig
}

export interface ScenarioComparison {
  scenario: Scenario
  label: string
  finalValue: number
  realValue: number
  targetGap: number
}

export interface SensitivityDriver {
  key: 'expectedReturn' | 'volatility' | 'inflationMean' | 'monthlyContribution' | 'years'
  label: string
  downside: number
  upside: number
  impact: number
}

export interface MonteCarloResult {
  seed: number
  simulations: number
  durationMs: number
  p10: number
  p50: number
  p90: number
  realP50: number
  probabilityOfSuccess: number
  targetWithOverrun: number
  sequenceRiskCost: number
  comparison: ScenarioComparison[]
  sensitivity: SensitivityDriver[]
  warnings: string[]
}

export const stressPresets: Record<StressPreset, Partial<SimulationConfig>> = {
  none: { equityShock: 0, rateShock: 0, inflationShock: 0, fxShock: 0, incomeLossPercent: 0, incomeLossMonths: 0, healthcareCostAnnual: 0, earlyDrawdownPercent: 0 },
  equityCrash: { equityShock: -32, rateShock: -1, inflationShock: 0, fxShock: 4, earlyDrawdownPercent: 24, recoveryYears: 4 },
  ratesInflation: { equityShock: -12, rateShock: 2.5, inflationShock: 4, fxShock: 2, earlyDrawdownPercent: 10, recoveryYears: 3 },
  fxShock: { equityShock: -8, rateShock: 1, inflationShock: 2, fxShock: 14, earlyDrawdownPercent: 8, recoveryYears: 2 },
  incomeHealth: { equityShock: -10, rateShock: 0, inflationShock: 1.5, fxShock: 2, incomeLossPercent: 45, incomeLossMonths: 9, healthcareCostAnnual: 180_000, earlyDrawdownPercent: 7, recoveryYears: 2 },
  custom: {},
}

const scenarioAdjustments: Record<Scenario, { mean: number; volatility: number }> = {
  bear: { mean: -3.2, volatility: 4 },
  base: { mean: 0, volatility: 0 },
  bull: { mean: 2.3, volatility: -2 },
}

export function withStressPreset(config: SimulationConfig, preset: StressPreset): SimulationConfig {
  return { ...config, ...stressPresets[preset], stressPreset: preset }
}

function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state += 0x6D2B79F5
    let value = state
    value = Math.imul(value ^ value >>> 15, value | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296
  }
}

function normal(random: () => number) {
  const u = Math.max(Number.EPSILON, random())
  const v = Math.max(Number.EPSILON, random())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function percentile(sorted: number[], probability: number) {
  if (!sorted.length) return 0
  const index = (sorted.length - 1) * probability
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower)
}

function boundedFinite(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(value, 100_000_000_000_000))
}

interface PathOptions { random?: () => number; stochastic: boolean; earlyShock: boolean }

function simulatePath(input: MonteCarloInput, options: PathOptions) {
  const config = input.config
  const adjustment = scenarioAdjustments[input.scenario]
  const years = Math.max(1, Math.round(input.years + config.retirementDelayYears))
  const effectiveVolatility = Math.max(0, config.volatility + adjustment.volatility)
  const correlation = Math.max(-1, Math.min(1, config.equityBondCorrelation))
  const random = options.random ?? (() => .5)
  let value = Math.max(0, input.initialInvestment)
  let inflationIndex = 1
  let pausedMonths = config.contributionPauseMonths
  let incomeLossMonths = config.incomeLossMonths

  for (let year = 1; year <= years; year += 1) {
    const zEquity = options.stochastic ? normal(random) : 0
    const zIndependent = options.stochastic ? normal(random) : 0
    const zBond = correlation * zEquity + Math.sqrt(Math.max(0, 1 - correlation ** 2)) * zIndependent
    const portfolioNoise = effectiveVolatility * (.75 * zEquity + .25 * .35 * zBond)
    const inflation = config.inflationMean + (options.stochastic ? config.inflationVolatility * normal(random) : 0) + (year === 1 ? config.inflationShock : 0)
    const fx = config.fxMean + (options.stochastic ? config.fxVolatility * normal(random) : 0) + (year === 1 ? config.fxShock : 0)
    const fxContribution = input.foreignAllocation / 100 * fx
    const rateShock = year === 1 ? -config.rateShock * 1.2 : 0
    const presetShock = year === 1 ? config.equityShock * .75 : 0
    const drawdown = options.earlyShock && year === 1 ? -config.earlyDrawdownPercent : 0
    const recovery = options.earlyShock && year > 1 && year <= config.recoveryYears + 1 && config.recoveryYears > 0
      ? config.earlyDrawdownPercent / config.recoveryYears * .65
      : 0
    const annualReturn = config.expectedReturn + adjustment.mean - input.annualFee + portfolioNoise + fxContribution + rateShock + presetShock + drawdown + recovery

    const activeContributionMonths = Math.max(0, 12 - Math.min(12, pausedMonths))
    pausedMonths = Math.max(0, pausedMonths - 12)
    const affectedIncomeMonths = Math.min(activeContributionMonths, incomeLossMonths)
    incomeLossMonths = Math.max(0, incomeLossMonths - 12)
    const annualContribution = input.monthlyContribution * activeContributionMonths
      - input.monthlyContribution * affectedIncomeMonths * config.incomeLossPercent / 100
    const incomeShortfall = input.monthlyIncome * affectedIncomeMonths * config.incomeLossPercent / 100
    const healthcareCost = config.healthcareCostAnnual * inflationIndex

    if (input.contributionTiming === 'beginning') value += Math.max(0, annualContribution)
    value = value * Math.max(0, 1 + annualReturn / 100)
    if (input.contributionTiming === 'end') value += Math.max(0, annualContribution)
    value = Math.max(0, value - incomeShortfall - healthcareCost)
    inflationIndex *= Math.max(.5, 1 + inflation / 100)
  }

  return { nominal: boundedFinite(value), real: boundedFinite(value / inflationIndex) }
}

function deterministicFinal(input: MonteCarloInput, overrides: Partial<MonteCarloInput['config']> & { monthlyContribution?: number; years?: number } = {}) {
  const next: MonteCarloInput = {
    ...input,
    monthlyContribution: overrides.monthlyContribution ?? input.monthlyContribution,
    years: overrides.years ?? input.years,
    config: { ...input.config, ...overrides },
  }
  return simulatePath(next, { stochastic: false, earlyShock: true }).nominal
}

function scenarioComparison(input: MonteCarloInput): ScenarioComparison[] {
  return (['bear', 'base', 'bull'] as const).map((scenario) => {
    const next = { ...input, scenario }
    const result = simulatePath(next, { stochastic: false, earlyShock: true })
    return {
      scenario,
      label: scenario === 'bear' ? 'Bear' : scenario === 'bull' ? 'Bull' : 'Base',
      finalValue: result.nominal,
      realValue: result.real,
      targetGap: result.nominal - input.targetAmount * (1 + input.config.homeOverrunPercent / 100),
    }
  })
}

function sensitivity(input: MonteCarloInput): SensitivityDriver[] {
  const specs: Array<{ key: SensitivityDriver['key']; label: string; low: Record<string, number>; high: Record<string, number> }> = [
    { key: 'expectedReturn', label: 'ผลตอบแทนคาดหวัง', low: { expectedReturn: input.config.expectedReturn - 2 }, high: { expectedReturn: input.config.expectedReturn + 2 } },
    { key: 'volatility', label: 'ความผันผวน / drawdown', low: { earlyDrawdownPercent: Math.min(100, input.config.earlyDrawdownPercent + 12) }, high: { earlyDrawdownPercent: Math.max(0, input.config.earlyDrawdownPercent - 12) } },
    { key: 'inflationMean', label: 'เงินเฟ้อ', low: { inflationMean: input.config.inflationMean + 1.5 }, high: { inflationMean: input.config.inflationMean - 1.5 } },
    { key: 'monthlyContribution', label: 'เงินลงทุนรายเดือน', low: { monthlyContribution: input.monthlyContribution * .8 }, high: { monthlyContribution: input.monthlyContribution * 1.2 } },
    { key: 'years', label: 'ระยะเวลา', low: { years: Math.max(1, input.years - 3) }, high: { years: input.years + 3 } },
  ]
  return specs.map((spec) => {
    const downside = deterministicFinal(input, spec.low)
    const upside = deterministicFinal(input, spec.high)
    return { key: spec.key, label: spec.label, downside, upside, impact: Math.abs(upside - downside) }
  }).sort((a, b) => b.impact - a.impact)
}

export function planToMonteCarloInput(plan: WealthPlan): MonteCarloInput {
  return {
    initialInvestment: plan.initialInvestment,
    monthlyContribution: plan.investmentMode === 'dca' ? plan.monthlyContribution : 0,
    monthlyIncome: plan.netWorth.monthlyIncome,
    years: plan.years,
    targetAmount: plan.targetAmount,
    foreignAllocation: plan.foreignAllocation,
    annualFee: plan.annualFee,
    contributionTiming: plan.contributionTiming,
    scenario: plan.scenario,
    config: plan.simulationConfig,
  }
}

export function runMonteCarlo(input: MonteCarloInput): MonteCarloResult {
  const startedAt = performance.now()
  const random = mulberry32(input.config.seed)
  const nominal: number[] = []
  const real: number[] = []
  const simulations = Math.max(100, Math.min(50_000, Math.round(input.config.simulations)))
  const targetWithOverrun = input.targetAmount * (1 + input.config.homeOverrunPercent / 100)
  let successes = 0

  for (let index = 0; index < simulations; index += 1) {
    const result = simulatePath(input, { random, stochastic: true, earlyShock: true })
    nominal.push(result.nominal)
    real.push(result.real)
    if (result.nominal >= targetWithOverrun) successes += 1
  }
  nominal.sort((a, b) => a - b)
  real.sort((a, b) => a - b)
  const withoutEarlyShock = simulatePath({ ...input, config: { ...input.config, earlyDrawdownPercent: 0 } }, { stochastic: false, earlyShock: false }).nominal
  const withEarlyShock = simulatePath(input, { stochastic: false, earlyShock: true }).nominal
  const warnings = ['ผลลัพธ์เป็นแบบจำลองจากสมมติฐานของผู้ใช้ ไม่ใช่ forecast หรือการรับประกันผลตอบแทน']
  if (simulations < 1_000) warnings.push('จำนวน simulation ต่ำกว่า 1,000 เส้นทาง ช่วงเปอร์เซ็นไทล์อาจไม่นิ่ง')
  if (input.years < 5) warnings.push('ช่วงเวลาสั้นกว่า 5 ปีทำให้ข้อมูลปลายทางไวต่อเหตุการณ์ปีเดียวมาก')
  warnings.push('ยังไม่ได้ calibrate จาก historical dataset ที่ตรวจสอบแหล่งที่มา จึงใช้พารามิเตอร์ที่ผู้ใช้กำหนดเท่านั้น')

  return {
    seed: input.config.seed,
    simulations,
    durationMs: performance.now() - startedAt,
    p10: percentile(nominal, .1),
    p50: percentile(nominal, .5),
    p90: percentile(nominal, .9),
    realP50: percentile(real, .5),
    probabilityOfSuccess: successes / simulations * 100,
    targetWithOverrun,
    sequenceRiskCost: Math.max(0, withoutEarlyShock - withEarlyShock),
    comparison: scenarioComparison(input),
    sensitivity: sensitivity(input),
    warnings,
  }
}
