import Dexie, { type EntityTable } from 'dexie'
import { ProviderBatchSchema, ProviderRunSchema, type DataKind, type DataObservation, type ProviderBatch, type ProviderRun, type SecurityIdentity } from './contracts'

export interface ObservationQuery {
  identityId?: string | null
  kind?: DataKind
  field?: string
  providerId?: string
}

export interface MarketDataCache {
  saveBatch(batch: ProviderBatch): Promise<void>
  saveRun(run: ProviderRun): Promise<void>
  listSecurities(): Promise<SecurityIdentity[]>
  listObservations(query?: ObservationQuery): Promise<DataObservation[]>
  listRuns(): Promise<ProviderRun[]>
  clearAll(): Promise<void>
}

export class MemoryMarketDataCache implements MarketDataCache {
  private readonly securities = new Map<string, SecurityIdentity>()
  private readonly observations = new Map<string, DataObservation>()
  private readonly runs = new Map<string, ProviderRun>()

  async saveBatch(input: ProviderBatch) {
    const batch = ProviderBatchSchema.parse(input)
    batch.securities.forEach((item) => this.securities.set(item.id, item))
    batch.observations.forEach((item) => this.observations.set(item.id, item))
  }

  async saveRun(input: ProviderRun) {
    const run = ProviderRunSchema.parse(input)
    this.runs.set(run.id, run)
  }

  async listSecurities() {
    return [...this.securities.values()].toSorted((left, right) => left.name.localeCompare(right.name))
  }

  async listObservations(query: ObservationQuery = {}) {
    return [...this.observations.values()]
      .filter((item) => query.identityId === undefined || item.identityId === query.identityId)
      .filter((item) => query.kind === undefined || item.kind === query.kind)
      .filter((item) => query.field === undefined || item.field === query.field)
      .filter((item) => query.providerId === undefined || item.providerId === query.providerId)
      .toSorted((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt))
  }

  async listRuns() {
    return [...this.runs.values()].toSorted((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
  }

  async clearAll() {
    this.securities.clear()
    this.observations.clear()
    this.runs.clear()
  }
}

const db = new Dexie('flow-wealth-market-data') as Dexie & {
  securities: EntityTable<SecurityIdentity, 'id'>
  observations: EntityTable<DataObservation, 'id'>
  providerRuns: EntityTable<ProviderRun, 'id'>
}

db.version(1).stores({
  securities: 'id, isin, thaiFundCode, [ticker+exchange], currency, updatedAt',
  observations: 'id, [identityId+kind+field], providerId, observedAt, fetchedAt, validationStatus',
  providerRuns: 'id, providerId, startedAt, status',
})

export class BrowserMarketDataCache implements MarketDataCache {
  async saveBatch(input: ProviderBatch) {
    const batch = ProviderBatchSchema.parse(input)
    await db.transaction('rw', db.securities, db.observations, async () => {
      await db.securities.bulkPut(batch.securities)
      await db.observations.bulkPut(batch.observations)
    })
  }

  async saveRun(input: ProviderRun) {
    await db.providerRuns.put(ProviderRunSchema.parse(input))
  }

  async listSecurities() {
    try { return (await db.securities.toArray()).toSorted((left, right) => left.name.localeCompare(right.name)) } catch { return [] }
  }

  async listObservations(query: ObservationQuery = {}) {
    try {
      const rows = await db.observations.toArray()
      return rows
        .filter((item) => query.identityId === undefined || item.identityId === query.identityId)
        .filter((item) => query.kind === undefined || item.kind === query.kind)
        .filter((item) => query.field === undefined || item.field === query.field)
        .filter((item) => query.providerId === undefined || item.providerId === query.providerId)
        .toSorted((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt))
    } catch { return [] }
  }

  async listRuns() {
    try { return await db.providerRuns.orderBy('startedAt').reverse().toArray() } catch { return [] }
  }

  async clearAll() {
    try { await db.transaction('rw', db.securities, db.observations, db.providerRuns, async () => { await db.securities.clear(); await db.observations.clear(); await db.providerRuns.clear() }) }
    catch { /* already empty or storage unavailable */ }
  }
}

export const browserMarketDataCache = new BrowserMarketDataCache()
