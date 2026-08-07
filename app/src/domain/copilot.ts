import { calculateProjection } from './finance/projection'
import { allocateGoalFunding } from './goals'
import { analyzePortfolio, buildRebalancePreview } from './portfolio'
import { calculateProtection } from './protection'
import { calculateRetirement } from './retirement'
import type { CopilotAuditEvent, CopilotConsent, CopilotRecommendation, WealthPlan } from './schema'
import { calculateTax } from './tax'
import { reconcileWealth } from './wealth'

export interface PlanningContext {
  schemaVersion: 1
  generatedAt: string
  fieldsShared: string[]
  netWorth?: { assets: number; debt: number; netWorth: number; monthlyIncome: number; monthlyExpense: number; monthlySurplus: number; emergencyMonths: number }
  goals?: Array<{ type: string; status: string; priority: number; targetDate: string; fundingGap: number; allocatedMonthly: number; readiness: number; collision: boolean }>
  portfolio?: { totalValue: number; annualFeeBaht: number; unhedgedFxWeight: number; concentrationHhi: number; outsideBandCount: number; staleHoldingCount: number }
  retirement?: { retirementAge: number; capitalAtRetirement: number; fundingGapAtRetirement: number; depletionAge: number | null; firstUnmetAge: number | null }
  protection?: { expertReviewStatus: string; enabled: boolean; emergencyReserveGap: number | null; lifeCoverageGap: number | null; healthAnnualGap: number | null; disabilityMonthlyGap: number | null }
  tax?: { taxYear: number; datasetVersion: string; expertReviewStatus: string; enabled: boolean; status: string; taxableIncome: number | null; estimatedTax: number | null; taxPayable: number | null }
}

export interface CopilotBrief {
  headline: string
  status: Array<{ label: string; value: string; tone: 'good' | 'watch' | 'urgent'; source: string; asOf: string }>
  recommendations: CopilotRecommendation[]
  context: PlanningContext
  warnings: string[]
}

export type InputScreenResult = { allowed: true } | { allowed: false; reason: 'empty' | 'too-long' | 'prompt-injection' | 'transaction-attempt' | 'sensitive-data' }

const injectionPatterns = [
  /ignore\s+(all\s+)?previous/i, /system\s+prompt/i, /developer\s+message/i, /jailbreak/i, /bypass\s+(the\s+)?rules/i,
  /ลืมคำสั่ง|ไม่ต้องทำตาม|ข้ามกฎ|เปิดเผยคำสั่ง/i,
]
const transactionPatterns = [
  /\b(?:buy|sell)\s+(?:stock|fund|share|crypto|etf)\b/i, /\b(trade|transfer|withdraw|place\s+order|execute\s+order)\b/i, /ซื้อขายให้|ส่งคำสั่ง|โอนเงิน|ถอนเงิน|เข้าบัญชีโบรกเกอร์/i,
]
const sensitivePatterns = [
  /\b\d{13}\b/, /\b(?:\d[ -]*?){13,19}\b/, /private\s*key|seed\s*phrase|password|api\s*key|รหัสผ่าน|เลขบัตรประชาชน/i,
]

export function screenCopilotInput(input: string): InputScreenResult {
  const value = input.trim()
  if (!value) return { allowed: false, reason: 'empty' }
  if (value.length > 2_000) return { allowed: false, reason: 'too-long' }
  if (injectionPatterns.some((pattern) => pattern.test(value))) return { allowed: false, reason: 'prompt-injection' }
  if (transactionPatterns.some((pattern) => pattern.test(value))) return { allowed: false, reason: 'transaction-attempt' }
  if (sensitivePatterns.some((pattern) => pattern.test(value))) return { allowed: false, reason: 'sensitive-data' }
  return { allowed: true }
}

const ageHours = (date: string, now: Date) => Math.max(0, (now.getTime() - Date.parse(date)) / 3_600_000)

export function buildPlanningContext(plan: WealthPlan, consent: CopilotConsent = plan.copilotConfig.consent, now = new Date()): PlanningContext {
  const context: PlanningContext = { schemaVersion: 1, generatedAt: now.toISOString(), fieldsShared: [] }
  if (consent.netWorth) {
    const wealth = reconcileWealth(plan)
    context.netWorth = { assets: wealth.assets, debt: wealth.debt, netWorth: wealth.netWorth, monthlyIncome: wealth.monthlyIncome, monthlyExpense: wealth.monthlyExpense, monthlySurplus: wealth.monthlySurplus, emergencyMonths: wealth.emergencyMonths }
    context.fieldsShared.push('netWorth')
  }
  if (consent.goals) {
    context.goals = allocateGoalFunding(plan, now).allocations.map((item) => ({ type: item.goal.type, status: item.goal.status, priority: item.goal.priority, targetDate: item.goal.targetDate, fundingGap: item.fundingGap, allocatedMonthly: item.allocatedMonthly, readiness: item.successProbability, collision: item.collision }))
    context.fieldsShared.push('goals')
  }
  if (consent.portfolio) {
    const portfolio = analyzePortfolio(plan)
    context.portfolio = {
      totalValue: portfolio.totalValue, annualFeeBaht: portfolio.annualFeeBaht, unhedgedFxWeight: portfolio.unhedgedFxWeight, concentrationHhi: portfolio.concentrationHhi,
      outsideBandCount: buildRebalancePreview(plan).filter((item) => item.outsideBand).length,
      staleHoldingCount: plan.holdings.filter((item) => ageHours(item.sourceAsOf, now) > item.sourceStaleAfterHours || item.sourceValidationStatus !== 'valid').length,
    }
    context.fieldsShared.push('portfolio')
  }
  if (consent.retirement) {
    const retirement = calculateRetirement(plan)
    context.retirement = { retirementAge: plan.retirementConfig.retirementAge, capitalAtRetirement: retirement.capitalAtRetirement, fundingGapAtRetirement: retirement.fundingGapAtRetirement, depletionAge: retirement.depletionAge, firstUnmetAge: retirement.firstUnmetAge }
    context.fieldsShared.push('retirement')
  }
  if (consent.protection) {
    const protection = plan.protectionConfig.enabled ? calculateProtection(plan) : null
    context.protection = {
      expertReviewStatus: plan.protectionConfig.expertReviewStatus,
      enabled: plan.protectionConfig.enabled,
      emergencyReserveGap: protection?.emergencyReserveGap ?? null,
      lifeCoverageGap: protection?.lifeCoverageGap ?? null,
      healthAnnualGap: protection?.healthAnnualGap ?? null,
      disabilityMonthlyGap: protection?.disabilityMonthlyGap ?? null,
    }
    context.fieldsShared.push('protection')
  }
  if (consent.tax) {
    const tax = plan.taxProfile.enabled ? calculateTax(plan.taxProfile) : null
    context.tax = {
      taxYear: plan.taxProfile.taxYear,
      datasetVersion: plan.taxProfile.datasetVersion,
      expertReviewStatus: plan.taxProfile.expertReviewStatus,
      enabled: plan.taxProfile.enabled,
      status: tax?.status ?? 'disabled',
      taxableIncome: tax?.taxableIncome ?? null,
      estimatedTax: tax?.taxBeforeWithholding ?? null,
      taxPayable: tax?.taxPayable ?? null,
    }
    context.fieldsShared.push('tax')
  }
  return context
}

const money = (value: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(value)
const asOf = (plan: WealthPlan) => plan.updatedAt.slice(0, 10)

function recommendation(now: Date, index: number, value: Omit<CopilotRecommendation, 'id' | 'createdAt' | 'status' | 'dispositionReason'>): CopilotRecommendation {
  return { ...value, id: `copilot-${value.kind}-${now.getTime()}-${index}`, createdAt: now.toISOString(), status: 'pending', dispositionReason: '' }
}

export function generateCopilotBrief(plan: WealthPlan, now = new Date()): CopilotBrief {
  const context = buildPlanningContext(plan, plan.copilotConfig.consent, now)
  const projection = context.goals ? calculateProjection(plan) : null
  const recommendations: CopilotRecommendation[] = []
  const status: CopilotBrief['status'] = []
  let index = 0
  const evidence = (label: string, source: string) => [{ label, source, asOf: asOf(plan) }]

  if (context.netWorth) {
    status.push({ label: 'มูลค่าสุทธิ', value: money(context.netWorth.netWorth), tone: context.netWorth.netWorth >= 0 ? 'good' : 'urgent', source: 'Wealth Map reconciliation', asOf: asOf(plan) })
    status.push({ label: 'เงินสำรอง', value: `${context.netWorth.emergencyMonths.toFixed(1)} เดือน`, tone: context.netWorth.emergencyMonths >= 6 ? 'good' : context.netWorth.emergencyMonths >= 3 ? 'watch' : 'urgent', source: 'Cash / monthly expense', asOf: asOf(plan) })
    if (context.netWorth.emergencyMonths < 6) recommendations.push(recommendation(now, ++index, {
      kind: 'cashFlow', title: 'ปิดช่องว่างเงินสำรองก่อนเพิ่มความเสี่ยง', rationale: `เงินสดรองรับค่าใช้จ่ายได้ ${context.netWorth.emergencyMonths.toFixed(1)} เดือน ต่ำกว่าแนววางแผน 6 เดือน`,
      tradeoffs: ['เงินที่กันไว้จะลดสภาพคล่องสำหรับเป้าหมายอื่นชั่วคราว', 'เงินสำรองมีผลตอบแทนคาดหวังต่ำกว่าสินทรัพย์เสี่ยง'], assumptions: ['ใช้ค่าใช้จ่ายเฉลี่ยรายเดือนใน Wealth Map', 'เป้าหมาย 6 เดือนเป็นสมมติฐานวางแผน ไม่ใช่กฎตายตัว'],
      confidence: 'high', evidence: evidence('Emergency runway', 'Local deterministic calculation'), impact: `ช่องว่างประมาณ ${money(Math.max(0, context.netWorth.monthlyExpense * 6 - (plan.accounts.find((item) => item.type === 'cash')?.balance ?? 0)))}`, reversibility: 'แก้จำนวนเงินและเป้าหมายเดือนได้ทุกเมื่อ ไม่มีการโอนเงิน',
    }))
  }

  if (context.goals) {
    const collisions = context.goals.filter((item) => item.collision)
    status.push({ label: 'เป้าหมายชนงบ', value: `${collisions.length} เป้าหมาย`, tone: collisions.length ? 'watch' : 'good', source: 'Life Canvas allocator', asOf: asOf(plan) })
    if (collisions.length) recommendations.push(recommendation(now, ++index, {
      kind: 'goal', title: 'ทบทวนเป้าหมายที่ชนงบพร้อมกัน', rationale: `${collisions.length} เป้าหมายได้รับงบน้อยกว่าจำนวนที่แบบจำลองต้องใช้ต่อเดือน`,
      tradeoffs: ['เลื่อนเป้าหมายหนึ่งอาจช่วยอีกเป้าหมายแต่เปลี่ยนแผนชีวิต', 'เพิ่มงบเป้าหมายจะลดเงินเหลือสำหรับหนี้หรือเงินสำรอง'], assumptions: ['ใช้ลำดับ priority และวันที่เป้าหมายปัจจุบัน', 'readiness เป็น deterministic ratio ไม่ใช่โอกาสสำเร็จเชิงสถิติ'],
      confidence: 'high', evidence: evidence('Goal allocation collisions', 'Local Life Canvas calculation'), impact: 'ทำให้เห็น trade-off ของงบรายเดือนก่อนแก้จำนวนเงิน', reversibility: 'เปลี่ยน priority วันที่ หรือ budget กลับได้ และต้องกดยืนยันเอง',
    }))
  }

  if (context.portfolio) {
    const tone = context.portfolio.staleHoldingCount > 0 ? 'urgent' : context.portfolio.outsideBandCount > 0 ? 'watch' : 'good'
    status.push({ label: 'ข้อมูลพอร์ตที่ต้องทบทวน', value: `${context.portfolio.staleHoldingCount} stale · ${context.portfolio.outsideBandCount} นอก band`, tone, source: 'Portfolio X-Ray + provenance', asOf: asOf(plan) })
    if (context.portfolio.staleHoldingCount > 0) recommendations.push(recommendation(now, ++index, {
      kind: 'portfolio', title: 'ยืนยันข้อมูลพอร์ตก่อนพิจารณาปรับสัดส่วน', rationale: `มี ${context.portfolio.staleHoldingCount} holding ที่ stale หรือไม่ผ่าน validation จึงไม่ควรใช้เพื่อเสนอการเปลี่ยนพอร์ต`,
      tradeoffs: ['การรอข้อมูลใหม่อาจทำให้การทบทวนช้าลง', 'การใช้ snapshot เก่าอาจทำให้สัดส่วนและค่าธรรมเนียมคลาดเคลื่อน'], assumptions: ['freshness window มาจาก provenance ของแต่ละ holding', 'ไม่มีการประมาณราคาแทนข้อมูลที่ขาด'],
      confidence: 'high', evidence: evidence('Holding provenance status', 'Data Studio last-known-good register'), impact: 'ลดความเสี่ยงจากคำแนะนำที่อาศัยข้อมูลเก่า', reversibility: 'นำเข้า snapshot ใหม่หรือแก้เป็น user input ได้ ไม่มีคำสั่งซื้อขาย',
    }))
  }

  if (context.retirement) {
    status.push({ label: 'ช่องว่างเกษียณ', value: money(context.retirement.fundingGapAtRetirement), tone: context.retirement.fundingGapAtRetirement > 0 ? 'watch' : 'good', source: 'Retirement Studio cash-flow', asOf: asOf(plan) })
    if (context.retirement.fundingGapAtRetirement > 0) recommendations.push(recommendation(now, ++index, {
      kind: 'retirement', title: 'เปิดทางเลือกปิดช่องว่างเกษียณ', rationale: `แบบจำลองรายปีพบช่องว่าง ณ วันเกษียณประมาณ ${money(context.retirement.fundingGapAtRetirement)}`,
      tradeoffs: ['เพิ่มเงินออมลดเงินใช้วันนี้', 'เลื่อนเกษียณหรือปรับค่าใช้จ่ายเปลี่ยนคุณภาพชีวิต'], assumptions: ['ใช้ผลคำนวณ Retirement Studio และผลตอบแทนที่ผู้ใช้กำหนด', 'ไม่รับประกันผลตอบแทนหรืออายุขัย'],
      confidence: 'medium', evidence: evidence('Retirement funding gap', 'Local retirement cash-flow engine'), impact: 'เปิดให้เปรียบเทียบเพิ่มเงินออม เลื่อนอายุ หรือปรับค่าใช้จ่าย', reversibility: 'เป็น action สำหรับ review เท่านั้น ไม่แก้ค่าอัตโนมัติ',
    }))
  }

  if (context.protection) {
    const gap = (context.protection.emergencyReserveGap ?? 0) + (context.protection.lifeCoverageGap ?? 0) + (context.protection.healthAnnualGap ?? 0)
    status.push({ label: 'Protection review', value: context.protection.enabled ? money(gap) : 'ยังปิดอยู่', tone: context.protection.enabled && context.protection.expertReviewStatus === 'approved' ? 'watch' : 'urgent', source: 'Protection estimate', asOf: asOf(plan) })
  }

  if (context.tax) {
    status.push({ label: `ภาษีปี ${context.tax.taxYear}`, value: context.tax.enabled ? money(context.tax.taxPayable ?? 0) : 'ยังปิดอยู่', tone: context.tax.enabled && context.tax.expertReviewStatus === 'approved' ? 'watch' : 'urgent', source: context.tax.datasetVersion, asOf: asOf(plan) })
  }

  if (recommendations.length === 0) recommendations.push(recommendation(now, ++index, {
    kind: 'review', title: 'คงแผนและนัดทบทวนรอบถัดไป', rationale: 'ข้อมูลที่อนุญาตยังไม่พบช่องว่างเร่งด่วนตามกฎ deterministic ของ Copilot', tradeoffs: ['ภาวะตลาดและชีวิตอาจเปลี่ยนก่อนรอบถัดไป'],
    assumptions: ['ใช้เฉพาะหมวดข้อมูลที่ผู้ใช้อนุญาต', 'ไม่พบปัญหาไม่ได้แปลว่าไม่มีความเสี่ยง'], confidence: 'medium', evidence: evidence('Review status', 'Local planning context'), impact: 'ลดการเปลี่ยนแผนโดยไม่จำเป็น', reversibility: 'เริ่ม review ใหม่ได้ทุกเมื่อ',
  }))

  const warnings = [
    'Copilot รุ่นนี้สร้างสรุปจาก calculation outputs ในเครื่องและไม่ส่งข้อมูลออก',
    'Approve เป็นการเพิ่ม action ในแผน ไม่ใช่การซื้อขาย โอนเงิน ยื่นภาษี หรือเปลี่ยนบัญชีภายนอก',
  ]
  if (context.fieldsShared.length === 0) warnings.unshift('ยังไม่ได้อนุญาตข้อมูลหมวดใด Copilot จึงไม่มีหลักฐานเพียงพอ')
  const headline = !projection ? 'Copilot ใช้เฉพาะข้อมูลที่คุณอนุญาต' : projection.fundingGap > 0 ? `แผนหลักยังมีช่องว่าง ${money(projection.fundingGap)}` : 'แผนหลักอยู่เหนือเป้าหมายตามสมมติฐานปัจจุบัน'
  return { headline, status, recommendations, context, warnings }
}

function auditEvent(plan: WealthPlan, action: CopilotAuditEvent['action'], now: Date, fieldsShared: string[], reason: string, recommendationId: string | null): CopilotAuditEvent {
  return { id: `audit-${now.getTime()}-${plan.copilotConfig.auditLog.length + 1}`, at: now.toISOString(), action, recommendationId, fieldsShared, reason }
}

export function saveGeneratedBrief(plan: WealthPlan, brief: CopilotBrief, now = new Date()): WealthPlan {
  const retained = plan.copilotConfig.recommendations.filter((item) => item.status !== 'pending')
  return { ...plan, copilotConfig: { ...plan.copilotConfig, recommendations: [...retained, ...brief.recommendations], auditLog: [...plan.copilotConfig.auditLog, auditEvent(plan, 'briefGenerated', now, brief.context.fieldsShared, 'local-deterministic-brief', null)] } }
}

export function decideRecommendation(plan: WealthPlan, recommendationId: string, decision: 'approved' | 'dismissed', reason: string, now = new Date()): WealthPlan {
  const recommendation = plan.copilotConfig.recommendations.find((item) => item.id === recommendationId)
  if (!recommendation) return plan
  const recommendations = plan.copilotConfig.recommendations.map((item) => item.id === recommendationId ? { ...item, status: decision, dispositionReason: reason } : item)
  const existingAction = plan.wealthReviewConfig.actions.some((item) => item.sourceRecommendationId === recommendationId)
  const due = new Date(now); due.setDate(due.getDate() + 30)
  const actions = decision === 'approved' && !existingAction ? [...plan.wealthReviewConfig.actions, { id: `action-${recommendationId}`, title: recommendation.title, status: 'todo' as const, dueDate: due.toISOString().slice(0, 10), sourceRecommendationId: recommendationId }] : plan.wealthReviewConfig.actions
  const action = decision === 'approved' ? 'recommendationApproved' : 'recommendationDismissed'
  return {
    ...plan,
    copilotConfig: { ...plan.copilotConfig, recommendations, auditLog: [...plan.copilotConfig.auditLog, auditEvent(plan, action, now, [], reason, recommendationId)] },
    wealthReviewConfig: { ...plan.wealthReviewConfig, actions },
  }
}

export function recordBlockedInput(plan: WealthPlan, reason: string, now = new Date()): WealthPlan {
  return { ...plan, copilotConfig: { ...plan.copilotConfig, auditLog: [...plan.copilotConfig.auditLog, auditEvent(plan, 'blocked', now, [], reason, null)] } }
}

export function recordProviderRequest(plan: WealthPlan, provider: 'lmstudio' | 'openrouter', succeeded: boolean, fieldsShared: string[], now = new Date()): WealthPlan {
  const auditLog = [...plan.copilotConfig.auditLog, auditEvent(plan, 'providerRequested', now, fieldsShared, `${provider}:${succeeded ? 'success' : 'failed'}`, null)].slice(-500)
  return { ...plan, copilotConfig: { ...plan.copilotConfig, auditLog } }
}
