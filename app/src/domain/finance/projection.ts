import type { Scenario, WealthPlan } from '../schema'
import type { CalculationModelVersion } from '../calculationModels'
import { resolveCalculationModelVersion } from '../calculationModels'
import { calculateWealthHealth } from '../wealth'

export interface ProjectionPoint {
  year: number
  contributed: number
  gross: number
  afterFee: number
  nominal: number
  real: number
  deposit: number
}

export interface ProjectionResult {
  modelVersion: CalculationModelVersion
  futureValue: number
  investedValue: number
  cashDividends: number
  grossFutureValue: number
  afterFeeFutureValue: number
  realValue: number
  contributed: number
  investmentGrowth: number
  grossAnnualReturn: number
  netAnnualReturn: number
  fxImpact: number
  feeDrag: number
  taxDrag: number
  requiredMonthly: number
  requiredInitial: number
  fundingGap: number
  targetReachedMonth: number | null
  targetDateLabel: string
  annualDividendAtGoal: number
  progress: number
  depositGrossFutureValue: number
  depositNetFutureValue: number
  depositDifference: number
  points: ProjectionPoint[]
}

interface SimulationResult {
  total: number
  invested: number
  cashDividends: number
  gross: number
  afterFee: number
  depositGross: number
  depositNet: number
  contributed: number
  reachedMonth: number | null
  points: ProjectionPoint[]
}

export const scenarioShift: Record<Scenario, number> = { bear: -3.2, base: 0, bull: 2.3 }

export function monthlyRateFromAnnualPercent(annualPercent: number) {
  const bounded = Math.max(-99.999, annualPercent) / 100
  return Math.pow(1 + bounded, 1 / 12) - 1
}

function finite(value: number) {
  return Number.isFinite(value) ? value : 0
}

function simulateCompound(plan: WealthPlan, initial: number, monthlyContribution: number, collectPoints = false): SimulationResult {
  const months = Math.max(0, Math.round(plan.years * 12))
  const monthly = plan.investmentMode === 'dca' ? Math.max(0, monthlyContribution) : 0
  const fxImpact = plan.foreignAllocation / 100 * plan.fxAnnualChange
  const grossAnnual = plan.expectedReturn + scenarioShift[plan.scenario] + fxImpact
  const afterFeeAnnual = grossAnnual - plan.annualFee
  const capitalAnnual = grossAnnual - plan.dividendYield - plan.annualFee
  const netDividendAnnual = plan.dividendYield * (1 - plan.dividendTaxRate / 100)
  const grossMonthlyRate = monthlyRateFromAnnualPercent(grossAnnual)
  const afterFeeMonthlyRate = monthlyRateFromAnnualPercent(afterFeeAnnual)
  const capitalMonthlyRate = monthlyRateFromAnnualPercent(capitalAnnual)
  const netDividendMonthlyRate = netDividendAnnual / 100 / 12
  const depositGrossMonthlyRate = monthlyRateFromAnnualPercent(plan.depositRate)
  const depositNetMonthlyRate = monthlyRateFromAnnualPercent(plan.depositRate * (1 - plan.depositInterestTaxRate / 100))

  let invested = Math.max(0, initial)
  let gross = invested
  let afterFee = invested
  let cashDividends = 0
  let depositGross = invested
  let depositNet = invested
  let contributed = invested
  let reachedMonth: number | null = invested >= plan.targetAmount ? 0 : null
  const points: ProjectionPoint[] = []

  const addContribution = () => {
    if (monthly <= 0) return
    invested += monthly
    gross += monthly
    afterFee += monthly
    depositGross += monthly
    depositNet += monthly
    contributed += monthly
  }

  const addIrregularCashFlows = (month: number) => {
    const amount = plan.irregularCashFlows
      .filter((flow) => flow.month === month)
      .reduce((sum, flow) => sum + Math.max(0, flow.amount), 0)
    if (amount <= 0) return
    invested += amount
    gross += amount
    afterFee += amount
    depositGross += amount
    depositNet += amount
    contributed += amount
  }

  const addPoint = (month: number) => {
    if (!collectPoints) return
    const total = invested + cashDividends
    points.push({
      year: month / 12,
      contributed: finite(contributed),
      gross: finite(gross),
      afterFee: finite(afterFee),
      nominal: finite(total),
      real: finite(total / Math.pow(1 + plan.inflation / 100, month / 12)),
      deposit: finite(depositNet),
    })
  }

  addPoint(0)
  for (let month = 1; month <= months; month += 1) {
    if (plan.contributionTiming === 'beginning') addContribution()

    gross *= 1 + grossMonthlyRate
    afterFee *= 1 + afterFeeMonthlyRate
    const dividend = invested * netDividendMonthlyRate
    invested *= 1 + capitalMonthlyRate
    if (plan.dividendMode === 'reinvest') invested += dividend
    else cashDividends += dividend
    depositGross *= 1 + depositGrossMonthlyRate
    depositNet *= 1 + depositNetMonthlyRate

    if (plan.contributionTiming === 'end') addContribution()
    addIrregularCashFlows(month)
    const total = invested + cashDividends
    if (reachedMonth === null && total >= plan.targetAmount) reachedMonth = month
    if (month % 12 === 0 || month === months) addPoint(month)
  }

  return {
    total: finite(invested + cashDividends),
    invested: finite(invested),
    cashDividends: finite(cashDividends),
    gross: finite(gross),
    afterFee: finite(afterFee),
    depositGross: finite(depositGross),
    depositNet: finite(depositNet),
    contributed: finite(contributed),
    reachedMonth,
    points,
  }
}

type ProjectionEngine = (plan: WealthPlan, initial: number, monthlyContribution: number, collectPoints?: boolean) => SimulationResult

// Adding a model version is intentionally a compile-time obligation: every registered
// version must keep its own engine until the user explicitly adopts a newer version.
const projectionEngines: Record<CalculationModelVersion, ProjectionEngine> = {
  'wealth-model-2026.08.0': simulateCompound,
  'wealth-model-2026.08.1': simulateCompound,
}

function simulate(plan: WealthPlan, initial: number, monthlyContribution: number, collectPoints = false) {
  return projectionEngines[resolveCalculationModelVersion(plan.calculationModel?.version)](plan, initial, monthlyContribution, collectPoints)
}

function solveAmount(target: number, evaluate: (amount: number) => number, maximum: number) {
  if (target <= evaluate(0)) return 0
  let low = 0
  let high = 1
  while (high < maximum && evaluate(high) < target) high *= 2
  high = Math.min(high, maximum)
  if (evaluate(high) < target) return high
  for (let index = 0; index < 80; index += 1) {
    const middle = (low + high) / 2
    if (evaluate(middle) >= target) high = middle
    else low = middle
  }
  return high
}

export function requiredMonthlyContribution(plan: WealthPlan) {
  if (plan.investmentMode === 'lumpSum') return 0
  return solveAmount(plan.targetAmount, (monthly) => simulate(plan, plan.initialInvestment, monthly).total, 10_000_000)
}

export function requiredInitialInvestment(plan: WealthPlan) {
  return solveAmount(plan.targetAmount, (initial) => simulate(plan, initial, plan.monthlyContribution).total, 1_000_000_000)
}

export function calculateProjection(plan: WealthPlan): ProjectionResult {
  const result = simulate(plan, plan.initialInvestment, plan.monthlyContribution, true)
  const fxImpact = plan.foreignAllocation / 100 * plan.fxAnnualChange
  const grossAnnualReturn = plan.expectedReturn + scenarioShift[plan.scenario] + fxImpact
  const netDividendAnnual = plan.dividendYield * (1 - plan.dividendTaxRate / 100)
  const netAnnualReturn = grossAnnualReturn - plan.annualFee - plan.dividendYield + (plan.dividendMode === 'reinvest' ? netDividendAnnual : 0)
  const realValue = result.total / Math.pow(1 + plan.inflation / 100, plan.years)
  const reachedYears = result.reachedMonth === null ? null : result.reachedMonth / 12
  const targetDateLabel = reachedYears === null
    ? `ยังไม่ถึงเป้าหมายใน ${plan.years} ปี`
    : reachedYears === 0 ? 'ถึงเป้าหมายแล้ววันนี้' : `ประมาณ ${reachedYears.toFixed(1)} ปี`

  return {
    modelVersion: resolveCalculationModelVersion(plan.calculationModel?.version),
    futureValue: result.total,
    investedValue: result.invested,
    cashDividends: result.cashDividends,
    grossFutureValue: result.gross,
    afterFeeFutureValue: result.afterFee,
    realValue: finite(realValue),
    contributed: result.contributed,
    investmentGrowth: result.total - result.contributed,
    grossAnnualReturn,
    netAnnualReturn,
    fxImpact,
    feeDrag: Math.max(0, result.gross - result.afterFee),
    taxDrag: Math.max(0, result.afterFee - result.total),
    requiredMonthly: requiredMonthlyContribution(plan),
    requiredInitial: requiredInitialInvestment(plan),
    fundingGap: Math.max(0, plan.targetAmount - result.total),
    targetReachedMonth: result.reachedMonth,
    targetDateLabel,
    annualDividendAtGoal: result.invested * (netDividendAnnual / 100),
    progress: plan.targetAmount > 0 ? Math.min(100, result.total / plan.targetAmount * 100) : 100,
    depositGrossFutureValue: result.depositGross,
    depositNetFutureValue: result.depositNet,
    depositDifference: result.total - result.depositNet,
    points: result.points,
  }
}

export function calculateWealthMetrics(plan: WealthPlan) {
  return calculateWealthHealth(plan)
}
