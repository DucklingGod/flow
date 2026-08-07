import type { LifeGoal, WealthPlan } from './schema'
import { reconcileWealth } from './wealth'

export interface GoalAllocation {
  goal: LifeGoal
  monthsRemaining: number
  inflationAdjustedTarget: number
  fundingGap: number
  requiredMonthly: number
  allocatedMonthly: number
  projectedAmount: number
  successProbability: number
  reason: string
  collision: boolean
}

function monthIndex(value: string) {
  const [year, month] = value.split('-').map(Number)
  return year * 12 + month - 1
}

export function monthsUntil(targetMonth: string, from = new Date()) {
  return Math.max(0, monthIndex(targetMonth) - (from.getFullYear() * 12 + from.getMonth()))
}

export function allocateGoalFunding(plan: WealthPlan, from = new Date()) {
  const wealth = reconcileWealth(plan)
  const requestedBudget = Math.max(0, plan.monthlyGoalBudget)
  const availableBudget = Math.max(0, Math.min(requestedBudget, wealth.monthlySurplus))
  const debtAllocation = plan.debts.some((debt) => debt.balance > 0)
    ? Math.min(availableBudget, Math.max(0, plan.debtExtraPayment))
    : 0
  let remainingBudget = Math.max(0, availableBudget - debtAllocation)
  const ordered = [...plan.goals].sort((a, b) => b.priority - a.priority || monthsUntil(a.targetDate, from) - monthsUntil(b.targetDate, from) || a.id.localeCompare(b.id))
  const results = new Map<string, GoalAllocation>()

  for (const goal of ordered) {
    const monthsRemaining = monthsUntil(goal.targetDate, from)
    const years = monthsRemaining / 12
    const inflationAdjustedTarget = goal.targetAmount * Math.pow(1 + goal.inflationRate / 100, years)
    const fundingGap = Math.max(0, inflationAdjustedTarget - goal.fundedAmount)
    const requiredMonthly = monthsRemaining > 0 ? Math.max(goal.minimumMonthly, fundingGap / monthsRemaining) : fundingGap
    const hasMember = !goal.memberId || plan.householdMembers.some((member) => member.id === goal.memberId)
    const hasAccount = !goal.fundingAccountId || plan.accounts.some((account) => account.id === goal.fundingAccountId)
    let allocatedMonthly = 0
    let reason = ''

    if (goal.status === 'completed') reason = 'เป้าหมายเสร็จแล้ว จึงไม่กันเงินเพิ่ม'
    else if (goal.status === 'cancelled') reason = 'เป้าหมายถูกยกเลิกและไม่นับในงบ'
    else if (goal.status === 'paused') reason = 'พักการออมชั่วคราวตามที่กำหนด'
    else if (!hasMember) reason = 'สมาชิกเจ้าของเป้าหมายถูกลบ กรุณามอบหมายใหม่'
    else if (!hasAccount) reason = 'ไม่พบบัญชีเงินทุน กรุณาเลือกบัญชีใหม่'
    else if (fundingGap <= 0) reason = 'มีเงินรองรับเป้าหมายครบแล้ว'
    else if (availableBudget <= 0) reason = wealth.monthlySurplus <= 0 ? 'กระแสเงินสดไม่เหลือสำหรับเป้าหมาย' : 'งบเป้าหมายถูกพักไว้ที่ 0 บาท'
    else {
      allocatedMonthly = Math.min(remainingBudget, requiredMonthly)
      remainingBudget -= allocatedMonthly
      reason = allocatedMonthly + .01 >= requiredMonthly
        ? 'ได้รับงบตามจำนวนที่ต้องใช้ต่อเดือน'
        : `งบชนกับเป้าหมายสำคัญกว่า ขาดอีก ${Math.max(0, requiredMonthly - allocatedMonthly).toLocaleString('th-TH')} บาท/เดือน`
    }

    const projectedAmount = goal.fundedAmount + allocatedMonthly * monthsRemaining
    const successProbability = goal.status === 'completed' || fundingGap <= 0
      ? 100
      : goal.status === 'cancelled' ? 0 : Math.max(0, Math.min(100, projectedAmount / Math.max(1, inflationAdjustedTarget) * 100))
    results.set(goal.id, {
      goal, monthsRemaining, inflationAdjustedTarget, fundingGap, requiredMonthly, allocatedMonthly,
      projectedAmount, successProbability, reason,
      collision: goal.status === 'active' && fundingGap > 0 && allocatedMonthly + .01 < requiredMonthly,
    })
  }

  const allocations = plan.goals.map((goal) => results.get(goal.id)!)
  return {
    requestedBudget,
    availableBudget,
    debtAllocation,
    goalAllocation: allocations.reduce((sum, item) => sum + item.allocatedMonthly, 0),
    unallocated: remainingBudget,
    cashFlowLimited: requestedBudget > availableBudget,
    collisions: allocations.filter((item) => item.collision).length,
    allocations,
  }
}
