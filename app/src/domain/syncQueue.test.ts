import { beforeEach, describe, expect, it } from 'vitest'
import { releaseFlags } from '../config/releaseFlags'
import type { RemoteDataUseDecision } from './privacyLifecycle'
import type { RemoteAuthorizationDecision } from './remoteSecurity'
import { applySyncReceipt, createSyncQueueItem, markSyncAttemptStarted, planSyncAttempt, recordTransientSyncFailure, type SyncQueueItem } from './syncQueue'
import { createSyncEnvelope, generateSyncEncryptionKey, type EncryptedSyncEnvelope } from './syncEnvelope'

const enabled = { ...releaseFlags, account: true, cloudSync: true }
const now = '2026-08-07T08:00:00.000Z'
const authorization: RemoteAuthorizationDecision = { allowed: true, action: 'editPlan', capability: 'cloudSync', subjectId: 'user-owner', resourceHouseholdId: 'household-001', reason: 'allowed' }
const dataUse: RemoteDataUseDecision = { allowed: true, reason: 'allowed', capability: 'cloudSync' }
let envelope: EncryptedSyncEnvelope

beforeEach(async () => {
  const key = await generateSyncEncryptionKey()
  const result = await createSyncEnvelope({ mutationId: 'mutation-001', planId: 'primary-plan', householdId: 'household-001', deviceId: 'device-001', keyId: 'key-gen-001', baseRevision: 4, localRevision: 5, baseDigest: 'a'.repeat(64), sectionIds: ['projection'], createdAt: now, expiresAt: '2026-08-08T08:00:00.000Z', plaintext: '{"projection":true}' }, key)
  if (!result.ok) throw new Error(result.reason)
  envelope = result.envelope
})

function queued() {
  const result = createSyncQueueItem(envelope, authorization, dataUse, enabled)
  if (!result.ok) throw new Error(result.reason)
  return result.item
}

function context(overrides = {}) {
  return { now, online: true, deviceStatus: 'active' as const, authorization, dataUse, remoteHead: { planId: envelope.planId, revision: envelope.baseRevision, digest: envelope.baseDigest }, ...overrides }
}

describe('offline encrypted sync queue', () => {
  it('cannot enqueue or plan a request while the real cloud-sync flag is off', () => {
    expect(createSyncQueueItem(envelope, authorization, dataUse)).toEqual({ ok: false, reason: 'cloud-sync-disabled' })
    expect(planSyncAttempt(queued(), context())).toEqual({ kind: 'blocked', reason: 'cloud-sync-disabled' })
  })

  it('requires exact edit authorization and cloud-sync consent', () => {
    expect(createSyncQueueItem(envelope, { ...authorization, resourceHouseholdId: 'other-household' }, dataUse, enabled)).toEqual({ ok: false, reason: 'authorization-required' })
    expect(createSyncQueueItem(envelope, authorization, { allowed: false, reason: 'consent-revoked', capability: 'cloudSync' }, enabled)).toEqual({ ok: false, reason: 'consent-required' })
  })

  it('waits offline, blocks revoked devices, and emits an idempotent push only from the common base', () => {
    const item = queued()
    expect(planSyncAttempt(item, context({ online: false }), enabled)).toEqual({ kind: 'waiting', reason: 'offline', retryAt: null })
    expect(planSyncAttempt(item, context({ deviceStatus: 'revoked' }), enabled)).toEqual({ kind: 'blocked', reason: 'device-revoked' })
    const ready = planSyncAttempt(item, context(), enabled)
    expect(ready).toMatchObject({ kind: 'ready', request: { idempotencyKey: item.id, expectedRemoteRevision: 4 } })
  })

  it('forces an explicit merge for concurrent remote changes', () => {
    const remoteHead = { planId: envelope.planId, revision: 6, digest: 'b'.repeat(64) }
    expect(planSyncAttempt(queued(), context({ remoteHead }), enabled)).toEqual({ kind: 'mergeRequired', remoteHead })
  })

  it('uses bounded exponential retry and then stops automatically', () => {
    let item = queued()
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      const plan = planSyncAttempt(item, context({ now: new Date(Date.parse(now) + attempt * 60 * 60 * 1_000).toISOString() }), enabled)
      expect(plan.kind).toBe('ready')
      item = markSyncAttemptStarted(item, plan, new Date(Date.parse(now) + attempt * 60 * 60 * 1_000).toISOString()) as SyncQueueItem
      item = recordTransientSyncFailure(item, 'network-timeout', new Date(Date.parse(now) + attempt * 60 * 60 * 1_000 + 1_000).toISOString()) as SyncQueueItem
    }
    expect(item).toMatchObject({ status: 'permanentFailure', attempts: 8, failureCode: 'network-timeout', nextAttemptAt: null })
  })

  it('accepts only a bound monotonic receipt and rejects replay substitution', () => {
    const item = queued()
    const plan = planSyncAttempt(item, context(), enabled)
    const inFlight = markSyncAttemptStarted(item, plan, now) as SyncQueueItem
    const receipt = { receiptId: 'receipt-001', mutationId: item.id, planId: envelope.planId, householdId: envelope.householdId, deviceId: envelope.deviceId, status: 'accepted' as const, acceptedRevision: 5, acceptedDigest: envelope.localDigest, receivedAt: '2026-08-07T08:00:01.000Z' }
    const acked = applySyncReceipt(inFlight, receipt)
    expect(acked).toMatchObject({ status: 'acked', receipt })
    expect(applySyncReceipt(inFlight, { ...receipt, deviceId: 'other-device' })).toBeNull()
    expect(applySyncReceipt(inFlight, { ...receipt, acceptedDigest: 'c'.repeat(64) })).toBeNull()
  })
})
