import { calculateProjection } from './finance/projection'
import { allocateGoalFunding } from './goals'
import { analyzePortfolio, buildRebalancePreview } from './portfolio'
import { calculateRetirement } from './retirement'
import { planToMonteCarloInput, runMonteCarlo } from './scenario'
import type { WealthPlan } from './schema'
import { reconcileWealth } from './wealth'

export interface AcceptanceEvidence {
  label: string
  value: string
  source: string
  asOf: string
  modelVersion: string
}

export interface AcceptanceRisk {
  severity: 'urgent' | 'watch' | 'disclosure'
  title: string
  detail: string
  evidence: string
}

export interface AcceptanceAction {
  priority: number
  title: string
  rationale: string
  evidence: string
  reversibility: string
  decision: 'pending-user'
}

export interface AcceptanceQuestion {
  id: 'current' | 'goals' | 'risks' | 'month'
  question: string
  answer: string
  tone: 'good' | 'watch' | 'urgent'
  evidence: AcceptanceEvidence[]
}

export interface ProductAcceptanceSnapshot {
  generatedAt: string
  planId: string
  planVersion: number
  planUpdatedAt: string
  modelVersion: string
  simulation: { seed: number; paths: number }
  questions: AcceptanceQuestion[]
  risks: AcceptanceRisk[]
  actions: AcceptanceAction[]
  assumptions: string[]
  knownLimitations: string[]
  rollbackPath: string
  productOwnerDecision: 'pending'
  boundaries: string[]
}

const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })
const percent = (value: number) => `${value.toFixed(1)}%`
const dateOnly = (value: string) => value.slice(0, 10)

function evidence(label: string, value: string, source: string, asOf: string, modelVersion: string): AcceptanceEvidence {
  return { label, value, source, asOf, modelVersion }
}

function sourceAgeHours(value: string, now: Date) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? Math.max(0, (now.getTime() - parsed) / 3_600_000) : Infinity
}

export function buildProductAcceptanceSnapshot(plan: WealthPlan, generatedAt = new Date()): ProductAcceptanceSnapshot {
  const asOf = dateOnly(plan.updatedAt)
  const modelVersion = plan.calculationModel.version
  const wealth = reconcileWealth(plan)
  const projection = calculateProjection(plan)
  const portfolio = analyzePortfolio(plan)
  const goals = allocateGoalFunding(plan, generatedAt)
  const retirement = calculateRetirement(plan)
  const simulationPaths = Math.min(5_000, plan.simulationConfig.simulations)
  const monteCarlo = runMonteCarlo({ ...planToMonteCarloInput(plan), config: { ...plan.simulationConfig, simulations: simulationPaths } })
  const rebalance = buildRebalancePreview(plan)
  const staleHoldings = plan.holdings.filter((item) => sourceAgeHours(item.sourceAsOf, generatedAt) > item.sourceStaleAfterHours || item.sourceValidationStatus !== 'valid')
  const licensingIssues = plan.holdings.filter((item) => item.sourceLicensingStatus === 'unknown' || item.sourceLicensingStatus === 'restricted')
  const activeGoals = goals.allocations.filter((item) => item.goal.status === 'active')
  const outsideBand = rebalance.filter((item) => item.outsideBand)

  const risks: AcceptanceRisk[] = []
  if (wealth.emergencyMonths < 6) risks.push({ severity: wealth.emergencyMonths < 3 ? 'urgent' : 'watch', title: 'เงินสำรองต่ำกว่าสมมติฐาน 6 เดือน', detail: `รองรับค่าใช้จ่ายประมาณ ${wealth.emergencyMonths.toFixed(1)} เดือน`, evidence: 'Wealth Map · cash / monthly expense' })
  if (goals.collisions > 0) risks.push({ severity: 'watch', title: 'เป้าหมายชนงบ', detail: `${goals.collisions} เป้าหมายได้รับงบน้อยกว่าจำนวนที่ต้องใช้`, evidence: 'Life Canvas allocator' })
  if (staleHoldings.length > 0) risks.push({ severity: 'urgent', title: 'ข้อมูลพอร์ต stale หรือไม่ผ่าน validation', detail: `${staleHoldings.length} holding ต้องยืนยันก่อนใช้ตัดสินใจ`, evidence: 'Portfolio X-Ray provenance' })
  if (licensingIssues.length > 0) risks.push({ severity: 'urgent', title: 'สิทธิ์ใช้ข้อมูลยังไม่ชัดเจน', detail: `${licensingIssues.length} holding มีสถานะ restricted/unknown`, evidence: 'Data licensing status' })
  if (portfolio.concentrationHhi > 2_500) risks.push({ severity: 'watch', title: 'พอร์ตกระจุกตัวสูง', detail: `HHI ${portfolio.concentrationHhi.toFixed(0)}`, evidence: 'Portfolio X-Ray holdings weights' })
  if (portfolio.feeRate > 1.5) risks.push({ severity: 'watch', title: 'ค่าธรรมเนียมพอร์ตสูง', detail: `${percent(portfolio.feeRate)} หรือ ${money.format(portfolio.annualFeeBaht)}/ปี`, evidence: 'Holding fee disclosures' })
  if (portfolio.unhedgedFxWeight > 50) risks.push({ severity: 'watch', title: 'ความเสี่ยงค่าเงินที่ไม่ hedge สูง', detail: `${percent(portfolio.unhedgedFxWeight)} ของพอร์ต`, evidence: 'Holding currency exposure' })
  if (monteCarlo.sequenceRiskCost > 0) risks.push({ severity: 'watch', title: 'Sequence risk', detail: `ผลกระทบจำลองประมาณ ${money.format(monteCarlo.sequenceRiskCost)}`, evidence: `Scenario Studio · seed ${monteCarlo.seed}` })
  if (retirement.fundingGapAtRetirement > 0) risks.push({ severity: 'watch', title: 'ช่องว่างเกษียณ', detail: money.format(retirement.fundingGapAtRetirement), evidence: 'Retirement Studio cash-flow model' })
  if (!plan.protectionConfig.enabled || plan.protectionConfig.expertReviewStatus !== 'approved') risks.push({ severity: 'disclosure', title: 'Protection ยังไม่ผ่าน expert review', detail: plan.protectionConfig.enabled ? `สถานะ ${plan.protectionConfig.expertReviewStatus}` : 'estimate ยังปิดอยู่', evidence: 'Gate G6 specialist lock' })
  if (!plan.taxProfile.enabled || plan.taxProfile.expertReviewStatus !== 'approved') risks.push({ severity: 'disclosure', title: 'Tax ยังไม่ผ่าน expert review', detail: plan.taxProfile.enabled ? `ปี ${plan.taxProfile.taxYear} · ${plan.taxProfile.expertReviewStatus}` : 'estimate ยังปิดอยู่', evidence: `Tax dataset ${plan.taxProfile.datasetVersion}` })
  risks.push({ severity: 'disclosure', title: 'ผลลัพธ์เป็นแบบจำลอง', detail: 'ผลตอบแทน เงินเฟ้อ ความผันผวน อายุขัย และข้อมูลตลาดจริงอาจต่างจากสมมติฐาน', evidence: modelVersion })

  const actions: AcceptanceAction[] = []
  const addAction = (title: string, rationale: string, actionEvidence: string, reversibility: string) => actions.push({ priority: actions.length + 1, title, rationale, evidence: actionEvidence, reversibility, decision: 'pending-user' })
  if (wealth.monthlySurplus <= 0) addAction('ทบทวนกระแสเงินสดก่อนจัดสรรเพิ่ม', `เงินเหลือรายเดือน ${money.format(wealth.monthlySurplus)}`, 'Wealth Map reconciliation', 'แก้รายการหรือวงเงินกลับได้ ไม่มีการโอนเงิน')
  else if (wealth.emergencyMonths < 6) addAction('กำหนดแผนปิดช่องว่างเงินสำรอง', `เงินสำรองปัจจุบัน ${wealth.emergencyMonths.toFixed(1)} เดือน เทียบสมมติฐาน 6 เดือน`, 'Cash / monthly expense', 'เปลี่ยนจำนวนและกำหนดเวลาได้ ไม่มีการหักบัญชี')
  if (goals.collisions > 0) addAction('ทบทวน priority และวันเป้าหมายที่ชนงบ', `${goals.collisions} เป้าหมายมี allocated monthly ต่ำกว่า required monthly`, 'Life Canvas allocator', 'ปรับ priority/วัน/งบกลับได้')
  if (staleHoldings.length || licensingIssues.length) addAction('ยืนยัน provenance พอร์ตก่อนพิจารณาปรับสัดส่วน', `stale/invalid ${staleHoldings.length} · licensing issue ${licensingIssues.length}`, 'Portfolio X-Ray + Data Studio', 'นำเข้า snapshot ใหม่หรือคง last-known-good ได้ ไม่มีคำสั่งซื้อขาย')
  if (retirement.fundingGapAtRetirement > 0) addAction('เปรียบเทียบทางเลือกปิดช่องว่างเกษียณ', `ช่องว่างจำลอง ${money.format(retirement.fundingGapAtRetirement)}`, 'Retirement Studio', 'เปรียบเทียบเงินออม อายุเกษียณ และค่าใช้จ่ายโดยไม่แก้ค่าอัตโนมัติ')
  if (!plan.protectionConfig.enabled || plan.protectionConfig.expertReviewStatus !== 'approved') addAction('เตรียมข้อมูล Protection สำหรับผู้เชี่ยวชาญ', 'ยังไม่อนุญาตให้ใช้ estimate เป็นคำแนะนำ', 'Gate G6 specialist lock', 'เปิด/ปิด estimate และแก้ข้อมูลได้; ไม่มีการซื้อประกัน')
  if (!plan.taxProfile.enabled || plan.taxProfile.expertReviewStatus !== 'approved') addAction('ตรวจปีภาษีและ dataset ก่อนใช้ estimate', `dataset ${plan.taxProfile.datasetVersion} · expert ${plan.taxProfile.expertReviewStatus}`, 'Tax Studio provenance', 'ไม่ยื่นภาษีและไม่บันทึกภายนอก')
  if (outsideBand.length > 0) addAction('ตรวจ investment policy และสัดส่วนที่นอก band', `${outsideBand.length} asset class อยู่นอก rebalance band`, 'Portfolio policy preview', 'เป็น review เท่านั้น ต้อง approve/dismiss เองและไม่มี execution endpoint')
  if (actions.length === 0) addAction('ปิด monthly review และนัดทบทวนรอบถัดไป', 'ไม่พบช่องว่างเร่งด่วนจากกฎ deterministic ปัจจุบัน', 'Wealth Review ritual', 'เปิด review ใหม่หรือแก้กำหนดเวลาได้ทุกเมื่อ')

  const currentTone = wealth.netWorth < 0 || wealth.monthlySurplus < 0 ? 'urgent' : wealth.emergencyMonths < 6 ? 'watch' : 'good'
  const goalTone = monteCarlo.probabilityOfSuccess >= 75 && projection.fundingGap <= 0 ? 'good' : monteCarlo.probabilityOfSuccess >= 50 ? 'watch' : 'urgent'
  const riskTone = risks.some((item) => item.severity === 'urgent') ? 'urgent' : risks.some((item) => item.severity === 'watch') ? 'watch' : 'good'
  const questions: AcceptanceQuestion[] = [
    {
      id: 'current', question: 'ตอนนี้อยู่ตรงไหน', tone: currentTone,
      answer: `มูลค่าสุทธิ ${money.format(wealth.netWorth)} เงินเหลือ ${money.format(wealth.monthlySurplus)}/เดือน หนี้ ${money.format(wealth.debt)} และเงินสำรอง ${wealth.emergencyMonths.toFixed(1)} เดือน`,
      evidence: [
        evidence('มูลค่าสุทธิ', money.format(wealth.netWorth), 'Wealth Map reconciliation', asOf, modelVersion),
        evidence('มูลค่าพอร์ต', money.format(portfolio.totalValue), 'Portfolio X-Ray holdings', asOf, modelVersion),
        evidence('เป้าหมาย active', `${activeGoals.length} เป้าหมาย`, 'Life Canvas allocator', asOf, modelVersion),
        evidence('เกษียณ', `gap ${money.format(retirement.fundingGapAtRetirement)}`, 'Retirement Studio cash-flow', asOf, modelVersion),
        evidence('Protection / Tax', `${plan.protectionConfig.expertReviewStatus} / ${plan.taxProfile.expertReviewStatus}`, 'G6 specialist status', asOf, modelVersion),
      ],
    },
    {
      id: 'goals', question: 'จะถึงเป้าหมายหรือไม่', tone: goalTone,
      answer: `Base projection ${money.format(projection.futureValue)} เทียบเป้า ${money.format(plan.targetAmount)}; Monte Carlo สำเร็จ ${percent(monteCarlo.probabilityOfSuccess)} และเงินฝากประจำสุทธิ ${money.format(projection.depositNetFutureValue)}`,
      evidence: [
        evidence('Nominal / real', `${money.format(projection.futureValue)} / ${money.format(projection.realValue)}`, 'Goal Projection', asOf, modelVersion),
        evidence('P10 / P50 / P90', `${money.format(monteCarlo.p10)} / ${money.format(monteCarlo.p50)} / ${money.format(monteCarlo.p90)}`, `Scenario Studio · ${simulationPaths} paths · seed ${monteCarlo.seed}`, asOf, modelVersion),
        evidence('วันที่คาดว่าจะถึง', projection.targetDateLabel, 'Reverse Goal calculator', asOf, modelVersion),
        evidence('Funding gap', money.format(projection.fundingGap), 'Goal Projection', asOf, modelVersion),
        evidence('ฝากประจำสุทธิ / ส่วนต่าง', `${money.format(projection.depositNetFutureValue)} / ${money.format(projection.depositDifference)}`, `Deposit ${plan.depositRate}% · tax ${plan.depositInterestTaxRate}%`, asOf, modelVersion),
      ],
    },
    {
      id: 'risks', question: 'ความเสี่ยงคืออะไร', tone: riskTone,
      answer: `${risks.filter((item) => item.severity === 'urgent').length} urgent · ${risks.filter((item) => item.severity === 'watch').length} watch · ${risks.filter((item) => item.severity === 'disclosure').length} disclosures`,
      evidence: risks.slice(0, 8).map((item) => evidence(item.title, item.detail, item.evidence, asOf, modelVersion)),
    },
    {
      id: 'month', question: 'เดือนนี้ควรทำอะไรต่อ', tone: actions.length > 3 ? 'watch' : 'good',
      answer: actions[0].title,
      evidence: actions.slice(0, 5).map((item) => evidence(`#${item.priority} ${item.title}`, item.rationale, item.evidence, asOf, modelVersion)),
    },
  ]

  return {
    generatedAt: generatedAt.toISOString(), planId: plan.id, planVersion: plan.version, planUpdatedAt: plan.updatedAt, modelVersion,
    simulation: { seed: monteCarlo.seed, paths: simulationPaths }, questions, risks, actions,
    assumptions: [
      `ผลตอบแทนคาดหวัง ${plan.expectedReturn}% ค่าธรรมเนียม ${plan.annualFee}% เงินเฟ้อ ${plan.inflation}%`,
      `ฝากประจำ ${plan.depositRate}% และภาษีดอกเบี้ย ${plan.depositInterestTaxRate}%`,
      `Monte Carlo ใช้ seed ${monteCarlo.seed} จำนวน ${simulationPaths.toLocaleString('en-US')} paths และ stress ${plan.simulationConfig.stressPreset}`,
      'Goal readiness เป็นอัตราส่วน deterministic; probability มาจาก Scenario Studio และไม่ใช่การรับประกัน',
    ],
    knownLimitations: [
      'G6 Tax/Protection expert review, G7 provider reconciliation/licensing และ G9 hosted security/manual acceptance ยัง pending',
      'ข้อมูลราคา FX ปันผล factsheet และดอกเบี้ยไม่ใช่ latest จนกว่า G7 จะผ่าน; ใช้ provenance ที่แสดงเท่านั้น',
      'แบบจำลองไม่ครอบคลุมเหตุการณ์ชีวิต ตลาด ภาษี กฎหมาย และค่าใช้จ่ายทุกกรณี',
      'บัญชี cloud, sync, collaboration, sharing และ external analytics ยังปิดอยู่',
      'ไม่มีการซื้อขาย โอนเงิน หักบัญชี ซื้อประกัน หรือยื่นภาษีจาก snapshot นี้',
    ],
    rollbackPath: 'ใช้ Plan Vault restore point หรือ encrypted local backup; การเปิด snapshot ไม่แก้ plan',
    productOwnerDecision: 'pending',
    boundaries: ['read-only deterministic calculation', 'human approval required', 'no real transaction', 'no external data transfer'],
  }
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}

export function buildProductAcceptanceHtml(snapshot: ProductAcceptanceSnapshot) {
  const questions = snapshot.questions.map((item) => `<section><p class="eyebrow">${escapeHtml(item.question)}</p><h2>${escapeHtml(item.answer)}</h2><table><tbody>${item.evidence.map((row) => `<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td><td>${escapeHtml(row.source)}</td><td>${escapeHtml(row.asOf)}</td></tr>`).join('')}</tbody></table></section>`).join('')
  const actions = snapshot.actions.map((item) => `<li><b>#${item.priority} ${escapeHtml(item.title)}</b><span>${escapeHtml(item.rationale)} · ${escapeHtml(item.evidence)}</span><small>${escapeHtml(item.reversibility)} · decision: pending user</small></li>`).join('')
  const limitations = snapshot.knownLimitations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Flow Product Acceptance Snapshot</title><style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#173a2f;font:12px/1.5 Arial,sans-serif}header{padding:22px;border-radius:18px;background:#eff7dd}h1{margin:5px 0;font-size:26px}h2{margin:4px 0 10px;font-size:16px}.eyebrow{margin:0;color:#64756c;font-size:10px;font-weight:700;letter-spacing:.12em}section{margin-top:18px;page-break-inside:avoid}table{width:100%;border-collapse:collapse}th,td{padding:6px;border-bottom:1px solid #dfe5dd;text-align:left;vertical-align:top}th{width:20%}ol,ul{padding-left:20px}li{margin:8px 0}li span,li small{display:block;color:#5e7067}.approval{margin-top:22px;padding:14px;border:1px solid #d5ddd1;border-radius:12px}.line{height:28px;border-bottom:1px solid #718079}footer{margin-top:18px;color:#687970;font-size:10px}</style></head><body><header><p class="eyebrow">FINAL GATE · PRODUCT-OWNER REVIEW PACKET</p><h1>Four-question acceptance snapshot</h1><p>Generated ${escapeHtml(snapshot.generatedAt)} · plan schema v${snapshot.planVersion} · model ${escapeHtml(snapshot.modelVersion)} · decision pending</p></header>${questions}<section><p class="eyebrow">MONTHLY ACTIONS · HUMAN DECISION REQUIRED</p><ol>${actions}</ol></section><section><p class="eyebrow">ASSUMPTIONS</p><ul>${snapshot.assumptions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section><section><p class="eyebrow">KNOWN LIMITATIONS</p><ul>${limitations}</ul></section><div class="approval"><b>Product-owner decision: pending</b><p>Decision / conditions</p><div class="line"></div><p>Name · date · evidence reference</p><div class="line"></div></div><footer>${escapeHtml(snapshot.rollbackPath)} · Read-only, human approval required, no real transaction. G6/G7/G9 and Final Gate remain pending until signed by the named reviewers.</footer></body></html>`
}
