import { describe, expect, it, vi } from 'vitest'
import type { DataObservation, ProviderBatch, SecurityIdentity } from './contracts'
import { createBotDataAdapter, createManualSnapshotAdapter, createSecOpenDataAdapter, officialTaxAdapter } from './adapters'

const security: SecurityIdentity = { id: 'fund-1', name: 'Fund One', ticker: 'F1', exchange: 'SET', isin: null, thaiFundCode: 'M1', shareClass: 'A', currency: 'THB', distributionMode: 'accumulating', fxHedgedPercent: null, aliases: [], updatedAt: '2026-08-07T00:00:00.000Z' }
const observation: DataObservation = { id: 'obs-1', kind: 'nav', identityId: 'fund-1', field: 'nav', numericValue: 10, textValue: null, unit: 'THB/unit', currency: 'THB', observedAt: '2026-08-07T00:00:00.000Z', fetchedAt: '2026-08-07T01:00:00.000Z', providerId: 'manual-file-1', sourceUrl: 'https://example.com/nav', sourceAsOf: '2026-08-07', staleAfterHours: 48, licensingStatus: 'userAuthorized', licenseNotes: '', confidence: 'userProvided', validationStatus: 'valid', checksum: 'checksum-001' }

describe('data provider adapters', () => {
  it('exposes versioned official tax sources with provenance', async () => {
    const batch = await officialTaxAdapter.fetch({ kinds: ['taxRule'] })
    expect(batch.observations.length).toBeGreaterThanOrEqual(4)
    expect(batch.observations.every((item) => item.sourceAsOf && item.sourceUrl && item.confidence === 'official')).toBe(true)
  })

  it('filters a user-authorized manual snapshot without inventing values', async () => {
    const snapshot: ProviderBatch = { providerId: 'manual-file-1', fetchedAt: '2026-08-07T01:00:00.000Z', securities: [security], observations: [observation], warnings: [] }
    const adapter = createManualSnapshotAdapter(snapshot)
    expect(adapter.descriptor.sourceUrl).toBe('https://example.com/nav')
    expect((await adapter.fetch({ kinds: ['price'] })).observations).toEqual([])
    expect((await adapter.fetch({ kinds: ['nav'], identityIds: ['fund-1'] })).observations).toEqual([observation])
    expect((await adapter.fetch({ kinds: ['nav'], identityIds: ['missing'] })).securities).toEqual([])
  })

  it('uses a safe fallback source URL for an empty manual snapshot', () => {
    const snapshot: ProviderBatch = { providerId: 'empty-file', fetchedAt: '2026-08-07T00:00:00.000Z', securities: [], observations: [], warnings: [] }
    expect(createManualSnapshotAdapter(snapshot).descriptor.sourceUrl).toContain('localhost.invalid')
  })

  it('keeps credentials in the call and blocks a non-BOT origin', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const adapter = createBotDataAdapter(() => ({ providerId: 'bot-open-api', fetchedAt: '2026-08-07T00:00:00.000Z', securities: [], observations: [], warnings: [] }), fetcher)
    await expect(adapter.fetch({ kinds: ['fx'], endpoint: 'https://evil.example/data' }, { apiKey: 'secret' })).rejects.toThrow('origin')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('enforces credentials, endpoint, authorization, rate-limit, and HTTP status', async () => {
    const mapper = (): ProviderBatch => ({ providerId: 'bot-open-api', fetchedAt: '2026-08-07T00:00:00.000Z', securities: [], observations: [], warnings: [] })
    const endpoint = 'https://gateway.api.bot.or.th/Stat-ExchangeRate/v2/test'
    const adapter = createBotDataAdapter(mapper, vi.fn<typeof fetch>())
    await expect(adapter.fetch({ kinds: ['fx'], endpoint })).rejects.toThrow('session-key')
    await expect(adapter.fetch({ kinds: ['fx'] }, { apiKey: 'key' })).rejects.toThrow('endpoint')
    for (const status of [401, 403, 429, 500]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status }))
      const candidate = createBotDataAdapter(mapper, fetcher)
      const expected = status === 429 ? 'rate-limited' : status === 401 || status === 403 ? 'authorization-failed' : 'http-500'
      await expect(candidate.fetch({ kinds: ['fx'], endpoint }, { apiKey: ' key ' })).rejects.toThrow(expected)
      expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: { Authorization: 'key' } })
    }
  })

  it('maps successful SEC and BOT JSON responses only from their allowed origins', async () => {
    const secBatch: ProviderBatch = { providerId: 'sec-open-data', fetchedAt: '2026-08-07T00:00:00.000Z', securities: [], observations: [], warnings: [] }
    const secMapper = vi.fn(() => secBatch)
    const secFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    const sec = createSecOpenDataAdapter(secMapper, secFetch)
    await expect(sec.fetch({ kinds: ['nav'], endpoint: 'https://api.sec.or.th/FundDailyInfo/test' }, { apiKey: 'sec-key' })).resolves.toEqual(secBatch)
    expect(secMapper).toHaveBeenCalledWith({ ok: true }, expect.anything(), expect.any(String))

    const botBatch: ProviderBatch = { providerId: 'bot-open-api', fetchedAt: '2026-08-07T00:00:00.000Z', securities: [], observations: [], warnings: [] }
    const bot = createBotDataAdapter(() => botBatch, vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 })))
    await expect(bot.fetch({ kinds: ['fx'], endpoint: 'https://gateway.api.bot.or.th/Stat-ExchangeRate/v2/test' }, { apiKey: 'bot-key' })).resolves.toEqual(botBatch)
  })

  it('returns no tax rows when the requested kind excludes tax rules', async () => {
    expect((await officialTaxAdapter.fetch({ kinds: ['price'] })).observations).toEqual([])
  })
})
