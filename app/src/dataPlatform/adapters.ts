import { TAX_DATASETS } from '../domain/tax'
import { ProviderBatchSchema, type DataObservation, type DataProviderAdapter, type ProviderBatch, type ProviderDescriptor, type ProviderRequest, type RuntimeCredentials } from './contracts'

const checkedAtInstant = (date: string) => `${date}T00:00:00.000Z`

function checksum(value: string) {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export const officialTaxAdapter: DataProviderAdapter = {
  descriptor: {
    id: 'thai-official-tax', name: 'Thai official tax sources', kinds: ['taxRule'], authMode: 'none',
    sourceUrl: 'https://www.rd.go.th/', licensingStatus: 'open', rateLimitPerHour: null, scheduledIngestion: 'disabled',
    notes: 'Static, versioned planning dataset; expert review pending and never used as a filing service.',
  },
  async fetch(request) {
    const fetchedAt = new Date().toISOString()
    const observations: DataObservation[] = request.kinds.includes('taxRule') ? Object.values(TAX_DATASETS).flatMap((dataset) => dataset.sources.map((source, index) => {
      const textValue = JSON.stringify({ datasetVersion: dataset.version, taxYear: dataset.taxYear, status: dataset.status, sourceTitle: source.title })
      const observedAt = new Date(Math.min(Date.parse(checkedAtInstant(source.checkedAt)), Date.parse(fetchedAt))).toISOString()
      return {
        id: `thai-tax:${dataset.version}:${index}`, kind: 'taxRule' as const, identityId: null, field: `tax-rule-source-${index + 1}`,
        numericValue: null, textValue, unit: 'rule', currency: null, observedAt, fetchedAt,
        providerId: 'thai-official-tax', sourceUrl: source.url, sourceAsOf: source.effectiveFrom, staleAfterHours: 24 * 366,
        licensingStatus: 'open' as const, licenseNotes: 'Public official source; verify conditions before filing.', confidence: 'official' as const,
        validationStatus: 'valid' as const, checksum: checksum(textValue),
      }
    })) : []
    return ProviderBatchSchema.parse({ providerId: 'thai-official-tax', fetchedAt, securities: [], observations, warnings: ['ชุดกฎยังรอผู้เชี่ยวชาญตรวจ G6'] })
  },
}

export function createManualSnapshotAdapter(snapshot: unknown): DataProviderAdapter {
  const parsed = ProviderBatchSchema.parse(snapshot)
  const descriptor: ProviderDescriptor = {
    id: parsed.providerId, name: 'Manual verified snapshot', kinds: [...new Set(parsed.observations.map((item) => item.kind))], authMode: 'none',
    sourceUrl: parsed.observations[0]?.sourceUrl ?? 'https://localhost.invalid/manual-snapshot', licensingStatus: 'userAuthorized', rateLimitPerHour: null,
    scheduledIngestion: 'disabled', notes: 'Imported by the user; source rights and as-of dates remain visible.',
  }
  return {
    descriptor,
    async fetch(request: ProviderRequest): Promise<ProviderBatch> {
      const identityFilter = new Set(request.identityIds ?? [])
      return {
        ...parsed,
        securities: request.identityIds ? parsed.securities.filter((item) => identityFilter.has(item.id)) : parsed.securities,
        observations: parsed.observations.filter((item) => request.kinds.includes(item.kind) && (!request.identityIds || (item.identityId !== null && identityFilter.has(item.identityId)))),
      }
    },
  }
}

export type AuthorizedResponseMapper = (payload: unknown, request: ProviderRequest, fetchedAt: string) => ProviderBatch

export const SEC_OPEN_DATA_DESCRIPTOR: ProviderDescriptor = {
  id: 'sec-open-data', name: 'SEC Thailand Open Data', kinds: ['nav', 'dividend', 'factsheet', 'fee'], authMode: 'sessionKey',
  sourceUrl: 'https://api-portal.sec.or.th/', licensingStatus: 'userAuthorized', rateLimitPerHour: null, scheduledIngestion: 'backendOnly',
  notes: 'Requires a user subscription key. Fund Daily Info and Fund Factsheet data remain subject to portal terms.',
}

export const BOT_DATA_DESCRIPTOR: ProviderDescriptor = {
  id: 'bot-open-api', name: 'Bank of Thailand API', kinds: ['fx', 'depositRate', 'benchmark'], authMode: 'sessionKey',
  sourceUrl: 'https://portal.api.bot.or.th/', licensingStatus: 'userAuthorized', rateLimitPerHour: 200, scheduledIngestion: 'backendOnly',
  notes: 'Requires an Authorization key; exchange-rate plan documents a 200 calls/hour limit.',
}

function createAuthorizedOfficialAdapter(descriptor: ProviderDescriptor, allowedOrigin: string, responseMapper: AuthorizedResponseMapper, fetchImpl: typeof fetch = fetch): DataProviderAdapter {
  return {
    descriptor,
    async fetch(request: ProviderRequest, credentials?: RuntimeCredentials) {
      if (!credentials?.apiKey?.trim()) throw new Error('session-key-required')
      if (!request.endpoint) throw new Error('provider-endpoint-required')
      const endpoint = new URL(request.endpoint)
      if (endpoint.origin !== allowedOrigin) throw new Error('provider-origin-not-allowed')
      const response = await fetchImpl(endpoint, { headers: { Authorization: credentials.apiKey.trim() } })
      if (response.status === 401 || response.status === 403) throw new Error('provider-authorization-failed')
      if (response.status === 429) throw new Error('provider-rate-limited')
      if (!response.ok) throw new Error(`provider-http-${response.status}`)
      return responseMapper(await response.json(), request, new Date().toISOString())
    },
  }
}

export function createSecOpenDataAdapter(responseMapper: AuthorizedResponseMapper, fetchImpl: typeof fetch = fetch) {
  return createAuthorizedOfficialAdapter(SEC_OPEN_DATA_DESCRIPTOR, 'https://api.sec.or.th', responseMapper, fetchImpl)
}

export function createBotDataAdapter(responseMapper: AuthorizedResponseMapper, fetchImpl: typeof fetch = fetch) {
  return createAuthorizedOfficialAdapter(BOT_DATA_DESCRIPTOR, 'https://gateway.api.bot.or.th', responseMapper, fetchImpl)
}
