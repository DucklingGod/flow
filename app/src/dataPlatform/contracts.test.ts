import { describe, expect, it } from 'vitest'
import { DataObservationSchema, SecurityIdentitySchema } from './contracts'

const base = {
  id: 'obs-1', kind: 'price', identityId: null, field: 'close', numericValue: 1, textValue: null, unit: 'THB', currency: 'THB',
  observedAt: '2026-08-07T00:00:00.000Z', fetchedAt: '2026-08-07T01:00:00.000Z', providerId: 'test', sourceUrl: 'https://example.com', sourceAsOf: '2026-08-07',
  staleAfterHours: 24, licensingStatus: 'open', licenseNotes: '', confidence: 'verified', validationStatus: 'valid', checksum: 'checksum-001',
} as const

describe('data platform runtime contracts', () => {
  it('requires an observation value', () => {
    expect(DataObservationSchema.safeParse({ ...base, numericValue: null, textValue: null }).success).toBe(false)
    expect(DataObservationSchema.safeParse({ ...base, numericValue: null, textValue: 'facts' }).success).toBe(true)
  })

  it('rejects observations dated after retrieval and invalid source dates', () => {
    expect(DataObservationSchema.safeParse({ ...base, observedAt: '2026-08-08T00:00:00.000Z' }).success).toBe(false)
    expect(DataObservationSchema.safeParse({ ...base, sourceAsOf: 'not-a-date' }).success).toBe(false)
  })

  it('normalizes security currency and applies alias defaults', () => {
    const parsed = SecurityIdentitySchema.parse({ id: 'x', name: 'X', ticker: null, exchange: null, isin: null, thaiFundCode: null, shareClass: null, currency: 'thb', distributionMode: 'unknown', fxHedgedPercent: null, updatedAt: '2026-08-07T00:00:00.000Z' })
    expect(parsed.currency).toBe('THB')
    expect(parsed.aliases).toEqual([])
  })
})
