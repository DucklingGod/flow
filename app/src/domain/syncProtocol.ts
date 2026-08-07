import { releaseFlags, type ReleaseCapability } from '../config/releaseFlags'

export interface SyncHead {
  planId: string
  revision: number
  digest: string
}

export interface SyncReconciliationRequest {
  base: SyncHead
  local: SyncHead
  remote: SyncHead
}

export type SyncDecision =
  | { kind: 'blocked'; reason: 'cloud-sync-disabled' | 'invalid-head' | 'plan-mismatch' | 'revision-rollback' }
  | { kind: 'noChange'; reason: 'content-equal' }
  | { kind: 'pushLocal'; expectedRemoteRevision: number }
  | { kind: 'pullRemote'; expectedLocalRevision: number }
  | { kind: 'mergeRequired'; baseRevision: number; localRevision: number; remoteRevision: number }

const validToken = (value: string) => value.length > 0 && value.length <= 128 && /^[a-zA-Z0-9._:-]+$/.test(value)

function validHead(head: SyncHead) {
  return validToken(head.planId) && validToken(head.digest) && Number.isSafeInteger(head.revision) && head.revision >= 0
}

export function reconcileSyncHeads(
  request: SyncReconciliationRequest,
  flags: Readonly<Record<ReleaseCapability, boolean>> = releaseFlags,
): SyncDecision {
  if (!flags.cloudSync) return { kind: 'blocked', reason: 'cloud-sync-disabled' }
  const { base, local, remote } = request
  if (![base, local, remote].every(validHead)) return { kind: 'blocked', reason: 'invalid-head' }
  if (base.planId !== local.planId || base.planId !== remote.planId) return { kind: 'blocked', reason: 'plan-mismatch' }
  if (local.revision < base.revision || remote.revision < base.revision) return { kind: 'blocked', reason: 'revision-rollback' }
  if (local.digest === remote.digest) return { kind: 'noChange', reason: 'content-equal' }
  if (local.revision === base.revision && local.digest === base.digest && remote.revision > base.revision) {
    return { kind: 'pullRemote', expectedLocalRevision: local.revision }
  }
  if (remote.revision === base.revision && remote.digest === base.digest && local.revision > base.revision) {
    return { kind: 'pushLocal', expectedRemoteRevision: remote.revision }
  }
  return { kind: 'mergeRequired', baseRevision: base.revision, localRevision: local.revision, remoteRevision: remote.revision }
}

export interface SyncMutation {
  mutationId: string
  planId: string
  baseRevision: number
  createdAt: string
  sectionIds: readonly string[]
}

export function validateOfflineMutation(mutation: SyncMutation, allowedSectionIds: ReadonlySet<string>) {
  if (!validToken(mutation.mutationId) || !validToken(mutation.planId)) return false
  if (!Number.isSafeInteger(mutation.baseRevision) || mutation.baseRevision < 0 || !Number.isFinite(Date.parse(mutation.createdAt))) return false
  if (mutation.sectionIds.length === 0 || mutation.sectionIds.length > allowedSectionIds.size) return false
  return new Set(mutation.sectionIds).size === mutation.sectionIds.length && mutation.sectionIds.every((section) => allowedSectionIds.has(section))
}
