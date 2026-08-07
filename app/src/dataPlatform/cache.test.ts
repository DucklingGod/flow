import { describe, expect, it } from 'vitest'
import type { DataObservation, ProviderBatch, ProviderRun, SecurityIdentity } from './contracts'
import { BrowserMarketDataCache, MemoryMarketDataCache } from './cache'

const security: SecurityIdentity = { id: 'fund-1', name: 'Fund 1', ticker: null, exchange: null, isin: null, thaiFundCode: 'M1', shareClass: 'A', currency: 'THB', distributionMode: 'accumulating', fxHedgedPercent: null, aliases: [], updatedAt: '2026-08-07T00:00:00.000Z' }
const observation = (id: string, observedAt: string): DataObservation => ({ id, kind: 'nav', identityId: 'fund-1', field: 'nav', numericValue: 10, textValue: null, unit: 'THB/unit', currency: 'THB', observedAt, fetchedAt: '2026-08-07T03:00:00.000Z', providerId: 'manual', sourceUrl: 'https://example.com/source', sourceAsOf: observedAt.slice(0, 10), staleAfterHours: 48, licensingStatus: 'userAuthorized', licenseNotes: 'user supplied', confidence: 'userProvided', validationStatus: 'valid', checksum: `checksum-${id}` })

describe('market data cache', () => {
  it('stores validated batches and returns newest observations first', async () => {
    const cache = new MemoryMarketDataCache()
    const batch: ProviderBatch = { providerId: 'manual', fetchedAt: '2026-08-07T03:00:00.000Z', securities: [security], observations: [observation('old', '2026-08-06T00:00:00.000Z'), observation('new', '2026-08-07T00:00:00.000Z')], warnings: [] }
    await cache.saveBatch(batch)
    expect((await cache.listSecurities())[0].id).toBe('fund-1')
    expect((await cache.listObservations({ kind: 'nav' })).map((item) => item.id)).toEqual(['new', 'old'])
  })

  it('stores auditable provider runs separately from plan data', async () => {
    const cache = new MemoryMarketDataCache()
    const run: ProviderRun = { id: 'run-1', providerId: 'manual', startedAt: '2026-08-07T00:00:00.000Z', completedAt: '2026-08-07T00:00:01.000Z', status: 'success', attemptCount: 1, receivedCount: 1, acceptedCount: 1, quarantinedCount: 0, errorCode: null, message: 'ok' }
    await cache.saveRun(run)
    expect(await cache.listRuns()).toEqual([run])
  })

  it('filters observations by identity, field, provider, and unmatched values', async () => {
    const cache = new MemoryMarketDataCache()
    await cache.saveBatch({ providerId: 'manual', fetchedAt: '2026-08-07T03:00:00.000Z', securities: [security], observations: [observation('one', '2026-08-07T00:00:00.000Z')], warnings: [] })
    expect(await cache.listObservations({ identityId: 'fund-1', kind: 'nav', field: 'nav', providerId: 'manual' })).toHaveLength(1)
    expect(await cache.listObservations({ identityId: null })).toEqual([])
    expect(await cache.listObservations({ field: 'price' })).toEqual([])
    expect(await cache.listObservations({ providerId: 'other' })).toEqual([])
  })

  it('rejects invalid batches and provider runs', async () => {
    const cache = new MemoryMarketDataCache()
    await expect(cache.saveBatch({ broken: true } as never)).rejects.toThrow()
    await expect(cache.saveRun({ status: 'bad' } as never)).rejects.toThrow()
  })

  it('clears all cached market data and can be reused', async () => {
    const cache = new MemoryMarketDataCache()
    const run: ProviderRun = { id: 'run-clear', providerId: 'manual', startedAt: '2026-08-07T00:00:00.000Z', completedAt: '2026-08-07T00:00:01.000Z', status: 'success', attemptCount: 1, receivedCount: 1, acceptedCount: 1, quarantinedCount: 0, errorCode: null, message: 'ok' }
    await cache.saveBatch({ providerId: 'manual', fetchedAt: '2026-08-07T03:00:00.000Z', securities: [security], observations: [observation('clear', '2026-08-07T00:00:00.000Z')], warnings: [] })
    await cache.saveRun(run)
    await cache.clearAll()
    expect(await cache.listSecurities()).toEqual([])
    expect(await cache.listObservations()).toEqual([])
    expect(await cache.listRuns()).toEqual([])
  })

  it('fails closed in a runtime without IndexedDB while read paths stay available', async () => {
    const cache = new BrowserMarketDataCache()
    expect(await cache.listSecurities()).toEqual([])
    expect(await cache.listObservations({ kind: 'nav' })).toEqual([])
    expect(await cache.listRuns()).toEqual([])
    await expect(cache.clearAll()).resolves.toBeUndefined()
    await expect(cache.saveBatch({ providerId: 'manual', fetchedAt: '2026-08-07T03:00:00.000Z', securities: [security], observations: [], warnings: [] })).rejects.toThrow()
    await expect(cache.saveRun({ id: 'run-browser', providerId: 'manual', startedAt: '2026-08-07T00:00:00.000Z', completedAt: '2026-08-07T00:00:01.000Z', status: 'success', attemptCount: 1, receivedCount: 0, acceptedCount: 0, quarantinedCount: 0, errorCode: null, message: 'ok' })).rejects.toThrow()
  })
})
