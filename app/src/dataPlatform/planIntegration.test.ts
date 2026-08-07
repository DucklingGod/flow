import { describe, expect, it } from 'vitest'
import { defaultPlan } from '../domain/schema'
import type { DataObservation } from './contracts'
import { applyObservationToPlan, observationTargetField } from './planIntegration'

const observation = (overrides: Partial<DataObservation> = {}): DataObservation => ({
  id: 'price-1', kind: 'price', identityId: 'sec-1', field: 'close', numericValue: 123.45, textValue: null, unit: 'USD/share', currency: 'USD',
  observedAt: '2026-08-07T00:00:00.000Z', fetchedAt: '2026-08-07T01:00:00.000Z', providerId: 'manual-verified', sourceUrl: 'https://example.com/price',
  sourceAsOf: '2026-08-07', staleAfterHours: 48, licensingStatus: 'userAuthorized', licenseNotes: 'user supplied', confidence: 'verified', validationStatus: 'valid', checksum: 'checksum-price-1', ...overrides,
})

describe('human-approved market data plan integration', () => {
  it('applies a current, currency-compatible snapshot with full provenance and resets approval', () => {
    const plan = { ...defaultPlan, investmentPolicy: { ...defaultPlan.investmentPolicy, approvalStatus: 'approved' as const, approvedAt: '2026-08-06T00:00:00.000Z' } }
    const result = applyObservationToPlan(plan, observation(), 'holding-vt', new Date('2026-08-08T00:00:00.000Z'))
    expect(result.status).toBe('applied')
    if (result.status === 'applied') {
      const holding = result.plan.holdings.find((item) => item.id === 'holding-vt')!
      expect(holding.currentPrice).toBe(123.45)
      expect(holding.sourceProvider).toBe('manual-verified')
      expect(holding.sourceUrl).toBe('https://example.com/price')
      expect(result.plan.investmentPolicy.approvalStatus).toBe('draft')
    }
  })

  it('rejects stale data and currency mismatches without mutating the plan', () => {
    const stale = applyObservationToPlan(defaultPlan, observation(), 'holding-vt', new Date('2026-08-20T00:00:00.000Z'))
    expect(stale).toMatchObject({ status: 'rejected', reason: 'not-current', plan: defaultPlan })
    const mismatch = applyObservationToPlan(defaultPlan, observation({ currency: 'THB' }), 'holding-vt', new Date('2026-08-08T00:00:00.000Z'))
    expect(mismatch).toMatchObject({ status: 'rejected', reason: 'currency-mismatch', plan: defaultPlan })
  })

  it('only maps percentage dividends and fees into yield fields', () => {
    expect(observationTargetField(observation({ kind: 'fee', unit: '%/year' }))).toBe('annualFee')
    expect(observationTargetField(observation({ kind: 'dividend', field: 'cash-dividend', unit: 'THB/unit' }))).toBeNull()
    expect(observationTargetField(observation({ kind: 'dividend', field: 'dividend-yield', unit: '%' }))).toBe('dividendYield')
  })

  it('rejects unsupported, missing-value, and missing-holding applications', () => {
    expect(applyObservationToPlan(defaultPlan, observation({ kind: 'benchmark' }), 'holding-vt')).toMatchObject({ status: 'rejected', reason: 'unsupported-field' })
    expect(applyObservationToPlan(defaultPlan, observation({ numericValue: null, textValue: 'missing' }), 'holding-vt')).toMatchObject({ status: 'rejected', reason: 'missing-value' })
    expect(applyObservationToPlan(defaultPlan, observation(), 'missing')).toMatchObject({ status: 'rejected', reason: 'holding-not-found' })
  })

  it('applies FX and percentage fee observations without price-currency logic', () => {
    const now = new Date('2026-08-08T00:00:00.000Z')
    const fx = applyObservationToPlan(defaultPlan, observation({ kind: 'fx', currency: null, numericValue: 36 }), 'holding-vt', now)
    expect(fx.status === 'applied' && fx.plan.holdings.find((item) => item.id === 'holding-vt')?.fxToThb).toBe(36)
    const fee = applyObservationToPlan(defaultPlan, observation({ kind: 'fee', field: 'annual-fee', unit: '%/year', currency: null, numericValue: .2 }), 'holding-vt', now)
    expect(fee.status === 'applied' && fee.plan.holdings.find((item) => item.id === 'holding-vt')?.annualFee).toBe(.2)
  })
})
