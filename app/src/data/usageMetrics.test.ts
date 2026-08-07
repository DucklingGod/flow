import { describe, expect, it } from 'vitest'
import { BrowserUsageMetrics, MemoryUsageMetrics } from './usageMetrics'

describe('consented local usage metrics', () => {
  it('records nothing until consent is enabled and deletes events on revoke', async () => {
    const now = () => new Date('2026-08-07T00:00:00.000Z')
    const metrics = new MemoryUsageMetrics(now)
    await expect(metrics.record('studio', 'routeViewed')).resolves.toBe(false)
    expect(await metrics.list()).toEqual([])
    await metrics.setConsent(true)
    await expect(metrics.record('vault', 'backupExported')).resolves.toBe(true)
    expect(await metrics.list()).toMatchObject([{ route: 'vault', action: 'backupExported' }])
    await metrics.setConsent(false)
    expect(await metrics.list()).toEqual([])
  })

  it('keeps only allowlisted route/action fields and prunes older than 30 days', async () => {
    let date = new Date('2026-06-01T00:00:00.000Z')
    const metrics = new MemoryUsageMetrics(() => date)
    await metrics.setConsent(true)
    await metrics.record('wealth', 'routeViewed')
    date = new Date('2026-08-07T00:00:00.000Z')
    await metrics.record('vault', 'snapshotCreated')
    const events = await metrics.list()
    expect(events).toHaveLength(1)
    expect(Object.keys(events[0]).toSorted()).toEqual(['action', 'at', 'id', 'route'])
  })

  it('fails closed without IndexedDB', async () => {
    const metrics = new BrowserUsageMetrics()
    expect((await metrics.status()).consent).toBe(false)
    await expect(metrics.record('studio', 'routeViewed')).resolves.toBe(false)
    await expect(metrics.list()).resolves.toEqual([])
    await expect(metrics.clearAll()).resolves.toBeUndefined()
  })
})
