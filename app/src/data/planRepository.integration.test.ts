// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { releaseFlags } from '../config/releaseFlags'
import { defaultPlan } from '../domain/schema'
import { createSyncEnvelope, generateSyncEncryptionKey } from '../domain/syncEnvelope'
import { applySyncReceipt, createSyncQueueItem, markSyncAttemptStarted, planSyncAttempt } from '../domain/syncQueue'
import { BrowserUsageMetrics } from './usageMetrics'
import { clearLocalPlanningData, createPlanSnapshot, deleteEncryptedSyncQueueItem, deletePlanSnapshot, exportBackup, importBackup, importBackupSnapshots, listEncryptedSyncQueueItems, listPlanSnapshots, loadPlan, persistEncryptedSyncQueueItem, restorePlanSnapshot, savePlan } from './planRepository'

const syncEnabled = { ...releaseFlags, account: true, cloudSync: true }
const syncAuthorization = { allowed: true, action: 'editPlan' as const, capability: 'cloudSync' as const, subjectId: 'user-owner', resourceHouseholdId: 'household-001', reason: 'allowed' as const }
const syncDataUse = { allowed: true, reason: 'allowed' as const, capability: 'cloudSync' as const }

describe('disposable IndexedDB backup and recovery drill', () => {
  beforeEach(async () => { await clearLocalPlanningData() })

  it('persists, snapshots, exports, stages, restores, imports history, and deletes local data', async () => {
    const working = { ...defaultPlan, expectedReturn: 5.25, name: 'แผนทดสอบ recovery' }
    await savePlan(working)
    expect((await loadPlan()).expectedReturn).toBe(5.25)

    const first = await createPlanSnapshot(working, 'ก่อน stress test', 'manual')
    const later = await createPlanSnapshot({ ...working, expectedReturn: 2 }, 'bear case', 'manual')
    expect((await listPlanSnapshots()).map((item) => item.id)).toEqual([later.id, first.id])

    const encryptedPayloadCandidate = exportBackup(working, await listPlanSnapshots())
    const staged = importBackup(encryptedPayloadCandidate)
    expect(staged.plan.name).toBe('แผนทดสอบ recovery')
    expect(staged.snapshots).toHaveLength(2)

    await savePlan({ ...working, expectedReturn: 9 })
    const restored = await restorePlanSnapshot(first.id)
    await savePlan(restored)
    expect((await loadPlan()).expectedReturn).toBe(5.25)

    await clearLocalPlanningData()
    await importBackupSnapshots(staged.snapshots)
    expect(await listPlanSnapshots()).toHaveLength(2)
    await deletePlanSnapshot(first.id)
    expect((await listPlanSnapshots()).map((item) => item.id)).toEqual([later.id])

    await clearLocalPlanningData()
    expect(await listPlanSnapshots()).toEqual([])
    expect((await loadPlan()).id).toBe(defaultPlan.id)
  })

  it('persists metrics only after consent and purges them on revoke', async () => {
    const metrics = new BrowserUsageMetrics()
    await metrics.clearAll()
    await expect(metrics.record('vault', 'routeViewed')).resolves.toBe(false)
    await metrics.setConsent(true)
    await expect(metrics.record('vault', 'snapshotCreated')).resolves.toBe(true)
    expect(await metrics.list()).toHaveLength(1)
    await metrics.setConsent(false)
    expect(await metrics.list()).toEqual([])
    expect((await metrics.status()).consent).toBe(false)
  })

  it('persists only bounded opaque sync envelopes when the test flag is enabled', async () => {
    const key = await generateSyncEncryptionKey()
    const created = await createSyncEnvelope({ mutationId: 'mutation-001', planId: 'primary-plan', householdId: 'household-001', deviceId: 'device-001', keyId: 'key-gen-001', baseRevision: 1, localRevision: 2, baseDigest: 'a'.repeat(64), sectionIds: ['projection'], createdAt: '2026-08-07T08:00:00.000Z', expiresAt: '2026-08-08T08:00:00.000Z', plaintext: '{"monthlyContribution":25000}' }, key)
    expect(created.ok).toBe(true)
    if (!created.ok) return
    const queued = createSyncQueueItem(created.envelope, syncAuthorization, syncDataUse, syncEnabled)
    expect(queued.ok).toBe(true)
    if (!queued.ok) return
    expect(await persistEncryptedSyncQueueItem(queued.item)).toEqual({ ok: false, reason: 'cloud-sync-disabled' })
    expect(await persistEncryptedSyncQueueItem(queued.item, syncEnabled)).toEqual({ ok: true, action: 'stored' })
    expect(await listEncryptedSyncQueueItems()).toEqual([])
    const stored = await listEncryptedSyncQueueItems(syncEnabled)
    expect(stored).toHaveLength(1)
    expect(JSON.stringify(stored[0])).not.toContain('monthlyContribution')
    const attempt = planSyncAttempt(queued.item, { now: '2026-08-07T08:00:01.000Z', online: true, deviceStatus: 'active', authorization: syncAuthorization, dataUse: syncDataUse, remoteHead: { planId: created.envelope.planId, revision: created.envelope.baseRevision, digest: created.envelope.baseDigest } }, syncEnabled)
    const inFlight = markSyncAttemptStarted(queued.item, attempt, '2026-08-07T08:00:01.000Z')
    expect(inFlight).not.toBeNull()
    if (!inFlight) return
    const acked = applySyncReceipt(inFlight, { receiptId: 'receipt-001', mutationId: queued.item.id, planId: created.envelope.planId, householdId: created.envelope.householdId, deviceId: created.envelope.deviceId, status: 'accepted', acceptedRevision: created.envelope.localRevision, acceptedDigest: created.envelope.localDigest, receivedAt: '2026-08-07T08:00:02.000Z' })
    expect(acked).not.toBeNull()
    if (!acked) return
    expect(await persistEncryptedSyncQueueItem({ ...acked, receipt: acked.receipt ? { ...acked.receipt, deviceId: 'other-device' } : null }, syncEnabled)).toEqual({ ok: false, reason: 'invalid-item' })
    expect(await persistEncryptedSyncQueueItem(acked, syncEnabled)).toEqual({ ok: true, action: 'removed' })
    expect(await listEncryptedSyncQueueItems(syncEnabled)).toEqual([])
    expect(await persistEncryptedSyncQueueItem({ ...queued.item, id: 'substituted-id' }, syncEnabled)).toEqual({ ok: false, reason: 'invalid-item' })
    expect(await persistEncryptedSyncQueueItem(queued.item, syncEnabled)).toEqual({ ok: true, action: 'stored' })
    expect(await deleteEncryptedSyncQueueItem('../invalid')).toBe(false)
    expect(await deleteEncryptedSyncQueueItem(queued.item.id)).toBe(true)
    expect(await listEncryptedSyncQueueItems(syncEnabled)).toEqual([])
  })

  it('caps the encrypted queue at 25 items and includes it in complete local deletion', async () => {
    const key = await generateSyncEncryptionKey()
    for (let index = 0; index < 26; index += 1) {
      const createdAt = new Date(Date.parse('2026-08-07T08:00:00.000Z') + index * 1_000).toISOString()
      const expiresAt = new Date(Date.parse(createdAt) + 24 * 60 * 60 * 1_000).toISOString()
      const created = await createSyncEnvelope({ mutationId: `mutation-${String(index).padStart(3, '0')}`, planId: 'primary-plan', householdId: 'household-001', deviceId: 'device-001', keyId: 'key-gen-001', baseRevision: index, localRevision: index + 1, baseDigest: 'a'.repeat(64), sectionIds: ['projection'], createdAt, expiresAt, plaintext: JSON.stringify({ index }) }, key)
      if (!created.ok) throw new Error(created.reason)
      const queued = createSyncQueueItem(created.envelope, syncAuthorization, syncDataUse, syncEnabled)
      if (!queued.ok) throw new Error(queued.reason)
      expect(await persistEncryptedSyncQueueItem(queued.item, syncEnabled)).toEqual({ ok: true, action: 'stored' })
    }
    const capped = await listEncryptedSyncQueueItems(syncEnabled)
    expect(capped).toHaveLength(25)
    expect(capped[0]?.id).toBe('mutation-001')
    await clearLocalPlanningData()
    expect(await listEncryptedSyncQueueItems(syncEnabled)).toEqual([])
  })
})
