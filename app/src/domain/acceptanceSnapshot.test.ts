import { describe, expect, it } from 'vitest'
import { buildProductAcceptanceHtml, buildProductAcceptanceSnapshot } from './acceptanceSnapshot'
import { defaultPlan } from './schema'

const generatedAt = new Date('2026-08-07T00:00:00.000Z')

describe('product acceptance snapshot', () => {
  it('answers all four Final Gate questions with traceable deterministic evidence', () => {
    const snapshot = buildProductAcceptanceSnapshot(defaultPlan, generatedAt)
    expect(snapshot.questions.map((item) => item.id)).toEqual(['current', 'goals', 'risks', 'month'])
    expect(snapshot.questions.every((item) => item.answer.length > 0 && item.evidence.length > 0)).toBe(true)
    expect(snapshot.questions.find((item) => item.id === 'goals')?.evidence.map((item) => item.label)).toEqual(expect.arrayContaining(['Nominal / real', 'P10 / P50 / P90', 'Funding gap', 'ฝากประจำสุทธิ / ส่วนต่าง']))
    expect(snapshot.questions.flatMap((item) => item.evidence).every((item) => item.source && item.asOf && item.modelVersion === defaultPlan.calculationModel.version)).toBe(true)
    expect(snapshot.productOwnerDecision).toBe('pending')
    expect(snapshot.boundaries).toEqual(expect.arrayContaining(['human approval required', 'no real transaction']))
  })

  it('is reproducible for the same plan, date, seed, and simulation count', () => {
    const first = buildProductAcceptanceSnapshot(defaultPlan, generatedAt)
    const second = buildProductAcceptanceSnapshot(defaultPlan, generatedAt)
    expect(second).toEqual(first)
    expect(first.simulation).toEqual({ seed: defaultPlan.simulationConfig.seed, paths: Math.min(5_000, defaultPlan.simulationConfig.simulations) })
  })

  it('surfaces stale and licensing risks without creating or approving a transaction', () => {
    const plan = {
      ...defaultPlan,
      holdings: defaultPlan.holdings.map((item, index) => index === 0 ? { ...item, sourceAsOf: '2020-01-01', sourceLicensingStatus: 'unknown' as const } : item),
    }
    const snapshot = buildProductAcceptanceSnapshot(plan, generatedAt)
    expect(snapshot.risks.map((item) => item.title)).toEqual(expect.arrayContaining(['ข้อมูลพอร์ต stale หรือไม่ผ่าน validation', 'สิทธิ์ใช้ข้อมูลยังไม่ชัดเจน']))
    expect(snapshot.actions.some((item) => item.title.includes('provenance') && item.decision === 'pending-user')).toBe(true)
    expect(snapshot.actions.every((item) => !/ซื้อ|ขาย|โอน|execute/i.test(item.title))).toBe(true)
  })

  it('classifies urgent cash, concentrated, fee, FX, invalid-date, and restricted-data branches', () => {
    const plan = {
      ...defaultPlan,
      accounts: defaultPlan.accounts.map((item) => ({ ...item, balance: item.type === 'cash' ? 1_000 : item.balance })),
      cashFlows: defaultPlan.cashFlows.map((item) => ({ ...item, amount: item.type === 'income' ? 1_000 : 100_000 })),
      holdings: defaultPlan.holdings.map((item, index) => ({
        ...item,
        quantity: index === 0 ? item.quantity * 100 : 0,
        annualFee: 3,
        fxHedgedPercent: 0,
        sourceAsOf: index === 0 ? 'not-a-date' : item.sourceAsOf,
        sourceValidationStatus: index === 0 ? 'invalid' as const : item.sourceValidationStatus,
        sourceLicensingStatus: index === 0 ? 'restricted' as const : item.sourceLicensingStatus,
      })),
      protectionConfig: { ...defaultPlan.protectionConfig, enabled: true, expertReviewStatus: 'approved' as const },
      taxProfile: { ...defaultPlan.taxProfile, enabled: true, expertReviewStatus: 'approved' as const },
    }
    const snapshot = buildProductAcceptanceSnapshot(plan, generatedAt)
    expect(snapshot.questions.find((item) => item.id === 'current')?.tone).toBe('urgent')
    expect(snapshot.risks.map((item) => item.title)).toEqual(expect.arrayContaining(['เงินสำรองต่ำกว่าสมมติฐาน 6 เดือน', 'ข้อมูลพอร์ต stale หรือไม่ผ่าน validation', 'สิทธิ์ใช้ข้อมูลยังไม่ชัดเจน', 'พอร์ตกระจุกตัวสูง', 'ค่าธรรมเนียมพอร์ตสูง', 'ความเสี่ยงค่าเงินที่ไม่ hedge สูง']))
    expect(snapshot.risks.some((item) => item.title.includes('Protection') || item.title.includes('Tax'))).toBe(false)
    expect(snapshot.actions[0].title).toContain('กระแสเงินสด')
  })

  it('falls back to a reversible review action when no action rule is triggered', () => {
    const plan = {
      ...defaultPlan,
      targetAmount: 0,
      accounts: defaultPlan.accounts.map((item) => ({ ...item, balance: item.type === 'cash' ? 10_000_000 : item.balance })),
      cashFlows: defaultPlan.cashFlows.map((item) => ({ ...item, amount: item.type === 'income' ? 200_000 : 1_000 })),
      goals: defaultPlan.goals.map((item) => ({ ...item, status: 'completed' as const, fundedAmount: item.targetAmount })),
      holdings: [],
      investmentPolicy: { ...defaultPlan.investmentPolicy, targets: [] },
      retirementConfig: { ...defaultPlan.retirementConfig, fundingAccountIds: [], monthlyLivingExpenseToday: 0, monthlyHealthcareToday: 0, legacyTargetToday: 0 },
      protectionConfig: { ...defaultPlan.protectionConfig, enabled: true, expertReviewStatus: 'approved' as const },
      taxProfile: { ...defaultPlan.taxProfile, enabled: true, expertReviewStatus: 'approved' as const },
    }
    const snapshot = buildProductAcceptanceSnapshot(plan, generatedAt)
    expect(snapshot.actions).toHaveLength(1)
    expect(snapshot.actions[0]).toMatchObject({ title: expect.stringContaining('monthly review'), decision: 'pending-user' })
    expect(snapshot.questions.find((item) => item.id === 'goals')?.tone).toBe('good')
  })

  it('creates a print-safe pending-decision packet and escapes plan-derived text', () => {
    const plan = { ...defaultPlan, taxProfile: { ...defaultPlan.taxProfile, datasetVersion: '<script>unsafe()</script>' } }
    const html = buildProductAcceptanceHtml(buildProductAcceptanceSnapshot(plan, generatedAt))
    expect(html).toContain('Product-owner decision: pending')
    expect(html).toContain('G6/G7/G9 and Final Gate remain pending')
    expect(html).toContain('&lt;script&gt;unsafe()&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('Content-Security-Policy')
  })
})
