import Dexie, { type EntityTable } from 'dexie'

export const usageRoutes = ['studio', 'wealth', 'life', 'portfolio', 'scenario', 'retirement', 'protection', 'tax', 'legacy', 'data', 'reviews', 'vault', 'more'] as const
export type UsageRoute = typeof usageRoutes[number]
export const usageActions = ['routeViewed', 'snapshotCreated', 'backupExported', 'backupRestored', 'csvExported', 'printOpened', 'localDataDeleted'] as const
export type UsageAction = typeof usageActions[number]

export interface UsageEvent {
  id: string
  at: string
  route: UsageRoute
  action: UsageAction
}

export interface UsageMetricsStatus {
  consent: boolean
  updatedAt: string
  retentionDays: 30
}

export interface UsageMetricsStore {
  status(): Promise<UsageMetricsStatus>
  setConsent(consent: boolean): Promise<UsageMetricsStatus>
  record(route: UsageRoute, action: UsageAction): Promise<boolean>
  list(): Promise<UsageEvent[]>
  clearAll(): Promise<void>
}

const disabledStatus = (): UsageMetricsStatus => ({ consent: false, updatedAt: new Date(0).toISOString(), retentionDays: 30 })

export class MemoryUsageMetrics implements UsageMetricsStore {
  private currentStatus = disabledStatus()
  private events: UsageEvent[] = []
  private readonly now: () => Date
  constructor(now: () => Date = () => new Date()) { this.now = now }

  async status() { return this.currentStatus }
  async setConsent(consent: boolean) {
    this.currentStatus = { consent, updatedAt: this.now().toISOString(), retentionDays: 30 }
    if (!consent) this.events = []
    return this.currentStatus
  }
  async record(route: UsageRoute, action: UsageAction) {
    if (!this.currentStatus.consent) return false
    const cutoff = this.now().getTime() - this.currentStatus.retentionDays * 86_400_000
    this.events = this.events.filter((event) => Date.parse(event.at) >= cutoff)
    this.events.push({ id: crypto.randomUUID(), at: this.now().toISOString(), route, action })
    return true
  }
  async list() { return this.events.toSorted((left, right) => Date.parse(right.at) - Date.parse(left.at)) }
  async clearAll() { this.events = []; this.currentStatus = disabledStatus() }
}

const db = new Dexie('flow-wealth-telemetry') as Dexie & {
  settings: EntityTable<UsageMetricsStatus & { id: 'usage' }, 'id'>
  events: EntityTable<UsageEvent, 'id'>
}

db.version(1).stores({ settings: 'id, updatedAt', events: 'id, at, route, action' })

export class BrowserUsageMetrics implements UsageMetricsStore {
  async status() {
    try { return (await db.settings.get('usage')) ?? disabledStatus() } catch { return disabledStatus() }
  }
  async setConsent(consent: boolean) {
    const status: UsageMetricsStatus = { consent, updatedAt: new Date().toISOString(), retentionDays: 30 }
    try {
      await db.transaction('rw', db.settings, db.events, async () => {
        await db.settings.put({ id: 'usage', ...status })
        if (!consent) await db.events.clear()
      })
    } catch { return disabledStatus() }
    return status
  }
  async record(route: UsageRoute, action: UsageAction) {
    const status = await this.status()
    if (!status.consent) return false
    try {
      const cutoff = new Date(Date.now() - status.retentionDays * 86_400_000).toISOString()
      await db.transaction('rw', db.events, async () => {
        await db.events.where('at').below(cutoff).delete()
        await db.events.put({ id: crypto.randomUUID(), at: new Date().toISOString(), route, action })
      })
      return true
    } catch { return false }
  }
  async list() { try { return await db.events.orderBy('at').reverse().toArray() } catch { return [] } }
  async clearAll() {
    try { await db.transaction('rw', db.settings, db.events, async () => { await db.settings.clear(); await db.events.clear() }) }
    catch { /* metrics remain fail-closed when storage is unavailable */ }
  }
}

export const browserUsageMetrics = new BrowserUsageMetrics()
