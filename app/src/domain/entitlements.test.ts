import { describe, expect, it } from 'vitest'
import {
  annualSavingPercent, entitlementKeys, hasEntitlement, orderedPlans, planCatalog, planTiers,
  normalizePlanTier, quotaFor, requiredTierFor, tierFromBillingPlanId, upgradeTargetsFrom, withinQuota,
} from './entitlements'

describe('plan catalog', () => {
  it('keeps every tier a strict superset of the tier below it', () => {
    for (let index = 1; index < orderedPlans.length; index += 1) {
      const lower = orderedPlans[index - 1]
      const higher = orderedPlans[index]
      for (const key of lower.entitlements) expect(higher.entitlements).toContain(key)
      expect(higher.entitlements.length).toBeGreaterThan(lower.entitlements.length)
    }
  })

  it('never lets a higher tier reduce a quota', () => {
    const quotas = ['goals', 'snapshots', 'devices', 'simulationPaths'] as const
    for (let index = 1; index < orderedPlans.length; index += 1) {
      for (const quota of quotas) {
        expect(orderedPlans[index].quotas[quota]).toBeGreaterThanOrEqual(orderedPlans[index - 1].quotas[quota])
      }
    }
  })

  it('prices annual below twelve months of the monthly rate for every paid tier', () => {
    for (const plan of orderedPlans.filter((item) => item.monthlyThb > 0)) {
      expect(plan.annualThb).toBeLessThan(plan.monthlyThb * 12)
      expect(annualSavingPercent(plan.tier)).toBeGreaterThan(0)
    }
    expect(annualSavingPercent('free')).toBe(0)
  })

  it('exposes a unique billing identifier per tier', () => {
    const ids = orderedPlans.map((plan) => plan.billingPlanId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('grants every declared entitlement key to at least one tier', () => {
    for (const key of entitlementKeys) expect(requiredTierFor(key)).not.toBeNull()
  })

  it('keeps the free tier local-only', () => {
    expect(hasEntitlement('free', 'cloudSync')).toBe(false)
    expect(hasEntitlement('free', 'externalAiCopilot')).toBe(false)
    expect(hasEntitlement('free', 'studioView')).toBe(true)
    expect(hasEntitlement('free', 'localCopilot')).toBe(true)
  })
})

describe('untrusted tier resolution', () => {
  it('fails closed to free for anything unrecognised', () => {
    for (const value of [undefined, null, '', 'admin', 'PRO ', 42, {}, [], 'enterprise', 'free;pro']) {
      expect(normalizePlanTier(value)).toBe('free')
    }
  })

  it('accepts exactly the known tiers', () => {
    for (const tier of planTiers) expect(normalizePlanTier(tier)).toBe(tier)
  })

  it('resolves billing plan identifiers and bare tier names alike', () => {
    expect(tierFromBillingPlanId('flow_pro')).toBe('pro')
    expect(tierFromBillingPlanId('FLOW_PLUS')).toBe('plus')
    expect(tierFromBillingPlanId('  flow_plus  ')).toBe('plus')
    expect(tierFromBillingPlanId('pro')).toBe('pro')
  })

  it('never escalates an unknown billing identifier', () => {
    for (const value of ['flow_enterprise', 'flow_pro_trial', null, 7, 'pro_pro']) {
      expect(tierFromBillingPlanId(value)).toBe('free')
    }
  })
})

describe('quotas', () => {
  it('treats the quota as an inclusive ceiling', () => {
    expect(withinQuota('free', 'goals', quotaFor('free', 'goals'))).toBe(true)
    expect(withinQuota('free', 'goals', quotaFor('free', 'goals') + 1)).toBe(false)
  })

  it('rejects non-finite requests rather than passing them through', () => {
    expect(withinQuota('pro', 'goals', Number.NaN)).toBe(false)
    expect(withinQuota('pro', 'goals', Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe('upgrade paths', () => {
  it('offers only tiers above the current one, cheapest first', () => {
    expect(upgradeTargetsFrom('free')).toEqual(['plus', 'pro'])
    expect(upgradeTargetsFrom('plus')).toEqual(['pro'])
    expect(upgradeTargetsFrom('pro')).toEqual([])
  })

  it('names the cheapest tier that unlocks a capability', () => {
    expect(requiredTierFor('studioView')).toBe('free')
    expect(requiredTierFor('scenarioStudio')).toBe('plus')
    expect(requiredTierFor('cloudSync')).toBe('plus')
    expect(requiredTierFor('taxStudio')).toBe('pro')
    expect(requiredTierFor('externalAiCopilot')).toBe('pro')
  })

  it('keeps catalog ordering aligned with price', () => {
    expect(orderedPlans.map((plan) => plan.tier)).toEqual([...planTiers])
    for (let index = 1; index < orderedPlans.length; index += 1) {
      expect(orderedPlans[index].monthlyThb).toBeGreaterThan(orderedPlans[index - 1].monthlyThb)
    }
  })

  it('freezes the catalog against mutation', () => {
    expect(Object.isFrozen(planCatalog)).toBe(true)
  })
})
