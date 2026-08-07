import { describe, expect, it } from 'vitest'
import { LOCAL_ONLY_TIER, resolvePlanClaim, resolveSession } from './session'

describe('session resolution', () => {
  it('runs unlocked and ungated when no identity provider is configured', () => {
    const session = resolveSession({ configured: false, loaded: false, signedIn: false })
    expect(session.status).toBe('localOnly')
    expect(session.tier).toBe(LOCAL_ONLY_TIER)
    expect(session.gatingActive).toBe(false)
    expect(session.userId).toBeNull()
  })

  it('gates while the provider is still resolving so paid surfaces never flash', () => {
    const session = resolveSession({ configured: true, loaded: false, signedIn: false })
    expect(session.status).toBe('loading')
    expect(session.tier).toBe('free')
    expect(session.gatingActive).toBe(true)
  })

  it('treats a signed-out visitor as free', () => {
    const session = resolveSession({ configured: true, loaded: true, signedIn: false })
    expect(session.status).toBe('signedOut')
    expect(session.tier).toBe('free')
  })

  it('carries identity fields through for a signed-in user', () => {
    const session = resolveSession({
      configured: true, loaded: true, signedIn: true,
      userId: 'user_123', displayName: 'ปกรณ์', email: 'a@b.co', avatarUrl: 'https://img/1.png', planClaim: 'flow_plus',
    })
    expect(session).toMatchObject({ status: 'signedIn', userId: 'user_123', displayName: 'ปกรณ์', email: 'a@b.co', tier: 'plus' })
  })

  it('drops blank and non-string identity fields rather than rendering them', () => {
    const session = resolveSession({ configured: true, loaded: true, signedIn: true, userId: 42, displayName: '   ', email: null })
    expect(session.userId).toBeNull()
    expect(session.displayName).toBeNull()
    expect(session.email).toBeNull()
  })

  it('bounds oversized identity strings', () => {
    const session = resolveSession({ configured: true, loaded: true, signedIn: true, displayName: 'n'.repeat(500) })
    expect(session.displayName).toHaveLength(80)
  })
})

describe('plan claim resolution', () => {
  it('reads a bare string claim', () => {
    expect(resolvePlanClaim('flow_pro')).toBe('pro')
    expect(resolvePlanClaim('plus')).toBe('plus')
  })

  it('reads an array of active plan slugs and takes the highest', () => {
    expect(resolvePlanClaim(['flow_free', 'flow_pro', 'flow_plus'])).toBe('pro')
    expect(resolvePlanClaim(['flow_free'])).toBe('free')
  })

  it('reads an object keyed by slug, honouring only true values', () => {
    expect(resolvePlanClaim({ flow_plus: true, flow_pro: false })).toBe('plus')
    expect(resolvePlanClaim({ flow_pro: true, flow_plus: true })).toBe('pro')
    expect(resolvePlanClaim({ flow_pro: false })).toBe('free')
  })

  it('fails closed to free for anything unrecognised', () => {
    for (const claim of [undefined, null, '', 'enterprise', 42, [], {}, [{ flow_pro: true }], { flow_pro: 'yes' }]) {
      expect(resolvePlanClaim(claim)).toBe('free')
    }
  })

  it('never lets an unknown slug alongside a known one escalate the tier', () => {
    expect(resolvePlanClaim(['flow_admin', 'flow_plus'])).toBe('plus')
    expect(resolvePlanClaim(['flow_admin', 'root'])).toBe('free')
  })
})
