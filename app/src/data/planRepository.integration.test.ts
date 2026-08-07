// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultPlan } from '../domain/schema'
import { BrowserUsageMetrics } from './usageMetrics'
import { clearLocalPlanningData, createPlanSnapshot, deletePlanSnapshot, exportBackup, importBackup, importBackupSnapshots, listPlanSnapshots, loadPlan, restorePlanSnapshot, savePlan } from './planRepository'

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
})
