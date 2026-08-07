import { describe, expect, it } from 'vitest'
import { defaultPlan, type LifeGoal, type WealthPlan } from './schema'
import { allocateGoalFunding, monthsUntil } from './goals'

const from = new Date('2026-08-01T00:00:00.000Z')
const goal = (patch: Partial<LifeGoal>): LifeGoal => ({
  id: crypto.randomUUID(), name: 'เป้าหมาย', type: 'custom', status: 'active', priority: 3,
  targetDate: '2027-08', targetAmount: 120_000, fundedAmount: 0, inflationRate: 0,
  minimumMonthly: 0, fundingAccountId: 'cash-main', memberId: 'member-self', ...patch,
})
const plan = (goals: LifeGoal[], patch: Partial<WealthPlan> = {}): WealthPlan => ({ ...defaultPlan, monthlyGoalBudget: 10_000, debtExtraPayment: 0, debts: [], goals, ...patch })

describe('multi-goal funding allocator', () => {
  it('orders overlapping goals by priority without double-counting budget', () => {
    const low = goal({ id: 'low', priority: 2 })
    const high = goal({ id: 'high', priority: 5 })
    const result = allocateGoalFunding(plan([low, high]), from)
    expect(result.goalAllocation + result.debtAllocation + result.unallocated).toBeCloseTo(result.availableBudget)
    expect(result.allocations.find((item) => item.goal.id === 'high')!.allocatedMonthly).toBe(10_000)
    expect(result.allocations.find((item) => item.goal.id === 'low')!.allocatedMonthly).toBe(0)
    expect(result.collisions).toBe(1)
  })

  it('limits allocation when cash flow is insufficient and includes debt in the same budget', () => {
    const result = allocateGoalFunding(plan([goal({})], { monthlyGoalBudget: 50_000, debtExtraPayment: 3_000, debts: defaultPlan.debts, cashFlows: [{ id: 'income', name: 'รายได้', type: 'income', amount: 5_000, frequency: 'monthly', category: 'งาน' }, { id: 'expense', name: 'รายจ่าย', type: 'expense', amount: 4_000, frequency: 'monthly', category: 'บ้าน' }] }), from)
    expect(result.availableBudget).toBe(1_000)
    expect(result.debtAllocation).toBe(1_000)
    expect(result.goalAllocation).toBe(0)
    expect(result.cashFlowLimited).toBe(true)
  })

  it('handles paused, completed, cancelled, and fully funded goals', () => {
    const result = allocateGoalFunding(plan([
      goal({ id: 'paused', status: 'paused' }), goal({ id: 'done', status: 'completed' }),
      goal({ id: 'cancelled', status: 'cancelled' }), goal({ id: 'funded', fundedAmount: 120_000 }),
    ]), from)
    expect(result.allocations.every((item) => item.allocatedMonthly === 0)).toBe(true)
    expect(result.allocations.find((item) => item.goal.id === 'done')!.successProbability).toBe(100)
    expect(result.allocations.find((item) => item.goal.id === 'cancelled')!.successProbability).toBe(0)
  })

  it('blocks orphaned member and funding-account references', () => {
    const result = allocateGoalFunding(plan([goal({ id: 'member', memberId: 'missing' }), goal({ id: 'account', fundingAccountId: 'missing' })]), from)
    expect(result.allocations[0].reason).toContain('สมาชิก')
    expect(result.allocations[1].reason).toContain('บัญชี')
  })

  it('handles paused contribution, negative cash flow, and passed target dates', () => {
    expect(allocateGoalFunding(plan([goal({})], { monthlyGoalBudget: 0 }), from).allocations[0].reason).toContain('พัก')
    const noCash = allocateGoalFunding(plan([goal({})], { cashFlows: [{ id: 'expense', name: 'รายจ่าย', type: 'expense', amount: 5_000, frequency: 'monthly', category: 'บ้าน' }] }), from)
    expect(noCash.allocations[0].reason).toContain('กระแสเงินสด')
    expect(monthsUntil('2025-01', from)).toBe(0)
  })
})
