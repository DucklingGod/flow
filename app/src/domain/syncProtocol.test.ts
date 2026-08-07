import { describe, expect, it } from 'vitest'
import { releaseFlags } from '../config/releaseFlags'
import { planSectionIds } from './planConflict'
import { reconcileSyncHeads, validateOfflineMutation, type SyncHead } from './syncProtocol'

const enabled = { ...releaseFlags, cloudSync: true }
const head = (revision: number, digest: string, planId = 'primary-plan'): SyncHead => ({ planId, revision, digest })

describe('offline sync reconciliation contract', () => {
  it('stays unreachable while the production cloud-sync flag is off', () => {
    expect(reconcileSyncHeads({ base: head(1, 'digest-a'), local: head(2, 'digest-b'), remote: head(1, 'digest-a') })).toEqual({ kind: 'blocked', reason: 'cloud-sync-disabled' })
  })

  it('pushes or pulls only when exactly one side changed from the base', () => {
    expect(reconcileSyncHeads({ base: head(4, 'base'), local: head(5, 'local'), remote: head(4, 'base') }, enabled)).toEqual({ kind: 'pushLocal', expectedRemoteRevision: 4 })
    expect(reconcileSyncHeads({ base: head(4, 'base'), local: head(4, 'base'), remote: head(6, 'remote') }, enabled)).toEqual({ kind: 'pullRemote', expectedLocalRevision: 4 })
  })

  it('never silently resolves concurrent or ambiguous changes', () => {
    expect(reconcileSyncHeads({ base: head(4, 'base'), local: head(5, 'local'), remote: head(6, 'remote') }, enabled)).toEqual({ kind: 'mergeRequired', baseRevision: 4, localRevision: 5, remoteRevision: 6 })
    expect(reconcileSyncHeads({ base: head(4, 'base'), local: head(4, 'different-local'), remote: head(4, 'different-remote') }, enabled).kind).toBe('mergeRequired')
  })

  it('fails closed on plan substitution, rollback, invalid revisions, and malformed digests', () => {
    expect(reconcileSyncHeads({ base: head(4, 'base'), local: head(4, 'base'), remote: head(5, 'remote', 'other-plan') }, enabled)).toEqual({ kind: 'blocked', reason: 'plan-mismatch' })
    expect(reconcileSyncHeads({ base: head(4, 'base'), local: head(3, 'local'), remote: head(4, 'base') }, enabled)).toEqual({ kind: 'blocked', reason: 'revision-rollback' })
    expect(reconcileSyncHeads({ base: head(4, 'base'), local: head(Number.NaN, 'local'), remote: head(4, 'base') }, enabled)).toEqual({ kind: 'blocked', reason: 'invalid-head' })
    expect(reconcileSyncHeads({ base: head(4, 'base'), local: head(4, '<script>'), remote: head(4, 'base') }, enabled)).toEqual({ kind: 'blocked', reason: 'invalid-head' })
  })

  it('accepts a no-op only when both sides have identical content', () => {
    expect(reconcileSyncHeads({ base: head(4, 'base'), local: head(5, 'same'), remote: head(7, 'same') }, enabled)).toEqual({ kind: 'noChange', reason: 'content-equal' })
  })

  it('validates offline mutation journals against the explicit section allowlist', () => {
    const allowed = new Set<string>(planSectionIds)
    const valid = { mutationId: 'mutation-1', planId: 'primary-plan', baseRevision: 4, createdAt: '2026-08-07T08:00:00.000Z', sectionIds: ['projection', 'life'] }
    expect(validateOfflineMutation(valid, allowed)).toBe(true)
    expect(validateOfflineMutation({ ...valid, sectionIds: ['projection', 'projection'] }, allowed)).toBe(false)
    expect(validateOfflineMutation({ ...valid, sectionIds: ['projection', 'admin'] }, allowed)).toBe(false)
    expect(validateOfflineMutation({ ...valid, createdAt: 'not-a-date' }, allowed)).toBe(false)
  })
})
