import { describe, expect, it } from 'vitest'
import { defaultPlan } from './schema'
import { diffPlanSections, planSectionIds, resolvePlanSections, validatePlanReferences } from './planConflict'

describe('plan conflict resolution', () => {
  it('detects changed sections without treating updatedAt as a conflict', () => {
    const incoming = { ...defaultPlan, updatedAt: '2030-01-01T00:00:00.000Z', expectedReturn: 4.5, goals: defaultPlan.goals.map((goal, index) => index ? goal : { ...goal, targetAmount: goal.targetAmount + 1 }) }
    const diffs = diffPlanSections(defaultPlan, incoming)
    expect(diffs).toHaveLength(planSectionIds.length)
    expect(diffs.filter((item) => item.changed).map((item) => item.id)).toEqual(['projection', 'life'])
    expect(diffs.find((item) => item.id === 'projection')?.incomingSummary).toContain('4.5%')
  })

  it('keeps current data by default and applies only explicitly selected incoming sections', () => {
    const incoming = { ...defaultPlan, name: 'ไฟล์สำรอง', expectedReturn: 3, accounts: defaultPlan.accounts.map((item) => ({ ...item, balance: item.balance + 100 })) }
    const result = resolvePlanSections(defaultPlan, incoming, { projection: 'incoming' }, new Date('2026-08-07T00:00:00.000Z'))
    expect(result.issues).toEqual([])
    expect(result.plan.expectedReturn).toBe(3)
    expect(result.plan.name).toBe(defaultPlan.name)
    expect(result.plan.accounts).toEqual(defaultPlan.accounts)
    expect(result.plan.updatedAt).toBe('2026-08-07T00:00:00.000Z')
  })

  it('blocks mixed sections that create orphaned goal and retirement references', () => {
    const incoming = { ...defaultPlan, accounts: defaultPlan.accounts.filter((item) => item.id !== 'cash-main' && item.id !== 'investment-main') }
    const result = resolvePlanSections(defaultPlan, incoming, { wealth: 'incoming' })
    expect(result.issues.some((issue) => issue.includes('เป้าหมาย'))).toBe(true)
    expect(result.issues.some((issue) => issue.includes('Retirement'))).toBe(true)
  })

  it('detects portfolio and legacy orphan references', () => {
    const candidate = {
      ...defaultPlan,
      portfolioAccounts: [],
      holdings: defaultPlan.holdings.slice(0, 1),
      transactions: [{ ...defaultPlan.transactions[0], holdingId: 'missing' }],
      legacyConfig: { ...defaultPlan.legacyConfig, items: [{ ...defaultPlan.legacyConfig.items[0], ownerMemberId: 'missing' }] },
    }
    const issues = validatePlanReferences(candidate)
    expect(issues.some((issue) => issue.includes('Holding'))).toBe(true)
    expect(issues.some((issue) => issue.includes('Transaction'))).toBe(true)
    expect(issues.some((issue) => issue.includes('Legacy'))).toBe(true)
  })
})
