import type { WealthPlan } from './schema'

export type ReviewRitual = 'monthly' | 'quarterly' | 'annual'

const monthsSince = (date: string | null, now: Date) => {
  if (!date) return Infinity
  const previous = new Date(date)
  return (now.getFullYear() - previous.getFullYear()) * 12 + now.getMonth() - previous.getMonth()
}

export function reviewRitualStatus(plan: WealthPlan, now = new Date()) {
  const review = plan.wealthReviewConfig
  return {
    monthly: { due: monthsSince(review.monthlyLastCompletedAt, now) >= 1, lastCompletedAt: review.monthlyLastCompletedAt },
    quarterly: { due: monthsSince(review.quarterlyLastCompletedAt, now) >= 3, lastCompletedAt: review.quarterlyLastCompletedAt },
    annual: { due: monthsSince(review.annualLastCompletedAt, now) >= 12, lastCompletedAt: review.annualLastCompletedAt },
  }
}

export function completeReviewRitual(plan: WealthPlan, ritual: ReviewRitual, now = new Date()): WealthPlan {
  const field = ritual === 'monthly' ? 'monthlyLastCompletedAt' : ritual === 'quarterly' ? 'quarterlyLastCompletedAt' : 'annualLastCompletedAt'
  return { ...plan, wealthReviewConfig: { ...plan.wealthReviewConfig, [field]: now.toISOString() } }
}
