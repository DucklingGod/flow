// Provider-agnostic session shape.
//
// Nothing in here imports Clerk. The Clerk adapter in `FlowAuthProvider.tsx`
// converts Clerk's objects into a `FlowSession`, so swapping billing/identity
// providers touches one file and this module's tests keep their meaning.

import { normalizePlanTier, tierFromBillingPlanId, type PlanTier } from '../domain/entitlements'

export type SessionStatus =
  /** No identity provider is configured — a self-hosted or offline build. */
  | 'localOnly'
  /** The provider is configured and still resolving. */
  | 'loading'
  | 'signedOut'
  | 'signedIn'

export interface FlowSession {
  status: SessionStatus
  userId: string | null
  displayName: string | null
  email: string | null
  avatarUrl: string | null
  tier: PlanTier
  /** True when entitlement gating should be applied to the UI at all. */
  gatingActive: boolean
}

export interface RawSessionInput {
  configured: boolean
  loaded: boolean
  signedIn: boolean
  userId?: unknown
  displayName?: unknown
  email?: unknown
  avatarUrl?: unknown
  /** Whatever the billing provider reports — a plan id, a tier, or nothing. */
  planClaim?: unknown
}

function text(value: unknown, limit: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null
}

/**
 * When no identity provider is configured there is no way to buy anything, so
 * gating every paid surface would just make the build unusable rather than
 * protecting revenue. An unconfigured build therefore runs fully unlocked and
 * fully local — which is also exactly what the existing offline test suite and
 * the local-first promise require.
 */
export const LOCAL_ONLY_TIER: PlanTier = 'pro'

export function resolveSession(input: RawSessionInput): FlowSession {
  if (!input.configured) {
    return { status: 'localOnly', userId: null, displayName: null, email: null, avatarUrl: null, tier: LOCAL_ONLY_TIER, gatingActive: false }
  }
  if (!input.loaded) {
    return { status: 'loading', userId: null, displayName: null, email: null, avatarUrl: null, tier: 'free', gatingActive: true }
  }
  if (!input.signedIn) {
    return { status: 'signedOut', userId: null, displayName: null, email: null, avatarUrl: null, tier: 'free', gatingActive: true }
  }
  return {
    status: 'signedIn',
    userId: text(input.userId, 128),
    displayName: text(input.displayName, 80),
    email: text(input.email, 254),
    avatarUrl: text(input.avatarUrl, 2_048),
    tier: resolvePlanClaim(input.planClaim),
    gatingActive: true,
  }
}

/**
 * Billing providers report the active plan in inconsistent shapes: a bare
 * string, an array of active plan slugs, or an object keyed by slug. Resolve
 * all three, and take the *highest* tier present so a user mid-upgrade is never
 * downgraded by ordering. Anything unrecognised fails closed to `free`.
 */
export function resolvePlanClaim(claim: unknown): PlanTier {
  const candidates: string[] = []
  if (typeof claim === 'string') {
    candidates.push(claim)
  } else if (Array.isArray(claim)) {
    for (const item of claim.slice(0, 50)) {
      if (typeof item === 'string') candidates.push(item)
    }
  } else if (claim && typeof claim === 'object') {
    for (const [key, value] of Object.entries(claim as Record<string, unknown>).slice(0, 50)) {
      if (value === true) candidates.push(key)
    }
  }
  const order: PlanTier[] = ['free', 'plus', 'pro']
  let best: PlanTier = 'free'
  for (const candidate of candidates) {
    const resolved = tierFromBillingPlanId(candidate)
    const fallback = resolved === 'free' ? normalizePlanTier(candidate) : resolved
    if (order.indexOf(fallback) > order.indexOf(best)) best = fallback
  }
  return best
}

export const anonymousSession: FlowSession = Object.freeze(
  resolveSession({ configured: true, loaded: false, signedIn: false }),
)
