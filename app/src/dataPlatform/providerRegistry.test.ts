import { describe, expect, it, vi } from 'vitest'
import type { DataObservation, DataProviderAdapter, ProviderBatch, SecurityIdentity } from './contracts'
import { ProviderRegistry } from './providerRegistry'

const batch: ProviderBatch = { providerId: 'provider-1', fetchedAt: '2026-08-07T01:00:00.000Z', securities: [], observations: [], warnings: [] }
const adapter = (fetcher: DataProviderAdapter['fetch'] = async () => batch, overrides: Partial<DataProviderAdapter['descriptor']> = {}): DataProviderAdapter => ({
  descriptor: { id: 'provider-1', name: 'Provider 1', kinds: ['fx'], authMode: 'sessionKey', sourceUrl: 'https://example.com', licensingStatus: 'userAuthorized', rateLimitPerHour: 200, scheduledIngestion: 'backendOnly', notes: '', ...overrides },
  fetch: fetcher,
})
const security: SecurityIdentity = { id: 'sec-1', name: 'Security', ticker: 'SEC', exchange: 'SET', isin: null, thaiFundCode: null, shareClass: null, currency: 'THB', distributionMode: 'unknown', fxHedgedPercent: null, aliases: [], updatedAt: '2026-08-07T00:00:00.000Z' }
const observation = (overrides: Partial<DataObservation> = {}): DataObservation => ({ id: 'obs-1', kind: 'fx', identityId: 'sec-1', field: 'fx', numericValue: 1, textValue: null, unit: 'THB', currency: 'THB', observedAt: '2026-08-07T00:00:00.000Z', fetchedAt: '2026-08-07T01:00:00.000Z', providerId: 'provider-1', sourceUrl: 'https://example.com/fx', sourceAsOf: '2026-08-07', staleAfterHours: 24, licensingStatus: 'userAuthorized', licenseNotes: '', confidence: 'verified', validationStatus: 'valid', checksum: 'checksum-001', ...overrides })

describe('provider registry safety policy', () => {
  it('requires a session key without calling the adapter', async () => {
    const fetcher = vi.fn(async () => batch)
    const result = await new ProviderRegistry().register(adapter(fetcher)).execute('provider-1', { kinds: ['fx'] })
    expect(result.run.status).toBe('authorizationRequired')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects scheduled ingestion outside an authorized backend', async () => {
    const result = await new ProviderRegistry().register(adapter()).execute('provider-1', { kinds: ['fx'] }, { apiKey: 'session-only' }, { scheduled: true })
    expect(result.run.errorCode).toBe('scheduled-backend-required')
  })

  it('retries transient failures and validates a successful contract', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(batch)
    const result = await new ProviderRegistry().register(adapter(fetcher)).execute('provider-1', { kinds: ['fx'] }, { apiKey: 'session-only' }, { delay: async () => undefined })
    expect(result.run.status).toBe('success')
    expect(result.run.attemptCount).toBe(2)
  })

  it('stops on contract violations and returns a freeze-cache message', async () => {
    const badBatch = { ...batch, providerId: 'wrong-provider' }
    const result = await new ProviderRegistry().register(adapter(async () => badBatch)).execute('provider-1', { kinds: ['fx'] }, { apiKey: 'session-only' })
    expect(result.run.status).toBe('failed')
    expect(result.run.errorCode).toBe('provider-id-mismatch')
    expect(result.run.message).toContain('cache')
  })

  it('lists descriptors and rejects missing or duplicate registry entries', async () => {
    const registry = new ProviderRegistry().register(adapter())
    expect(registry.descriptors()).toHaveLength(1)
    expect(() => registry.register(adapter())).toThrow('already-registered')
    await expect(registry.execute('missing', { kinds: ['fx'] })).rejects.toThrow('not-registered')
  })

  it('rejects unsupported kinds and locally rate-limits repeated calls', async () => {
    const unsupported = await new ProviderRegistry().register(adapter()).execute('provider-1', { kinds: ['price'] }, { apiKey: 'key' })
    expect(unsupported.run.errorCode).toBe('unsupported-data-kind')
    const registry = new ProviderRegistry().register(adapter(undefined, { rateLimitPerHour: 1 }))
    expect((await registry.execute('provider-1', { kinds: ['fx'] }, { apiKey: 'key' })).run.status).toBe('success')
    expect((await registry.execute('provider-1', { kinds: ['fx'] }, { apiKey: 'key' })).run.status).toBe('rateLimited')
  })

  it('allows scheduled retrieval only inside an authorized backend context', async () => {
    const result = await new ProviderRegistry().register(adapter()).execute('provider-1', { kinds: ['fx'] }, { apiKey: 'key' }, { scheduled: true, backendContext: true })
    expect(result.run.status).toBe('success')
  })

  it('reports partial batches and accepted/quarantined counts', async () => {
    const partial: ProviderBatch = { providerId: 'provider-1', fetchedAt: '2026-08-07T01:00:00.000Z', securities: [security], observations: [observation(), observation({ id: 'obs-2', validationStatus: 'quarantined' })], warnings: ['one row quarantined'] }
    const result = await new ProviderRegistry().register(adapter(async () => partial)).execute('provider-1', { kinds: ['fx'] }, { apiKey: 'key' })
    expect(result.run).toMatchObject({ status: 'partial', receivedCount: 2, acceptedCount: 1, quarantinedCount: 1 })
  })

  it('rejects malformed, unexpected, orphaned, and duplicate provider batches', async () => {
    const cases: Array<[unknown, string]> = [
      [{ broken: true }, 'provider-contract-invalid'],
      [{ ...batch, observations: [observation({ kind: 'price' })], securities: [security] }, 'unexpected-data-kind'],
      [{ ...batch, observations: [observation()], securities: [] }, 'unknown-security-reference'],
      [{ ...batch, observations: [observation(), observation()], securities: [security] }, 'duplicate-observation-id'],
    ]
    for (const [candidate, error] of cases) {
      const result = await new ProviderRegistry().register(adapter(async () => candidate as ProviderBatch)).execute('provider-1', { kinds: ['fx'] }, { apiKey: 'key' }, { maxAttempts: 1, delay: async () => undefined })
      expect(result.run.errorCode).toBe(error)
    }
  })

  it('handles non-Error failures and clamps retry attempts', async () => {
    const result = await new ProviderRegistry().register(adapter(async () => { throw 'offline' })).execute('provider-1', { kinds: ['fx'] }, { apiKey: 'key' }, { maxAttempts: 0, delay: async () => undefined })
    expect(result.run).toMatchObject({ status: 'failed', attemptCount: 1, errorCode: 'provider-failed' })
  })
})
