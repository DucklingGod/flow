import { describe, expect, it } from 'vitest'
import type { SecurityIdentity } from './contracts'
import { normalizedSecurityKey, resolveSecurityIdentity } from './securityMaster'

const identity = (overrides: Partial<SecurityIdentity> = {}): SecurityIdentity => ({
  id: 'sec-1', name: 'Example Fund A', ticker: 'EX-A', exchange: 'SET', isin: 'TH0000000001', thaiFundCode: 'M0001_2560', shareClass: 'A',
  currency: 'THB', distributionMode: 'accumulating', fxHedgedPercent: 90, aliases: [], updatedAt: '2026-08-07T00:00:00.000Z', ...overrides,
})

describe('security master identity resolution', () => {
  it('matches ISIN before local symbols and normalizes identifiers', () => {
    const candidate = identity({ id: 'incoming', ticker: 'WRONG', isin: ' th0000000001 ' })
    const result = resolveSecurityIdentity(candidate, [identity()])
    expect(result.status).toBe('matched')
    expect(result.match?.id).toBe('sec-1')
    expect(normalizedSecurityKey(candidate)).toBe('isin:TH0000000001')
  })

  it('matches a Thai fund code only within the same share class', () => {
    const candidate = identity({ id: 'incoming', isin: null, ticker: null, exchange: null, thaiFundCode: 'm0001_2560' })
    expect(resolveSecurityIdentity(candidate, [identity({ isin: null })]).status).toBe('matched')
    expect(resolveSecurityIdentity({ ...candidate, shareClass: 'D' }, [identity({ isin: null })]).status).toBe('unmatched')
  })

  it('refuses to silently merge currency, distribution, or hedge conflicts', () => {
    const candidate = identity({ id: 'incoming', currency: 'USD', distributionMode: 'distributing', fxHedgedPercent: 0 })
    const result = resolveSecurityIdentity(candidate, [identity()])
    expect(result.status).toBe('conflict')
    expect(result.conflicts).toEqual(['currency', 'distributionMode', 'fxHedgedPercent'])
  })

  it('returns ambiguous when a supposedly unique identifier has duplicate master rows', () => {
    const result = resolveSecurityIdentity(identity({ id: 'incoming' }), [identity(), identity({ id: 'sec-2' })])
    expect(result.status).toBe('ambiguous')
    expect(result.conflicts).toEqual(['sec-1', 'sec-2'])
  })

  it('matches ticker/exchange and emits every normalized key fallback', () => {
    const tickerOnly = identity({ id: 'ticker', isin: null, thaiFundCode: null })
    expect(resolveSecurityIdentity(tickerOnly, [identity({ id: 'master', isin: null, thaiFundCode: null })]).status).toBe('matched')
    expect(normalizedSecurityKey(tickerOnly)).toBe('ticker:SET:EX-A:A')
    const thai = identity({ isin: null, ticker: null, exchange: null })
    expect(normalizedSecurityKey(thai)).toBe('thfund:M0001_2560:A')
    expect(normalizedSecurityKey(identity({ id: 'local', isin: null, thaiFundCode: null, ticker: null, exchange: null }))).toBe('local:local')
  })

  it('does not report conflicts when optional metadata is unknown or absent', () => {
    const candidate = identity({ id: 'incoming', distributionMode: 'unknown', fxHedgedPercent: null, shareClass: null })
    const match = identity({ shareClass: null })
    expect(resolveSecurityIdentity(candidate, [match]).status).toBe('matched')
  })

  it('reports an explicit share-class conflict on an ISIN match', () => {
    const result = resolveSecurityIdentity(identity({ id: 'incoming', shareClass: 'D' }), [identity()])
    expect(result.status).toBe('conflict')
    expect(result.conflicts).toContain('shareClass')
  })
})
