import { describe, expect, it } from 'vitest'
import type { DataObservation } from './contracts'
import { classifyObservation, freshnessLabel, selectLastKnownGood } from './freshness'

const observation = (overrides: Partial<DataObservation> = {}): DataObservation => ({
  id: 'obs-1', kind: 'nav', identityId: 'fund-1', field: 'nav', numericValue: 12.34, textValue: null, unit: 'THB/unit', currency: 'THB',
  observedAt: '2026-08-07T00:00:00.000Z', fetchedAt: '2026-08-07T01:00:00.000Z', providerId: 'sec-th', sourceUrl: 'https://api-portal.sec.or.th/',
  sourceAsOf: '2026-08-07', staleAfterHours: 48, licensingStatus: 'open', licenseNotes: 'SEC Open Data', confidence: 'official', validationStatus: 'valid', checksum: 'checksum-001', ...overrides,
})

describe('observation freshness and fallback', () => {
  it('cannot call an observation current without valid provenance', () => {
    const invalid = { ...observation(), sourceUrl: '' }
    expect(classifyObservation(invalid, new Date('2026-08-07T03:00:00.000Z')).status).toBe('invalid')
  })

  it('classifies current and stale against the declared window', () => {
    expect(classifyObservation(observation(), new Date('2026-08-08T00:00:00.000Z')).status).toBe('current')
    const stale = classifyObservation(observation(), new Date('2026-08-10T00:00:00.000Z'))
    expect(stale.status).toBe('stale')
    expect(freshnessLabel(stale, '2026-08-07')).toContain('ข้อมูลเก่า')
  })

  it('freezes the last-known-good value when the newest row is quarantined', () => {
    const quarantined = observation({ id: 'obs-2', observedAt: '2026-08-08T00:00:00.000Z', fetchedAt: '2026-08-08T01:00:00.000Z', sourceAsOf: '2026-08-08', validationStatus: 'quarantined' })
    const selected = selectLastKnownGood([observation(), quarantined], new Date('2026-08-08T02:00:00.000Z'))
    expect(selected.observation?.id).toBe('obs-1')
    expect(selected.usedLastKnownGood).toBe(true)
    expect(selected.freshness.status).toBe('current')
  })

  it('does not expose restricted data or manufacture a missing estimate', () => {
    const restricted = observation({ licensingStatus: 'restricted' })
    expect(selectLastKnownGood([restricted]).freshness.status).toBe('licenseBlocked')
    expect(selectLastKnownGood([]).observation).toBeNull()
    expect(selectLastKnownGood([]).freshness.status).toBe('missing')
  })

  it('covers invalid validation, unknown licensing, null input, and future timestamps', () => {
    expect(classifyObservation(null).status).toBe('missing')
    expect(classifyObservation(undefined).status).toBe('missing')
    expect(classifyObservation(observation({ validationStatus: 'invalid' })).reason).toBe('invalid')
    expect(classifyObservation(observation({ licensingStatus: 'unknown' })).status).toBe('licenseBlocked')
    expect(classifyObservation(observation(), new Date('2026-08-06T00:00:00.000Z')).ageHours).toBe(0)
  })

  it('labels all non-current states without implying a date', () => {
    expect(freshnessLabel({ status: 'licenseBlocked', ageHours: null, reason: '' })).toBeTruthy()
    expect(freshnessLabel({ status: 'invalid', ageHours: null, reason: '' })).toBeTruthy()
    expect(freshnessLabel({ status: 'missing', ageHours: null, reason: '' })).toBeTruthy()
    expect(freshnessLabel({ status: 'current', ageHours: 1, reason: '' })).not.toContain('undefined')
  })

  it('reports invalid when parsed observations exist but none are usable', () => {
    const result = selectLastKnownGood([observation({ validationStatus: 'quarantined' }), { broken: true }])
    expect(result.observation).toBeNull()
    expect(result.freshness).toMatchObject({ status: 'invalid', reason: 'no-usable-observation' })
  })
})
