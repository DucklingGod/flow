import { describe, expect, it } from 'vitest'
import { defaultPlan } from './schema'
import { calculateLegacyReadiness } from './legacy'

describe('family and legacy readiness', () => {
  it('starts incomplete and produces concrete next actions', () => {
    const result = calculateLegacyReadiness(defaultPlan.legacyConfig, new Date('2026-08-07'))
    expect(result.score).toBe(0)
    expect(result.missingItems).toBe(6)
    expect(result.nextActions.length).toBeGreaterThan(1)
  })

  it('scores checklist, emergency contact, and current beneficiary review separately', () => {
    const config = {
      ...defaultPlan.legacyConfig,
      emergencyContactReady: true,
      beneficiaryReviewDate: '2026-01-01',
      items: defaultPlan.legacyConfig.items.map((item) => ({ ...item, status: 'complete' as const })),
    }
    const result = calculateLegacyReadiness(config, new Date('2026-08-07'))
    expect(result.score).toBe(100)
    expect(result.beneficiaryReviewStale).toBe(false)
  })

  it('marks reviews older than one year stale', () => {
    const result = calculateLegacyReadiness({ ...defaultPlan.legacyConfig, beneficiaryReviewDate: '2024-01-01' }, new Date('2026-08-07'))
    expect(result.beneficiaryReviewStale).toBe(true)
  })
})
