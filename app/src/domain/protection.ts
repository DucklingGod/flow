import type { Debt, WealthPlan } from './schema'

export interface ProtectionResult {
  monthlyIncome: number
  monthlyExpense: number
  availableEmergencyCash: number
  emergencyReserveTarget: number
  emergencyReserveGap: number
  debtPayoffNeed: number
  incomeReplacementNeed: number
  educationNeed: number
  finalExpenseNeed: number
  lifeCoverageNeed: number
  lifeCoverageGap: number
  healthAnnualTarget: number
  healthAnnualGap: number
  disabilityMonthlyTarget: number
  disabilityMonthlyGap: number
  dependantCount: number
  duplicateDebtIds: string[]
  warnings: string[]
}

const finite = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0

function uniqueDebts(debts: Debt[]) {
  const seen = new Set<string>()
  const duplicateIds = new Set<string>()
  const unique = debts.filter((debt) => {
    if (seen.has(debt.id)) { duplicateIds.add(debt.id); return false }
    seen.add(debt.id)
    return true
  })
  return { unique, duplicateIds: [...duplicateIds] }
}

export function calculateProtection(plan: WealthPlan): ProtectionResult {
  const config = plan.protectionConfig
  const monthlyIncome = finite(plan.netWorth.monthlyIncome)
  const monthlyExpense = finite(plan.netWorth.monthlyExpense)
  const availableEmergencyCash = plan.accounts.filter((account) => account.type === 'cash').reduce((sum, account) => sum + finite(account.balance), 0)
  const emergencyReserveTarget = monthlyExpense * finite(config.emergencyMonthsTarget)
  const { unique: debts, duplicateIds } = uniqueDebts(plan.debts)
  const debtLedgerTotal = debts.reduce((sum, debt) => sum + finite(debt.balance), 0)
  const debtPayoffNeed = debtLedgerTotal > 0 ? debtLedgerTotal : finite(plan.netWorth.debt)
  const hasDependants = config.dependantCount > 0
  const incomeReplacementNeed = hasDependants
    ? monthlyIncome * 12 * finite(config.incomeReplacementYears) * finite(config.incomeReplacementPercent) / 100
    : 0
  const educationNeed = finite(config.educationCommitments)
  const finalExpenseNeed = finite(config.finalExpenses)
  const lifeCoverageNeed = debtPayoffNeed + incomeReplacementNeed + educationNeed + finalExpenseNeed
  const disabilityMonthlyTarget = monthlyIncome * finite(config.incomeReplacementPercent) / 100
  const warnings = [
    'Protection Gap เป็นแบบประเมินความต้องการ ไม่ใช่คำแนะนำให้ซื้อผลิตภัณฑ์หรือการรับประกันว่าจะเคลมได้',
    'วงเงินสุขภาพเป็น annual limit แบบง่าย ยังไม่รวม deductible, co-pay, exclusions และเงื่อนไขกรมธรรม์',
  ]
  if (!hasDependants) warnings.push('ไม่มีผู้พึ่งพิง จึงไม่นับ income replacement ใน life coverage แต่ยังคงหนี้ การศึกษา และค่าใช้จ่ายสุดท้าย')
  if (duplicateIds.length) warnings.push(`ตัดรายการหนี้ ID ซ้ำออกจากการคำนวณ: ${duplicateIds.join(', ')}`)
  if (debtLedgerTotal > 0 && Math.abs(debtLedgerTotal - finite(plan.netWorth.debt)) > 1) warnings.push('ยอดหนี้ใน debt ledger ต่างจาก net worth summary ระบบใช้ debt ledger เพื่อเลี่ยงการนับซ้ำ')

  return {
    monthlyIncome,
    monthlyExpense,
    availableEmergencyCash,
    emergencyReserveTarget,
    emergencyReserveGap: Math.max(0, emergencyReserveTarget - availableEmergencyCash),
    debtPayoffNeed,
    incomeReplacementNeed,
    educationNeed,
    finalExpenseNeed,
    lifeCoverageNeed,
    lifeCoverageGap: Math.max(0, lifeCoverageNeed - finite(config.existingLifeCover)),
    healthAnnualTarget: finite(config.targetHealthAnnualLimit),
    healthAnnualGap: Math.max(0, finite(config.targetHealthAnnualLimit) - finite(config.existingHealthAnnualLimit)),
    disabilityMonthlyTarget,
    disabilityMonthlyGap: Math.max(0, disabilityMonthlyTarget - finite(config.existingDisabilityMonthlyBenefit)),
    dependantCount: config.dependantCount,
    duplicateDebtIds: duplicateIds,
    warnings,
  }
}
