import type { Debt, WealthPlan } from './schema'

export interface WealthDriver {
  id: 'runway' | 'savings' | 'debt'
  label: string
  value: string
  points: number
  status: 'strong' | 'watch' | 'urgent'
  reason: string
  action: string
}

export interface DebtPayoffResult {
  strategy: 'avalanche' | 'snowball'
  months: number | null
  totalInterest: number
  totalPaid: number
  payoffOrder: string[]
  feasible: boolean
}

const monthlyAmount = (amount: number, frequency: 'monthly' | 'annual') => frequency === 'annual' ? amount / 12 : amount

export function reconcileWealth(plan: WealthPlan) {
  const assets = plan.accounts.reduce((sum, account) => sum + account.balance, 0)
  const cash = plan.accounts.filter((account) => account.type === 'cash').reduce((sum, account) => sum + account.balance, 0)
  const investments = plan.accounts.filter((account) => account.type === 'investment').reduce((sum, account) => sum + account.balance, 0)
  const property = plan.accounts.filter((account) => account.type === 'property').reduce((sum, account) => sum + account.balance, 0)
  const debt = plan.debts.reduce((sum, item) => sum + item.balance, 0)
  const monthlyIncome = plan.cashFlows.filter((entry) => entry.type === 'income').reduce((sum, entry) => sum + monthlyAmount(entry.amount, entry.frequency), 0)
  const monthlyExpense = plan.cashFlows.filter((entry) => entry.type === 'expense').reduce((sum, entry) => sum + monthlyAmount(entry.amount, entry.frequency), 0)
  const monthlySurplus = monthlyIncome - monthlyExpense
  const emergencyMonths = monthlyExpense > 0 ? cash / monthlyExpense : 0
  const savingsRate = monthlyIncome > 0 ? monthlySurplus / monthlyIncome * 100 : 0
  const debtToAssets = assets > 0 ? debt / assets * 100 : debt > 0 ? 100 : 0
  const netWorth = assets - debt
  return { assets, cash, investments, property, debt, netWorth, monthlyIncome, monthlyExpense, monthlySurplus, emergencyMonths, savingsRate, debtToAssets }
}

export function calculateWealthHealth(plan: WealthPlan) {
  const wealth = reconcileWealth(plan)
  const runwayPoints = Math.round(Math.max(0, Math.min(35, wealth.emergencyMonths / 6 * 35)))
  const savingsPoints = Math.round(Math.max(0, Math.min(35, wealth.savingsRate / 20 * 35)))
  const debtPoints = Math.round(Math.max(0, Math.min(30, 30 - wealth.debtToAssets * .6)))
  const drivers: WealthDriver[] = [
    {
      id: 'runway', label: 'เงินสำรอง', value: `${wealth.emergencyMonths.toFixed(1)} เดือน`, points: runwayPoints,
      status: wealth.emergencyMonths >= 6 ? 'strong' : wealth.emergencyMonths >= 3 ? 'watch' : 'urgent',
      reason: `เงินสดปัจจุบันครอบคลุมค่าใช้จ่ายได้ ${wealth.emergencyMonths.toFixed(1)} เดือน`,
      action: wealth.emergencyMonths >= 6 ? 'รักษาระดับเงินสำรอง 6–12 เดือน' : `เติมเงินสำรองอีก ${Math.max(0, wealth.monthlyExpense * 6 - wealth.cash).toLocaleString('th-TH')} บาท`,
    },
    {
      id: 'savings', label: 'อัตราออม', value: `${wealth.savingsRate.toFixed(1)}%`, points: savingsPoints,
      status: wealth.savingsRate >= 20 ? 'strong' : wealth.savingsRate >= 10 ? 'watch' : 'urgent',
      reason: `กระแสเงินสดเหลือ ${wealth.monthlySurplus.toLocaleString('th-TH')} บาทต่อเดือน`,
      action: wealth.savingsRate >= 20 ? 'จัดสรรเงินเหลือเข้าตามเป้าหมาย' : 'ทบทวนรายจ่ายหรือเพิ่มรายได้ให้เหลืออย่างน้อย 20%',
    },
    {
      id: 'debt', label: 'ภาระหนี้', value: `${wealth.debtToAssets.toFixed(1)}% ของทรัพย์สิน`, points: debtPoints,
      status: wealth.debtToAssets <= 30 ? 'strong' : wealth.debtToAssets <= 50 ? 'watch' : 'urgent',
      reason: `หนี้รวมคิดเป็น ${wealth.debtToAssets.toFixed(1)}% ของทรัพย์สิน`,
      action: wealth.debtToAssets <= 30 ? 'ชำระขั้นต่ำตรงเวลาและทบทวนดอกเบี้ยรายปี' : 'เร่งหนี้ดอกเบี้ยสูงก่อนเพิ่มความเสี่ยงลงทุน',
    },
  ]
  return { ...wealth, score: runwayPoints + savingsPoints + debtPoints, drivers }
}

function payoffPriority(debts: Debt[], strategy: DebtPayoffResult['strategy']) {
  return [...debts].sort((a, b) => strategy === 'avalanche'
    ? b.annualRate - a.annualRate || a.balance - b.balance
    : a.balance - b.balance || b.annualRate - a.annualRate)
}

export function simulateDebtStrategy(source: Debt[], strategy: DebtPayoffResult['strategy'], extraMonthly: number): DebtPayoffResult {
  const debts = source.filter((debt) => debt.balance > 0).map((debt) => ({ ...debt }))
  const payoffOrder: string[] = []
  let totalInterest = 0
  let totalPaid = 0
  let months = 0
  const maximumMonths = 1_200

  while (debts.some((debt) => debt.balance > .005) && months < maximumMonths) {
    months += 1
    for (const debt of debts) {
      if (debt.balance <= 0) continue
      const interest = debt.balance * debt.annualRate / 100 / 12
      debt.balance += interest
      totalInterest += interest
    }

    let rollover = Math.max(0, extraMonthly)
    for (const debt of debts) {
      if (debt.balance <= 0) rollover += debt.minimumPayment
      else {
        const paid = Math.min(debt.balance, debt.minimumPayment)
        debt.balance -= paid
        totalPaid += paid
        rollover += Math.max(0, debt.minimumPayment - paid)
        if (debt.balance <= .005 && !payoffOrder.includes(debt.id)) payoffOrder.push(debt.id)
      }
    }

    for (const debt of payoffPriority(debts.filter((debt) => debt.balance > .005), strategy)) {
      if (rollover <= 0) break
      const paid = Math.min(debt.balance, rollover)
      debt.balance -= paid
      totalPaid += paid
      rollover -= paid
      if (debt.balance <= .005 && !payoffOrder.includes(debt.id)) payoffOrder.push(debt.id)
    }
  }

  const feasible = debts.every((debt) => debt.balance <= .005)
  return { strategy, months: feasible ? months : null, totalInterest, totalPaid, payoffOrder, feasible }
}

export function compareRefinance(debt: Debt, newAnnualRate: number, fee: number) {
  const current = simulateDebtStrategy([debt], 'avalanche', 0)
  const refinanced = simulateDebtStrategy([{ ...debt, annualRate: Math.max(0, newAnnualRate) }], 'avalanche', 0)
  const grossSaving = current.totalInterest - refinanced.totalInterest
  return { current, refinanced, fee: Math.max(0, fee), netSaving: grossSaving - Math.max(0, fee), worthwhile: grossSaving > Math.max(0, fee) }
}

export function compareDebtVsInvest(debtAnnualRate: number, modeledNetReturn: number) {
  const debtReturn = Math.max(0, debtAnnualRate)
  const investmentReturn = modeledNetReturn
  const spread = investmentReturn - debtReturn
  return {
    debtReturn,
    investmentReturn,
    spread,
    preference: spread > 2 ? 'invest' as const : 'debt' as const,
    reason: spread > 2
      ? 'ผลตอบแทนลงทุนตามแบบจำลองสูงกว่าดอกเบี้ยเกิน 2% แต่ยังมีความผันผวนและขาดทุนได้'
      : 'ผลประหยัดดอกเบี้ยมีความแน่นอนกว่า และส่วนต่างผลตอบแทนลงทุนไม่ชดเชยความเสี่ยงชัดเจน',
  }
}

export function cashFlowTrend(plan: WealthPlan) {
  const rows = new Map<string, { month: string; income: number; expense: number }>()
  for (const item of plan.cashFlowHistory) {
    const row = rows.get(item.month) ?? { month: item.month, income: 0, expense: 0 }
    row[item.type] += item.amount
    rows.set(item.month, row)
  }
  return [...rows.values()].sort((a, b) => a.month.localeCompare(b.month))
}
