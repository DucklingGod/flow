import type { RetirementConfig, RetirementIncomeSource, WealthPlan, WithdrawalStrategy } from './schema'

export interface RetirementYear {
  age: number
  phase: 'accumulation' | 'retirement'
  openingBalance: number
  contribution: number
  investmentReturn: number
  recurringIncome: number
  oneTimeIncome: number
  livingExpense: number
  healthcareExpense: number
  withdrawal: number
  unmetExpense: number
  endingBalance: number
  equityAllocation: number
}

export interface RetirementResult {
  currentSavings: number
  capitalAtRetirement: number
  requiredCapitalAtRetirement: number
  fundingGapAtRetirement: number
  targetLegacyAtMaxAge: number
  legacyAtMaxAge: number
  depletionAge: number | null
  firstUnmetAge: number | null
  retirementMonthlyExpense: number
  retirementMonthlyIncome: number
  firstYearWithdrawalRate: number
  totalWithdrawals: number
  totalRetirementIncome: number
  duplicateIncomeIds: string[]
  points: RetirementYear[]
  warnings: string[]
}

const finite = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0
const annualValue = (source: RetirementIncomeSource) => source.frequency === 'monthly' ? source.amount * 12 : source.frequency === 'annual' ? source.amount : 0

function uniqueIncomeSources(sources: RetirementIncomeSource[]) {
  const seen = new Set<string>()
  const duplicateIds = new Set<string>()
  const unique = sources.filter((source) => {
    if (seen.has(source.id)) { duplicateIds.add(source.id); return false }
    seen.add(source.id)
    return true
  })
  return { unique, duplicateIds: [...duplicateIds] }
}

function sourceAmountAtAge(source: RetirementIncomeSource, age: number) {
  if (age < source.startAge || (source.endAge !== null && age > source.endAge)) return { recurring: 0, oneTime: 0 }
  const growth = Math.pow(1 + source.inflationRate / 100, Math.max(0, age - source.startAge))
  if (source.frequency === 'oneTime') return { recurring: 0, oneTime: age === source.startAge ? source.amount * growth : 0 }
  return { recurring: annualValue(source) * growth, oneTime: 0 }
}

function expenseAtAge(config: RetirementConfig, age: number) {
  const elapsed = Math.max(0, age - config.currentAge)
  return {
    living: config.monthlyLivingExpenseToday * 12 * Math.pow(1 + config.inflationRate / 100, elapsed),
    healthcare: config.monthlyHealthcareToday * 12 * Math.pow(1 + config.healthcareInflationRate / 100, elapsed),
  }
}

function equityAtAge(config: RetirementConfig, age: number) {
  const span = Math.max(1, config.maxAge - config.retirementAge)
  const progress = Math.max(0, Math.min(1, (age - config.retirementAge) / span))
  return config.glidePathStartEquity + (config.glidePathEndEquity - config.glidePathStartEquity) * progress
}

function returnAtAge(config: RetirementConfig, age: number) {
  const equity = equityAtAge(config, age) / 100
  const equityReturn = config.postRetirementReturn + 1.25
  const bondReturn = config.postRetirementReturn - 1.25
  return equityReturn * equity + bondReturn * (1 - equity) - (age === config.retirementAge ? config.retirementShockPercent : 0)
}

interface PostResult { points: RetirementYear[]; depletionAge: number | null; firstUnmetAge: number | null; totalWithdrawals: number; totalIncome: number }

function simulatePostRetirement(config: RetirementConfig, sources: RetirementIncomeSource[], startingBalance: number): PostResult {
  const points: RetirementYear[] = []
  let balance = finite(startingBalance)
  let plannedGuardrailWithdrawal = 0
  let depletionAge: number | null = null
  let firstUnmetAge: number | null = null
  let totalWithdrawals = 0
  let totalIncome = 0
  let cashBucket = 0
  let growthBucket = balance

  if (config.withdrawalStrategy === 'bucket') {
    const firstExpense = expenseAtAge(config, config.retirementAge)
    const firstIncome = sources.reduce((sum, source) => sum + sourceAmountAtAge(source, config.retirementAge).recurring, 0)
    cashBucket = Math.min(balance, Math.max(0, firstExpense.living + firstExpense.healthcare - firstIncome) * config.cashBucketYears)
    growthBucket = balance - cashBucket
  }

  for (let age = config.retirementAge; age <= config.maxAge; age += 1) {
    const openingBalance = config.withdrawalStrategy === 'bucket' ? cashBucket + growthBucket : balance
    const { living, healthcare } = expenseAtAge(config, age)
    let recurringIncome = 0
    let oneTimeIncome = 0
    for (const source of sources) {
      const amount = sourceAmountAtAge(source, age)
      recurringIncome += amount.recurring
      oneTimeIncome += amount.oneTime
    }
    totalIncome += recurringIncome + oneTimeIncome
    const expenseGap = Math.max(0, living + healthcare - recurringIncome)
    const annualReturn = returnAtAge(config, age)
    const equityAllocation = equityAtAge(config, age)
    let investmentReturn = 0
    let withdrawal = 0
    let unmetExpense = 0

    if (config.withdrawalStrategy === 'bucket') {
      cashBucket += oneTimeIncome
      const cashReturn = cashBucket * .01
      const growthReturn = growthBucket * annualReturn / 100
      cashBucket += cashReturn
      growthBucket = Math.max(0, growthBucket + growthReturn)
      investmentReturn = cashReturn + growthReturn
      const fromCash = Math.min(cashBucket, expenseGap)
      cashBucket -= fromCash
      const remaining = expenseGap - fromCash
      const fromGrowth = Math.min(growthBucket, remaining)
      growthBucket -= fromGrowth
      withdrawal = fromCash + fromGrowth
      unmetExpense = Math.max(0, expenseGap - withdrawal)
      if (growthReturn > 0 && config.cashBucketYears > 0) {
        const targetCash = expenseGap * config.cashBucketYears
        const refill = Math.min(growthBucket, Math.max(0, targetCash - cashBucket), growthReturn)
        growthBucket -= refill
        cashBucket += refill
      }
      balance = cashBucket + growthBucket
    } else {
      balance += oneTimeIncome
      investmentReturn = balance * annualReturn / 100
      balance = Math.max(0, balance + investmentReturn)
      let withdrawalLimit = expenseGap
      if (config.withdrawalStrategy === 'percentage') withdrawalLimit = openingBalance * config.initialWithdrawalRate / 100
      if (config.withdrawalStrategy === 'guardrails') {
        if (age === config.retirementAge) plannedGuardrailWithdrawal = Math.min(expenseGap, openingBalance * config.initialWithdrawalRate / 100)
        else plannedGuardrailWithdrawal *= 1 + config.inflationRate / 100
        const currentRate = openingBalance > 0 ? plannedGuardrailWithdrawal / openingBalance * 100 : Infinity
        if (currentRate > config.guardrailUpperRate) plannedGuardrailWithdrawal *= 1 - config.guardrailCutPercent / 100
        else if (currentRate < config.guardrailLowerRate) plannedGuardrailWithdrawal *= 1 + config.guardrailRaisePercent / 100
        withdrawalLimit = plannedGuardrailWithdrawal
      }
      withdrawal = Math.min(balance, expenseGap, Math.max(0, withdrawalLimit))
      balance = Math.max(0, balance - withdrawal)
      unmetExpense = Math.max(0, expenseGap - withdrawal)
    }

    if (unmetExpense > .01 && firstUnmetAge === null) firstUnmetAge = age
    if (balance <= .01 && expenseGap > 0 && depletionAge === null) depletionAge = age
    totalWithdrawals += withdrawal
    points.push({ age, phase: 'retirement', openingBalance, contribution: 0, investmentReturn, recurringIncome, oneTimeIncome, livingExpense: living, healthcareExpense: healthcare, withdrawal, unmetExpense, endingBalance: finite(balance), equityAllocation })
  }
  return { points, depletionAge, firstUnmetAge, totalWithdrawals, totalIncome }
}

function requiredCapital(config: RetirementConfig, sources: RetirementIncomeSource[], legacyTarget: number) {
  const meets = (capital: number) => {
    const result = simulatePostRetirement(config, sources, capital)
    const last = result.points.at(-1)
    return result.firstUnmetAge === null && (last?.endingBalance ?? 0) >= legacyTarget
  }
  if (meets(0)) return 0
  let high = 1_000_000
  while (high < 100_000_000_000 && !meets(high)) high *= 2
  high = Math.min(high, 100_000_000_000)
  if (!meets(high)) return high
  let low = 0
  for (let index = 0; index < 70; index += 1) {
    const middle = (low + high) / 2
    if (meets(middle)) high = middle
    else low = middle
  }
  return high
}

export function calculateRetirement(plan: WealthPlan): RetirementResult {
  const config = plan.retirementConfig
  const retirementAge = Math.max(config.currentAge + 1, config.retirementAge)
  const maxAge = Math.max(retirementAge + 1, config.maxAge)
  const normalizedConfig = { ...config, retirementAge, maxAge }
  const selected = new Set(config.fundingAccountIds)
  const currentSavings = plan.accounts.filter((account) => selected.has(account.id)).reduce((sum, account) => sum + account.balance, 0)
  const { unique: incomeSources, duplicateIds } = uniqueIncomeSources(config.incomeSources)
  const points: RetirementYear[] = []
  let balance = currentSavings

  for (let age = config.currentAge; age < retirementAge; age += 1) {
    const openingBalance = balance
    const investmentReturn = balance * config.preRetirementReturn / 100
    const contribution = config.monthlyContribution * 12
    balance = finite(balance + investmentReturn + contribution)
    points.push({ age, phase: 'accumulation', openingBalance, contribution, investmentReturn, recurringIncome: 0, oneTimeIncome: 0, livingExpense: 0, healthcareExpense: 0, withdrawal: 0, unmetExpense: 0, endingBalance: balance, equityAllocation: 100 })
  }

  const capitalAtRetirement = balance
  const post = simulatePostRetirement(normalizedConfig, incomeSources, capitalAtRetirement)
  points.push(...post.points)
  const targetLegacyAtMaxAge = config.legacyTargetToday * Math.pow(1 + config.inflationRate / 100, maxAge - config.currentAge)
  const requiredCapitalAtRetirement = requiredCapital(normalizedConfig, incomeSources, targetLegacyAtMaxAge)
  const retirementExpense = expenseAtAge(normalizedConfig, retirementAge)
  const retirementIncome = incomeSources.reduce((sum, source) => sum + sourceAmountAtAge(source, retirementAge).recurring, 0)
  const firstRetirementPoint = post.points[0]
  const warnings = ['ผลลัพธ์เป็นแบบจำลองกระแสเงินสดจากสมมติฐาน ไม่ใช่คำรับรองว่าเงินจะเพียงพอจริง']
  if (!config.fundingAccountIds.length) warnings.push('ยังไม่ได้เลือกบัญชีเงินเกษียณ เงินตั้งต้นจึงเป็นศูนย์')
  if (duplicateIds.length) warnings.push(`ตัดรายการรายได้ ID ซ้ำออกจากการคำนวณ: ${duplicateIds.join(', ')}`)
  if (retirementAge !== config.retirementAge || maxAge !== config.maxAge) warnings.push('ระบบปรับช่วงอายุให้ retirement age และ max age อยู่หลังอายุปัจจุบัน')
  if (incomeSources.some((source) => source.taxablePercent > 0)) warnings.push('รายได้ที่ทำเครื่องหมายว่าต้องเสียภาษียังแสดงเป็นยอดก่อนภาษี จนกว่า Tax Studio จะผ่าน expert review')

  return {
    currentSavings,
    capitalAtRetirement,
    requiredCapitalAtRetirement,
    fundingGapAtRetirement: Math.max(0, requiredCapitalAtRetirement - capitalAtRetirement),
    targetLegacyAtMaxAge,
    legacyAtMaxAge: post.points.at(-1)?.endingBalance ?? capitalAtRetirement,
    depletionAge: post.depletionAge,
    firstUnmetAge: post.firstUnmetAge,
    retirementMonthlyExpense: (retirementExpense.living + retirementExpense.healthcare) / 12,
    retirementMonthlyIncome: retirementIncome / 12,
    firstYearWithdrawalRate: capitalAtRetirement > 0 ? (firstRetirementPoint?.withdrawal ?? 0) / capitalAtRetirement * 100 : 0,
    totalWithdrawals: post.totalWithdrawals,
    totalRetirementIncome: post.totalIncome,
    duplicateIncomeIds: duplicateIds,
    points,
    warnings,
  }
}

export const withdrawalStrategyLabels: Record<WithdrawalStrategy, string> = {
  fixedReal: 'ถอนตามค่าใช้จ่ายจริง',
  percentage: 'จำกัดเป็น % ของพอร์ต',
  guardrails: 'Guardrails ปรับตามพอร์ต',
  bucket: 'Bucket เงินสด + พอร์ตเติบโต',
}
