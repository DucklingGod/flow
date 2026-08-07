import Dexie, { type EntityTable } from 'dexie'
import { releaseFlags, type ReleaseCapability } from '../config/releaseFlags'
import { assertTextSize, MAX_PLAN_IMPORT_BYTES } from '../domain/importLimits'
import { defaultPlan, migratePlan, parseImportablePlan, type WealthPlan } from '../domain/schema'
import { validateSyncQueueItem, type SyncQueueItem } from '../domain/syncQueue'

interface StoredPlan extends WealthPlan {}

export type SnapshotReason = 'manual' | 'import' | 'beforeRestore' | 'beforeModelUpdate'

export interface PlanSnapshot {
  id: string
  createdAt: string
  label: string
  reason: SnapshotReason
  planVersion: number
  plan: WealthPlan
}

const db = new Dexie('flow-wealth-studio') as Dexie & {
  plans: EntityTable<StoredPlan, 'id'>
  snapshots: EntityTable<PlanSnapshot, 'id'>
  syncQueue: EntityTable<SyncQueueItem, 'id'>
}

db.version(1).stores({ plans: 'id, updatedAt' })
db.version(2).stores({ plans: 'id, updatedAt', snapshots: 'id, createdAt, reason' })
db.version(3).stores({ plans: 'id, updatedAt', snapshots: 'id, createdAt, reason', syncQueue: 'id, createdAt, status' })

const fallbackKey = 'flow-wealth-plan-v1'
const fallbackSnapshotsKey = 'flow-wealth-snapshots-v1'
const MAX_SNAPSHOTS = 50
const MAX_SYNC_QUEUE_ITEMS = 25
const syncQueueIdPattern = /^[a-zA-Z0-9._:-]{1,128}$/

function clonePlan(plan: WealthPlan) {
  return migratePlan(JSON.parse(JSON.stringify(plan)))
}

function fallbackSnapshots() {
  try {
    const raw = localStorage.getItem(fallbackSnapshotsKey)
    if (!raw) return []
    const value = JSON.parse(raw)
    return Array.isArray(value) ? value as PlanSnapshot[] : []
  } catch { return [] }
}

function saveFallbackSnapshots(rows: PlanSnapshot[]) {
  localStorage.setItem(fallbackSnapshotsKey, JSON.stringify(rows.slice(0, MAX_SNAPSHOTS)))
}

export async function loadPlan(): Promise<WealthPlan> {
  try {
    const stored = await db.plans.get(defaultPlan.id)
    if (stored) return migratePlan(stored)
  } catch {
    const raw = localStorage.getItem(fallbackKey)
    if (raw) return migratePlan(JSON.parse(raw))
  }
  return defaultPlan
}

export async function savePlan(plan: WealthPlan) {
  const next = { ...plan, updatedAt: new Date().toISOString() }
  try {
    await db.plans.put(next)
  } catch {
    localStorage.setItem(fallbackKey, JSON.stringify(next))
  }
  return next
}

export async function resetPlan() {
  try { await db.plans.delete(defaultPlan.id) } catch { /* local fallback remains available */ }
  localStorage.removeItem(fallbackKey)
  return { ...defaultPlan, updatedAt: new Date().toISOString() }
}

export function buildPlanSnapshot(plan: WealthPlan, label: string, reason: SnapshotReason = 'manual', now = new Date()): PlanSnapshot {
  const cleanLabel = label.trim().slice(0, 80) || 'Snapshot แผน'
  return {
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
    label: cleanLabel,
    reason,
    planVersion: plan.version,
    plan: clonePlan(plan),
  }
}

export async function createPlanSnapshot(plan: WealthPlan, label: string, reason: SnapshotReason = 'manual') {
  const snapshot = buildPlanSnapshot(plan, label, reason)
  try {
    await db.snapshots.put(snapshot)
    const excess = await db.snapshots.orderBy('createdAt').reverse().offset(MAX_SNAPSHOTS).primaryKeys()
    if (excess.length) await db.snapshots.bulkDelete(excess)
  } catch {
    saveFallbackSnapshots([snapshot, ...fallbackSnapshots().filter((item) => item.id !== snapshot.id)])
  }
  return snapshot
}

export async function listPlanSnapshots(limit = MAX_SNAPSHOTS): Promise<PlanSnapshot[]> {
  const safeLimit = Math.max(1, Math.min(MAX_SNAPSHOTS, Math.floor(limit)))
  try { return await db.snapshots.orderBy('createdAt').reverse().limit(safeLimit).toArray() }
  catch { return fallbackSnapshots().toSorted((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)).slice(0, safeLimit) }
}

export async function deletePlanSnapshot(id: string) {
  try { await db.snapshots.delete(id) }
  catch { saveFallbackSnapshots(fallbackSnapshots().filter((item) => item.id !== id)) }
}

export async function restorePlanSnapshot(id: string) {
  let snapshot: PlanSnapshot | undefined
  try { snapshot = await db.snapshots.get(id) }
  catch { snapshot = fallbackSnapshots().find((item) => item.id === id) }
  if (!snapshot) throw new Error('ไม่พบ snapshot ที่เลือก')
  return { ...migratePlan(snapshot.plan), updatedAt: new Date().toISOString() }
}

export async function clearLocalPlanningData() {
  try { await db.transaction('rw', db.plans, db.snapshots, db.syncQueue, async () => { await db.plans.clear(); await db.snapshots.clear(); await db.syncQueue.clear() }) }
  catch { /* fallback keys are still cleared below */ }
  localStorage.removeItem(fallbackKey)
  localStorage.removeItem(fallbackSnapshotsKey)
}

export type SyncQueuePersistenceResult = { ok: true; action: 'stored' | 'removed' } | { ok: false; reason: 'cloud-sync-disabled' | 'invalid-item' | 'storage-unavailable' }

export async function persistEncryptedSyncQueueItem(
  item: SyncQueueItem,
  flags: Readonly<Record<ReleaseCapability, boolean>> = releaseFlags,
): Promise<SyncQueuePersistenceResult> {
  if (!flags.cloudSync) return { ok: false, reason: 'cloud-sync-disabled' }
  if (!validateSyncQueueItem(item)) return { ok: false, reason: 'invalid-item' }
  try {
    await db.transaction('rw', db.syncQueue, async () => {
      if (item.status === 'acked') await db.syncQueue.delete(item.id)
      else {
        await db.syncQueue.put(structuredClone(item))
        const excess = await db.syncQueue.orderBy('createdAt').reverse().offset(MAX_SYNC_QUEUE_ITEMS).primaryKeys()
        if (excess.length) await db.syncQueue.bulkDelete(excess)
      }
    })
    return { ok: true, action: item.status === 'acked' ? 'removed' : 'stored' }
  } catch { return { ok: false, reason: 'storage-unavailable' } }
}

export async function listEncryptedSyncQueueItems(
  flags: Readonly<Record<ReleaseCapability, boolean>> = releaseFlags,
): Promise<SyncQueueItem[]> {
  if (!flags.cloudSync) return []
  try {
    const rows = await db.syncQueue.orderBy('createdAt').toArray()
    return rows.filter(validateSyncQueueItem).map((item) => structuredClone(item))
  } catch { return [] }
}

export async function deleteEncryptedSyncQueueItem(id: string) {
  if (!syncQueueIdPattern.test(id)) return false
  try { await db.syncQueue.delete(id); return true } catch { return false }
}

export function exportPlan(plan: WealthPlan) {
  return JSON.stringify({
    format: 'flow-wealth-studio',
    exportedAt: new Date().toISOString(),
    plan,
  }, null, 2)
}

export function importPlan(raw: string): WealthPlan {
  assertTextSize(raw, MAX_PLAN_IMPORT_BYTES, 'ไฟล์ใหญ่เกิน 10 MB')
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new Error('ไฟล์ JSON อ่านไม่ได้') }
  const candidate = typeof value === 'object' && value !== null && 'plan' in value ? (value as { plan: unknown }).plan : value
  const parsed = parseImportablePlan(candidate)
  if (!parsed.success) throw new Error(parsed.error)
  return { ...parsed.data, updatedAt: new Date().toISOString() }
}

export function exportBackup(plan: WealthPlan, snapshots: PlanSnapshot[]) {
  return JSON.stringify({
    format: 'flow-wealth-backup',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    plan,
    snapshots: snapshots.slice(0, MAX_SNAPSHOTS),
  }, null, 2)
}

export function importBackup(raw: string): { plan: WealthPlan; snapshots: PlanSnapshot[] } {
  assertTextSize(raw, MAX_PLAN_IMPORT_BYTES, 'ไฟล์ใหญ่เกิน 10 MB')
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new Error('ไฟล์ backup JSON อ่านไม่ได้') }
  if (!value || typeof value !== 'object' || (value as { format?: unknown }).format !== 'flow-wealth-backup' || (value as { backupVersion?: unknown }).backupVersion !== 1) throw new Error('รูปแบบ backup ไม่รองรับ')
  const candidate = value as { plan?: unknown; snapshots?: unknown }
  const parsedPlan = parseImportablePlan(candidate.plan)
  if (!parsedPlan.success) throw new Error(parsedPlan.error)
  const snapshotIds = new Set<string>()
  const snapshots = Array.isArray(candidate.snapshots) ? candidate.snapshots.slice(0, MAX_SNAPSHOTS).flatMap((row) => {
    if (!row || typeof row !== 'object') return []
    const item = row as Partial<PlanSnapshot>
    if (typeof item.id !== 'string' || item.id.length < 1 || item.id.length > 128 || snapshotIds.has(item.id) || typeof item.createdAt !== 'string' || item.createdAt.length > 64 || Number.isNaN(Date.parse(item.createdAt)) || typeof item.label !== 'string' || !['manual', 'import', 'beforeRestore', 'beforeModelUpdate'].includes(item.reason ?? '') || !item.plan) return []
    const parsed = parseImportablePlan(item.plan)
    if (!parsed.success) return []
    snapshotIds.add(item.id)
    return [{ id: item.id, createdAt: item.createdAt, label: item.label.slice(0, 80), reason: item.reason as SnapshotReason, planVersion: parsed.data.version, plan: parsed.data }]
  }) : []
  return { plan: { ...parsedPlan.data, updatedAt: new Date().toISOString() }, snapshots }
}

export async function importBackupSnapshots(snapshots: PlanSnapshot[]) {
  const rows = snapshots.slice(0, MAX_SNAPSHOTS)
  try { await db.snapshots.bulkPut(rows) }
  catch { saveFallbackSnapshots(rows) }
}
