import { describe, expect, it } from 'vitest'
import { defaultPlan } from './schema'
import { completeReviewRitual, reviewRitualStatus } from './reviews'

describe('wealth review rituals', () => {
  it('starts all rituals due when no completion exists', () => {
    const status = reviewRitualStatus(defaultPlan, new Date('2026-08-07T00:00:00.000Z'))
    expect(status.monthly.due).toBe(true)
    expect(status.quarterly.due).toBe(true)
    expect(status.annual.due).toBe(true)
  })

  it('tracks monthly, quarterly, and annual completion independently', () => {
    const now = new Date('2026-08-07T00:00:00.000Z')
    let plan = completeReviewRitual(defaultPlan, 'monthly', now)
    plan = completeReviewRitual(plan, 'quarterly', now)
    plan = completeReviewRitual(plan, 'annual', now)
    const current = reviewRitualStatus(plan, now)
    expect(Object.values(current).every((item) => !item.due)).toBe(true)
    const later = reviewRitualStatus(plan, new Date('2027-08-07T00:00:00.000Z'))
    expect(Object.values(later).every((item) => item.due)).toBe(true)
  })
})
