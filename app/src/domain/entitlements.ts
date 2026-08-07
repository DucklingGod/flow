// Freemium entitlement model.
//
// This module is deliberately pure and provider-agnostic: it maps a tier to a
// capability set and nothing else. Clerk (or any future billing provider) only
// supplies the tier string; it never decides what a tier may do.
//
// Client-side entitlement checks are a UX affordance, not a security boundary.
// A user can edit memory and unlock any panel here. Every capability that costs
// money to serve — cloud sync, provider retrieval, hosted AI — must be
// re-checked server-side before the work is performed. See docs/MONETIZATION.md.

export const planTiers = ['free', 'plus', 'pro'] as const
export type PlanTier = typeof planTiers[number]

export const entitlementKeys = [
  'studioView',
  'wealthMap',
  'lifeCanvas',
  'planVault',
  'localCopilot',
  'portfolioXray',
  'scenarioStudio',
  'retirementStudio',
  'reportExport',
  'cloudSync',
  'taxStudio',
  'protectionStudio',
  'legacyStudio',
  'dataStudio',
  'externalAiCopilot',
  'acceptanceSnapshot',
] as const
export type EntitlementKey = typeof entitlementKeys[number]

export interface PlanQuotas {
  /** Active life goals a plan may hold. */
  goals: number
  /** Retained Plan Vault snapshots. */
  snapshots: number
  /** Devices that may hold a synced copy. */
  devices: number
  /** Monte Carlo paths permitted per run. */
  simulationPaths: number
}

export interface PlanDefinition {
  tier: PlanTier
  /** Stable identifier shared with the billing provider. Never localise this. */
  billingPlanId: string
  name: string
  tagline: string
  /** Monthly price in THB satang-free whole baht. 0 means free forever. */
  monthlyThb: number
  /** Annual price in THB. Zero for the free tier. */
  annualThb: number
  entitlements: readonly EntitlementKey[]
  quotas: PlanQuotas
}

const freeEntitlements = ['studioView', 'wealthMap', 'lifeCanvas', 'planVault', 'localCopilot'] as const satisfies readonly EntitlementKey[]

const plusEntitlements = [
  ...freeEntitlements,
  'portfolioXray',
  'scenarioStudio',
  'retirementStudio',
  'legacyStudio',
  'reportExport',
  'cloudSync',
] as const satisfies readonly EntitlementKey[]

const proEntitlements = [
  ...plusEntitlements,
  'taxStudio',
  'protectionStudio',
  'dataStudio',
  'externalAiCopilot',
  'acceptanceSnapshot',
] as const satisfies readonly EntitlementKey[]

export const planCatalog: Readonly<Record<PlanTier, PlanDefinition>> = Object.freeze({
  free: {
    tier: 'free',
    billingPlanId: 'flow_free',
    name: 'Flow Free',
    tagline: 'วางแผนหลักได้ครบ บนเครื่องของคุณเอง',
    monthlyThb: 0,
    annualThb: 0,
    entitlements: freeEntitlements,
    quotas: { goals: 3, snapshots: 3, devices: 1, simulationPaths: 1_000 },
  },
  plus: {
    tier: 'plus',
    billingPlanId: 'flow_plus',
    name: 'Flow Plus',
    tagline: 'พอร์ต ความเสี่ยง เกษียณ และ sync ข้ามอุปกรณ์',
    monthlyThb: 149,
    annualThb: 1_490,
    entitlements: plusEntitlements,
    quotas: { goals: 25, snapshots: 50, devices: 3, simulationPaths: 10_000 },
  },
  pro: {
    tier: 'pro',
    billingPlanId: 'flow_pro',
    name: 'Flow Pro',
    tagline: 'ภาษี ความคุ้มครอง ข้อมูลผู้ให้บริการ และ AI Copilot',
    monthlyThb: 349,
    annualThb: 3_490,
    entitlements: proEntitlements,
    quotas: { goals: 200, snapshots: 200, devices: 10, simulationPaths: 50_000 },
  },
})

export const orderedPlans: readonly PlanDefinition[] = Object.freeze(planTiers.map((tier) => planCatalog[tier]))

/**
 * Narrow an untrusted tier string — a billing claim, a URL, a stored value —
 * to a known tier. Anything unrecognised degrades to `free`, never upward.
 */
export function normalizePlanTier(value: unknown): PlanTier {
  return typeof value === 'string' && (planTiers as readonly string[]).includes(value) ? value as PlanTier : 'free'
}

/**
 * Map a billing provider's plan identifier to a tier. Accepts both the raw
 * `billingPlanId` and the bare tier name so a provider that reports either
 * shape resolves identically. Unknown identifiers fail closed to `free`.
 */
export function tierFromBillingPlanId(value: unknown): PlanTier {
  if (typeof value !== 'string') return 'free'
  const normalized = value.trim().toLowerCase()
  const matched = orderedPlans.find((plan) => plan.billingPlanId === normalized)
  return matched ? matched.tier : normalizePlanTier(normalized)
}

export function planFor(tier: PlanTier): PlanDefinition {
  return planCatalog[tier]
}

export function hasEntitlement(tier: PlanTier, key: EntitlementKey): boolean {
  return (planCatalog[tier].entitlements as readonly EntitlementKey[]).includes(key)
}

export function quotaFor(tier: PlanTier, quota: keyof PlanQuotas): number {
  return planCatalog[tier].quotas[quota]
}

/**
 * True when the requested count is within the tier's allowance. Callers should
 * treat `false` as "show the upgrade path", not "throw".
 */
export function withinQuota(tier: PlanTier, quota: keyof PlanQuotas, requested: number): boolean {
  return Number.isFinite(requested) && requested <= quotaFor(tier, quota)
}

/** The cheapest tier granting `key`, or null when no tier does. */
export function requiredTierFor(key: EntitlementKey): PlanTier | null {
  return orderedPlans.find((plan) => (plan.entitlements as readonly EntitlementKey[]).includes(key))?.tier ?? null
}

/** Tiers strictly above `tier`, cheapest first — the upgrade options to offer. */
export function upgradeTargetsFrom(tier: PlanTier): readonly PlanTier[] {
  return planTiers.slice(planTiers.indexOf(tier) + 1)
}

/**
 * Annual saving expressed as whole percent, for the pricing table's
 * "save N%" badge. Returns 0 when a tier has no annual option.
 */
export function annualSavingPercent(tier: PlanTier): number {
  const { monthlyThb, annualThb } = planCatalog[tier]
  if (monthlyThb <= 0 || annualThb <= 0) return 0
  return Math.round((1 - annualThb / (monthlyThb * 12)) * 100)
}
