import { describe, expect, it } from 'vitest'
import { defaultPlan } from '../domain/schema'
import { MAX_PLAN_IMPORT_BYTES } from '../domain/importLimits'
import { LEGACY_CALCULATION_MODEL_VERSION } from '../domain/calculationModels'
import { buildPlanSnapshot, exportBackup, exportPlan, importBackup, importPlan } from './planRepository'

describe('plan import and export', () => {
  it('round-trips a versioned plan without losing ledger records', () => {
    const imported = importPlan(exportPlan(defaultPlan))
    expect(imported.version).toBe(10)
    expect(imported.accounts).toEqual(defaultPlan.accounts)
    expect(imported.debts).toEqual(defaultPlan.debts)
  })

  it('rejects malformed JSON and an unsafe schema', () => {
    expect(() => importPlan('{bad')).toThrow('JSON')
    expect(() => importPlan(JSON.stringify({ plan: { version: 99 } }))).toThrow('schema')
  })

  it('rejects oversized, non-finite, and overlong identifier payloads', () => {
    expect(() => importPlan('x'.repeat(MAX_PLAN_IMPORT_BYTES + 1))).toThrow('10 MB')
    expect(() => importPlan(JSON.stringify({ plan: { ...defaultPlan, expectedReturn: Number.POSITIVE_INFINITY } }))).toThrow('schema')
    expect(() => importPlan(JSON.stringify({ plan: { ...defaultPlan, id: 'x'.repeat(129) } }))).toThrow('schema')
  })

  it('strips unknown prototype-shaped keys without mutating Object.prototype', () => {
    const plan = JSON.parse(JSON.stringify(defaultPlan)) as Record<string, unknown>
    Object.defineProperty(plan, '__proto__', { value: { polluted: 'yes' }, enumerable: true })
    const imported = importPlan(JSON.stringify({ plan }))
    expect((imported as unknown as Record<string, unknown>).polluted).toBeUndefined()
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('builds immutable version snapshots with a bounded label', () => {
    const snapshot = buildPlanSnapshot(defaultPlan, `  ${'แผน'.repeat(40)}  `, 'beforeRestore', new Date('2026-08-07T00:00:00.000Z'))
    expect(snapshot.createdAt).toBe('2026-08-07T00:00:00.000Z')
    expect(snapshot.reason).toBe('beforeRestore')
    expect(snapshot.label.length).toBeLessThanOrEqual(80)
    expect(snapshot.plan).not.toBe(defaultPlan)
    expect(snapshot.plan.version).toBe(10)
  })

  it('round-trips a full backup and rejects unsupported envelopes', () => {
    const snapshot = buildPlanSnapshot(defaultPlan, 'ก่อนทดลอง scenario', 'manual', new Date('2026-08-07T00:00:00.000Z'))
    const restored = importBackup(exportBackup(defaultPlan, [snapshot]))
    expect(restored.plan.version).toBe(10)
    expect(restored.snapshots).toHaveLength(1)
    expect(restored.snapshots[0].label).toBe('ก่อนทดลอง scenario')
    expect(() => importBackup(JSON.stringify({ format: 'other', backupVersion: 1 }))).toThrow('ไม่รองรับ')
  })

  it('bounds and deduplicates imported snapshot metadata', () => {
    const snapshot = buildPlanSnapshot(defaultPlan, 'valid', 'manual', new Date('2026-08-07T00:00:00.000Z'))
    const payload = JSON.parse(exportBackup(defaultPlan, [])) as { snapshots: unknown[] }
    payload.snapshots = [snapshot, { ...snapshot }, { ...snapshot, id: 'x'.repeat(129) }, { ...snapshot, id: 'bad-date', createdAt: 'not-a-date' }, null]
    const restored = importBackup(JSON.stringify(payload))
    expect(restored.snapshots).toHaveLength(1)
    expect(restored.snapshots[0].id).toBe(snapshot.id)
  })

  it('rejects an adversarial backup envelope corpus without accepting a partial plan', () => {
    const corpus = [null, [], {}, { format: 'flow-wealth-backup', backupVersion: 2 }, { format: 'flow-wealth-backup', backupVersion: 1, plan: null }, { format: 'flow-wealth-backup', backupVersion: 1, plan: { ...defaultPlan, transactions: new Array(20_001).fill(defaultPlan.transactions[0]) } }]
    for (const payload of corpus) expect(() => importBackup(JSON.stringify(payload))).toThrow()
  })

  it('preserves the prior calculation model in a before-update restore point', () => {
    const legacy = { ...defaultPlan, calculationModel: { version: LEGACY_CALCULATION_MODEL_VERSION, appliedAt: '2026-08-06T00:00:00.000Z', appliedBy: 'migration' as const } }
    const snapshot = buildPlanSnapshot(legacy, 'ก่อนเปลี่ยนสูตร', 'beforeModelUpdate', new Date('2026-08-07T00:00:00.000Z'))
    expect(snapshot.reason).toBe('beforeModelUpdate')
    expect(snapshot.plan.calculationModel.version).toBe(LEGACY_CALCULATION_MODEL_VERSION)
  })
})
