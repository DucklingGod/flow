import { describe, expect, it } from 'vitest'
import { releaseFlags } from '../config/releaseFlags'
import { authorizeRemoteAction, completeCloudKeyRotation, planCloudKeyRotation, remoteActions, remoteRoles, type CloudKeyring, type RemoteSecurityContext } from './remoteSecurity'

const now = '2026-08-07T08:00:00.000Z'
const flags = { ...releaseFlags, account: true, cloudSync: true, householdCollaboration: true, advisorSharing: true }
const owner: RemoteSecurityContext = {
  sessionKind: 'authenticated', subjectId: 'user-owner', householdId: 'household-a', membershipStatus: 'active', role: 'owner',
  mfaVerified: true, recoveryFactorVerified: false, authenticatedAt: '2026-08-07T07:55:00.000Z',
}

describe('remote authorization contract', () => {
  it('denies every remote action under the actual alpha flags', () => {
    for (const action of remoteActions) {
      const decision = authorizeRemoteAction({ action, resourceHouseholdId: 'household-a', context: owner, now })
      expect(decision).toMatchObject({ allowed: false, reason: 'capability-disabled' })
    }
  })

  it('implements the documented role matrix without implicit permissions', () => {
    const expectations: Record<(typeof remoteRoles)[number], string[]> = {
      owner: ['viewPlan', 'editPlan', 'exportPlan', 'deleteCloudData', 'manageMembers', 'rotateCloudKeys', 'createAdvisorShare', 'revokeAdvisorShare'],
      householdEditor: ['viewPlan', 'editPlan'],
      householdViewer: ['viewPlan'],
      advisorReadOnly: ['viewPlan'],
    }
    for (const role of remoteRoles) {
      for (const action of remoteActions.filter((item) => item !== 'recoverAccount')) {
        const context = { ...owner, role }
        const decision = authorizeRemoteAction({ action, resourceHouseholdId: 'household-a', context, now }, flags)
        expect(decision.allowed, `${role}:${action}`).toBe(expectations[role].includes(action))
      }
    }
  })

  it('requires role-specific collaboration flags in addition to cloud sync', () => {
    const cloudOnly = { ...releaseFlags, account: true, cloudSync: true }
    const editor = authorizeRemoteAction({ action: 'viewPlan', resourceHouseholdId: 'household-a', context: { ...owner, role: 'householdEditor' }, now }, cloudOnly)
    const advisor = authorizeRemoteAction({ action: 'viewPlan', resourceHouseholdId: 'household-a', context: { ...owner, role: 'advisorReadOnly' }, now }, cloudOnly)
    expect(editor).toMatchObject({ allowed: false, capability: 'householdCollaboration', reason: 'capability-disabled' })
    expect(advisor).toMatchObject({ allowed: false, capability: 'advisorSharing', reason: 'capability-disabled' })
  })

  it('fails closed for unknown roles/actions, revoked membership, cross-household access, stale sessions, and missing MFA', () => {
    expect(authorizeRemoteAction({ action: 'adminEverything', resourceHouseholdId: 'household-a', context: owner, now }, flags).reason).toBe('unknown-action')
    expect(authorizeRemoteAction({ action: 'viewPlan', resourceHouseholdId: 'household-a', context: { ...owner, role: 'superAdmin' }, now }, flags).reason).toBe('unknown-role')
    expect(authorizeRemoteAction({ action: 'viewPlan', resourceHouseholdId: 'household-a', context: { ...owner, membershipStatus: 'revoked' }, now }, flags).reason).toBe('active-membership-required')
    expect(authorizeRemoteAction({ action: 'viewPlan', resourceHouseholdId: 'household-b', context: owner, now }, flags).reason).toBe('cross-household-access')
    expect(authorizeRemoteAction({ action: 'viewPlan', resourceHouseholdId: 'household-a', context: { ...owner, authenticatedAt: '2026-08-06T00:00:00.000Z' }, now }, flags).reason).toBe('session-expired')
    expect(authorizeRemoteAction({ action: 'exportPlan', resourceHouseholdId: 'household-a', context: { ...owner, mfaVerified: false }, now }, flags).reason).toBe('recent-mfa-required')
  })

  it('limits recovery sessions to verified account recovery only', () => {
    const recovery = { ...owner, sessionKind: 'recovery', role: null, householdId: null, membershipStatus: 'invited', mfaVerified: false, recoveryFactorVerified: true }
    expect(authorizeRemoteAction({ action: 'recoverAccount', resourceHouseholdId: null, context: recovery, now }, flags).allowed).toBe(true)
    expect(authorizeRemoteAction({ action: 'viewPlan', resourceHouseholdId: 'household-a', context: recovery, now }, flags).reason).toBe('authenticated-session-required')
    expect(authorizeRemoteAction({ action: 'recoverAccount', resourceHouseholdId: null, context: { ...recovery, recoveryFactorVerified: false }, now }, flags).reason).toBe('recovery-factor-required')
  })
})

describe('client-owned cloud key lifecycle contract', () => {
  const keyring: CloudKeyring = {
    ownerSubjectId: 'user-owner', activeKeyId: 'key-gen-1', recoveryEnvelopeConfigured: true,
    keys: [{ keyId: 'key-gen-1', generation: 1, status: 'active', createdAt: '2026-08-01T00:00:00.000Z', retiredAt: null }],
  }

  it('requires owner authorization and a unique opaque key identifier', () => {
    const authorized = authorizeRemoteAction({ action: 'rotateCloudKeys', resourceHouseholdId: 'household-a', context: owner, now }, flags)
    expect(planCloudKeyRotation(keyring, 'key-gen-1', now, authorized, 'scheduled')).toEqual({ ok: false, reason: 'key-id-reused' })
    expect(planCloudKeyRotation(keyring, '../secret', now, authorized, 'scheduled')).toEqual({ ok: false, reason: 'invalid-key-id' })
    const editor = authorizeRemoteAction({ action: 'rotateCloudKeys', resourceHouseholdId: 'household-a', context: { ...owner, role: 'householdEditor' }, now }, flags)
    expect(planCloudKeyRotation(keyring, 'key-gen-2', now, editor, 'scheduled')).toEqual({ ok: false, reason: 'authorization-required' })
    const otherOwner = authorizeRemoteAction({ action: 'rotateCloudKeys', resourceHouseholdId: 'household-b', context: { ...owner, subjectId: 'other-owner', householdId: 'household-b' }, now }, flags)
    expect(planCloudKeyRotation(keyring, 'key-gen-2', now, otherOwner, 'scheduled')).toEqual({ ok: false, reason: 'authorization-required' })
    expect(planCloudKeyRotation({ ...keyring, keys: keyring.keys.map((key) => ({ ...key, status: 'pending' as const })) }, 'key-gen-2', now, authorized, 'scheduled')).toEqual({ ok: false, reason: 'invalid-keyring' })
    expect(planCloudKeyRotation({ ...keyring, keys: [...keyring.keys, { keyId: 'key-pending', generation: 2, status: 'pending', createdAt: now, retiredAt: null }] }, 'key-gen-2', now, authorized, 'scheduled')).toEqual({ ok: false, reason: 'rotation-already-pending' })
  })

  it('does not activate or retire a key until every plan envelope is verified', () => {
    const authorized = authorizeRemoteAction({ action: 'rotateCloudKeys', resourceHouseholdId: 'household-a', context: owner, now }, flags)
    const planned = planCloudKeyRotation(keyring, 'key-gen-2', now, authorized, 'scheduled')
    expect(planned.ok).toBe(true)
    if (!planned.ok) return
    expect(planned.requiredSteps).toEqual(['generate-client-key', 'rewrap-plan-keys', 'verify-all-envelopes', 'retire-previous-key'])
    expect(completeCloudKeyRotation(planned.keyring, 'key-gen-2', now, 1, 2, authorized)).toBeNull()
    const editor = authorizeRemoteAction({ action: 'rotateCloudKeys', resourceHouseholdId: 'household-a', context: { ...owner, role: 'householdEditor' }, now }, flags)
    expect(completeCloudKeyRotation(planned.keyring, 'key-gen-2', now, 2, 2, editor)).toBeNull()
    const completed = completeCloudKeyRotation(planned.keyring, 'key-gen-2', now, 2, 2, authorized)
    expect(completed?.activeKeyId).toBe('key-gen-2')
    expect(completed?.keys.find((key) => key.keyId === 'key-gen-1')).toMatchObject({ status: 'retired', retiredAt: now })
  })

  it('blocks recovery rotation when no recovery envelope was configured', () => {
    const recoveryContext = { ...owner, sessionKind: 'recovery', role: null, householdId: null, recoveryFactorVerified: true }
    const authorized = authorizeRemoteAction({ action: 'recoverAccount', resourceHouseholdId: null, context: recoveryContext, now }, flags)
    expect(planCloudKeyRotation({ ...keyring, recoveryEnvelopeConfigured: false }, 'key-gen-2', now, authorized, 'recovery')).toEqual({ ok: false, reason: 'recovery-envelope-required' })
  })
})
