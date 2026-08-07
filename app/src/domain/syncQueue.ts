import { releaseFlags, type ReleaseCapability } from '../config/releaseFlags'
import type { RemoteDataUseDecision } from './privacyLifecycle'
import type { RemoteAuthorizationDecision } from './remoteSecurity'
import { reconcileSyncHeads, type SyncHead } from './syncProtocol'
import { validateSyncEnvelopeStructure, type EncryptedSyncEnvelope } from './syncEnvelope'

const tokenPattern = /^[a-zA-Z0-9._:-]+$/
const digestPattern = /^[a-f0-9]{64}$/
const maximumAttempts = 8

export type SyncQueueStatus = 'pending' | 'inFlight' | 'retrying' | 'conflict' | 'acked' | 'permanentFailure'

export interface SyncServerReceipt {
  receiptId: string
  mutationId: string
  planId: string
  householdId: string
  deviceId: string
  status: 'accepted' | 'duplicate' | 'conflict' | 'deviceRevoked' | 'rejected'
  acceptedRevision: number | null
  acceptedDigest: string | null
  receivedAt: string
}

export interface SyncQueueItem {
  id: string
  createdAt: string
  status: SyncQueueStatus
  attempts: number
  lastAttemptAt: string | null
  nextAttemptAt: string | null
  failureCode: string | null
  envelope: EncryptedSyncEnvelope
  receipt: SyncServerReceipt | null
}

export type CreateSyncQueueItemResult =
  | { ok: true; item: SyncQueueItem }
  | { ok: false; reason: 'cloud-sync-disabled' | 'invalid-envelope' | 'authorization-required' | 'consent-required' }

export interface SyncAttemptContext {
  now: string
  online: boolean
  deviceStatus: 'active' | 'revoked' | 'unknown'
  authorization: RemoteAuthorizationDecision
  dataUse: RemoteDataUseDecision
  remoteHead: SyncHead
}

export type SyncAttemptPlan =
  | { kind: 'blocked'; reason: 'cloud-sync-disabled' | 'invalid-item' | 'authorization-required' | 'consent-required' | 'device-revoked' | 'device-unknown' | 'expired' | 'terminal' }
  | { kind: 'waiting'; reason: 'offline' | 'backoff'; retryAt: string | null }
  | { kind: 'noChange'; remoteHead: SyncHead }
  | { kind: 'mergeRequired'; remoteHead: SyncHead }
  | { kind: 'ready'; request: { idempotencyKey: string; expectedRemoteRevision: number; envelope: EncryptedSyncEnvelope } }

const validToken = (value: string) => value.length > 0 && value.length <= 128 && tokenPattern.test(value)
const parsedTime = (value: string | null) => {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}

function authorizationMatches(envelope: EncryptedSyncEnvelope, authorization: RemoteAuthorizationDecision) {
  return authorization.allowed
    && authorization.action === 'editPlan'
    && authorization.subjectId !== null
    && authorization.resourceHouseholdId === envelope.householdId
}

function consentMatches(dataUse: RemoteDataUseDecision) {
  return dataUse.allowed && dataUse.capability === 'cloudSync'
}

export function validateSyncQueueItem(item: SyncQueueItem) {
  const common = item.id === item.envelope.mutationId
    && item.createdAt === item.envelope.createdAt
    && Number.isSafeInteger(item.attempts)
    && item.attempts >= 0
    && item.attempts <= maximumAttempts
    && parsedTime(item.createdAt) !== null
    && (item.lastAttemptAt === null || parsedTime(item.lastAttemptAt) !== null)
    && (item.nextAttemptAt === null || parsedTime(item.nextAttemptAt) !== null)
    && validateSyncEnvelopeStructure(item.envelope)
  if (!common) return false
  if (item.status === 'pending') return item.attempts === 0 && item.lastAttemptAt === null && item.nextAttemptAt === null && item.failureCode === null && item.receipt === null
  if (item.status === 'inFlight') return item.attempts >= 1 && item.lastAttemptAt !== null && item.nextAttemptAt === null && item.failureCode === null && item.receipt === null
  if (item.status === 'retrying') return item.attempts >= 1 && item.attempts < maximumAttempts && item.lastAttemptAt !== null && item.nextAttemptAt !== null && item.failureCode !== null && validToken(item.failureCode) && item.receipt === null
  if (item.status === 'acked') return item.attempts >= 1 && item.nextAttemptAt === null && item.failureCode === null && item.receipt !== null && receiptMatchesItem(item, item.receipt, ['accepted', 'duplicate'])
  if (item.status === 'conflict') return item.attempts >= 1 && item.nextAttemptAt === null && item.failureCode === 'remote-conflict' && item.receipt !== null && receiptMatchesItem(item, item.receipt, ['conflict'])
  return item.status === 'permanentFailure'
    && item.attempts >= 1
    && item.lastAttemptAt !== null
    && item.nextAttemptAt === null
    && item.failureCode !== null
    && validToken(item.failureCode)
    && (item.receipt === null || receiptMatchesItem(item, item.receipt, ['deviceRevoked', 'rejected']))
}

export function createSyncQueueItem(
  envelope: EncryptedSyncEnvelope,
  authorization: RemoteAuthorizationDecision,
  dataUse: RemoteDataUseDecision,
  flags: Readonly<Record<ReleaseCapability, boolean>> = releaseFlags,
): CreateSyncQueueItemResult {
  if (!flags.cloudSync) return { ok: false, reason: 'cloud-sync-disabled' }
  if (!validateSyncEnvelopeStructure(envelope)) return { ok: false, reason: 'invalid-envelope' }
  if (!authorizationMatches(envelope, authorization)) return { ok: false, reason: 'authorization-required' }
  if (!consentMatches(dataUse)) return { ok: false, reason: 'consent-required' }
  return {
    ok: true,
    item: {
      id: envelope.mutationId,
      createdAt: envelope.createdAt,
      status: 'pending',
      attempts: 0,
      lastAttemptAt: null,
      nextAttemptAt: null,
      failureCode: null,
      envelope,
      receipt: null,
    },
  }
}

export function planSyncAttempt(
  item: SyncQueueItem,
  context: SyncAttemptContext,
  flags: Readonly<Record<ReleaseCapability, boolean>> = releaseFlags,
): SyncAttemptPlan {
  if (!flags.cloudSync) return { kind: 'blocked', reason: 'cloud-sync-disabled' }
  if (!validateSyncQueueItem(item) || parsedTime(context.now) === null) return { kind: 'blocked', reason: 'invalid-item' }
  if (['acked', 'conflict', 'permanentFailure'].includes(item.status)) return { kind: 'blocked', reason: 'terminal' }
  if (!authorizationMatches(item.envelope, context.authorization)) return { kind: 'blocked', reason: 'authorization-required' }
  if (!consentMatches(context.dataUse)) return { kind: 'blocked', reason: 'consent-required' }
  if (context.deviceStatus === 'revoked') return { kind: 'blocked', reason: 'device-revoked' }
  if (context.deviceStatus !== 'active') return { kind: 'blocked', reason: 'device-unknown' }
  const now = parsedTime(context.now) as number
  if (now > (parsedTime(item.envelope.expiresAt) as number)) return { kind: 'blocked', reason: 'expired' }
  if (!context.online) return { kind: 'waiting', reason: 'offline', retryAt: item.nextAttemptAt }
  const retryAt = parsedTime(item.nextAttemptAt)
  if (retryAt !== null && now < retryAt) return { kind: 'waiting', reason: 'backoff', retryAt: item.nextAttemptAt }

  const base = { planId: item.envelope.planId, revision: item.envelope.baseRevision, digest: item.envelope.baseDigest }
  const local = { planId: item.envelope.planId, revision: item.envelope.localRevision, digest: item.envelope.localDigest }
  const decision = reconcileSyncHeads({ base, local, remote: context.remoteHead }, flags)
  if (decision.kind === 'pushLocal') return { kind: 'ready', request: { idempotencyKey: item.id, expectedRemoteRevision: decision.expectedRemoteRevision, envelope: item.envelope } }
  if (decision.kind === 'noChange') return { kind: 'noChange', remoteHead: context.remoteHead }
  if (decision.kind === 'mergeRequired' || decision.kind === 'pullRemote') return { kind: 'mergeRequired', remoteHead: context.remoteHead }
  return { kind: 'blocked', reason: 'invalid-item' }
}

export function markSyncAttemptStarted(item: SyncQueueItem, plan: SyncAttemptPlan, startedAt: string): SyncQueueItem | null {
  if (!validateSyncQueueItem(item) || plan.kind !== 'ready' || !['pending', 'retrying'].includes(item.status) || parsedTime(startedAt) === null || plan.request.idempotencyKey !== item.id) return null
  return { ...item, status: 'inFlight', attempts: item.attempts + 1, lastAttemptAt: startedAt, nextAttemptAt: null, failureCode: null }
}

export function recordTransientSyncFailure(item: SyncQueueItem, failureCode: string, failedAt: string): SyncQueueItem | null {
  if (!validateSyncQueueItem(item) || item.status !== 'inFlight' || !validToken(failureCode) || parsedTime(failedAt) === null || item.attempts < 1) return null
  if (item.attempts >= maximumAttempts) return { ...item, status: 'permanentFailure', nextAttemptAt: null, failureCode }
  const delay = Math.min(60 * 60 * 1_000, 5_000 * (2 ** (item.attempts - 1)))
  return { ...item, status: 'retrying', nextAttemptAt: new Date((parsedTime(failedAt) as number) + delay).toISOString(), failureCode }
}

function validReceipt(receipt: SyncServerReceipt) {
  return [receipt.receiptId, receipt.mutationId, receipt.planId, receipt.householdId, receipt.deviceId].every(validToken)
    && parsedTime(receipt.receivedAt) !== null
    && (receipt.acceptedRevision === null || (Number.isSafeInteger(receipt.acceptedRevision) && receipt.acceptedRevision >= 0))
    && (receipt.acceptedDigest === null || digestPattern.test(receipt.acceptedDigest))
}

function receiptMatchesItem(item: SyncQueueItem, receipt: SyncServerReceipt, allowedStatuses: readonly SyncServerReceipt['status'][]) {
  if (!validReceipt(receipt) || !allowedStatuses.includes(receipt.status) || item.lastAttemptAt === null) return false
  if (receipt.mutationId !== item.id || receipt.planId !== item.envelope.planId || receipt.householdId !== item.envelope.householdId || receipt.deviceId !== item.envelope.deviceId) return false
  if ((parsedTime(receipt.receivedAt) as number) < (parsedTime(item.lastAttemptAt) as number)) return false
  if (['accepted', 'duplicate'].includes(receipt.status)) return receipt.acceptedRevision !== null && receipt.acceptedRevision >= item.envelope.localRevision && receipt.acceptedDigest === item.envelope.localDigest
  return true
}

export function applySyncReceipt(item: SyncQueueItem, receipt: SyncServerReceipt): SyncQueueItem | null {
  if (!validateSyncQueueItem(item) || item.status !== 'inFlight' || !validReceipt(receipt)) return null
  if (item.receipt) return JSON.stringify(item.receipt) === JSON.stringify(receipt) ? item : null
  if (receipt.mutationId !== item.id || receipt.planId !== item.envelope.planId || receipt.householdId !== item.envelope.householdId || receipt.deviceId !== item.envelope.deviceId) return null
  const lastAttempt = parsedTime(item.lastAttemptAt) as number
  if ((parsedTime(receipt.receivedAt) as number) < lastAttempt) return null
  if (receipt.status === 'accepted' || receipt.status === 'duplicate') {
    if (receipt.acceptedRevision === null || receipt.acceptedRevision < item.envelope.localRevision || receipt.acceptedDigest !== item.envelope.localDigest) return null
    return { ...item, status: 'acked', nextAttemptAt: null, failureCode: null, receipt }
  }
  if (receipt.status === 'conflict') return { ...item, status: 'conflict', nextAttemptAt: null, failureCode: 'remote-conflict', receipt }
  return { ...item, status: 'permanentFailure', nextAttemptAt: null, failureCode: receipt.status === 'deviceRevoked' ? 'device-revoked' : 'server-rejected', receipt }
}
