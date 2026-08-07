import { releaseFlags, type ReleaseCapability } from '../config/releaseFlags'

export const remoteRoles = ['owner', 'householdEditor', 'householdViewer', 'advisorReadOnly'] as const
export type RemoteRole = typeof remoteRoles[number]

export const remoteActions = [
  'recoverAccount',
  'viewPlan',
  'editPlan',
  'exportPlan',
  'deleteCloudData',
  'manageMembers',
  'rotateCloudKeys',
  'createAdvisorShare',
  'revokeAdvisorShare',
] as const
export type RemoteAction = typeof remoteActions[number]

type RemoteCapability = Extract<ReleaseCapability, 'account' | 'cloudSync' | 'householdCollaboration' | 'advisorSharing'>

const capabilityForAction: Record<RemoteAction, RemoteCapability> = {
  recoverAccount: 'account',
  viewPlan: 'cloudSync',
  editPlan: 'cloudSync',
  exportPlan: 'cloudSync',
  deleteCloudData: 'cloudSync',
  manageMembers: 'householdCollaboration',
  rotateCloudKeys: 'cloudSync',
  createAdvisorShare: 'advisorSharing',
  revokeAdvisorShare: 'advisorSharing',
}

const permissions: Record<RemoteRole, readonly RemoteAction[]> = {
  owner: ['viewPlan', 'editPlan', 'exportPlan', 'deleteCloudData', 'manageMembers', 'rotateCloudKeys', 'createAdvisorShare', 'revokeAdvisorShare'],
  householdEditor: ['viewPlan', 'editPlan'],
  householdViewer: ['viewPlan'],
  advisorReadOnly: ['viewPlan'],
}

const highAssuranceActions = new Set<RemoteAction>([
  'exportPlan',
  'deleteCloudData',
  'manageMembers',
  'rotateCloudKeys',
  'createAdvisorShare',
  'revokeAdvisorShare',
])

const roleSet = new Set<string>(remoteRoles)
const actionSet = new Set<string>(remoteActions)

export interface RemoteSecurityContext {
  sessionKind: 'anonymous' | 'recovery' | 'authenticated' | string
  subjectId: string | null
  householdId: string | null
  membershipStatus: 'active' | 'invited' | 'revoked' | string
  role: RemoteRole | string | null
  mfaVerified: boolean
  recoveryFactorVerified: boolean
  authenticatedAt: string | null
}

export interface RemoteAuthorizationRequest {
  action: RemoteAction | string
  resourceHouseholdId: string | null
  context: RemoteSecurityContext
  now: string
}

export type RemoteAuthorizationReason =
  | 'allowed'
  | 'unknown-action'
  | 'capability-disabled'
  | 'recovery-session-required'
  | 'recovery-factor-required'
  | 'authenticated-session-required'
  | 'invalid-session-time'
  | 'session-expired'
  | 'active-membership-required'
  | 'unknown-role'
  | 'cross-household-access'
  | 'role-denied'
  | 'recent-mfa-required'

export interface RemoteAuthorizationDecision {
  allowed: boolean
  action: RemoteAction | null
  capability: RemoteCapability | null
  subjectId: string | null
  resourceHouseholdId: string | null
  reason: RemoteAuthorizationReason
}

const denied = (reason: RemoteAuthorizationReason, action: RemoteAction | null = null, capability: RemoteCapability | null = null): RemoteAuthorizationDecision => ({ allowed: false, action, capability, subjectId: null, resourceHouseholdId: null, reason })

function sessionAgeMinutes(authenticatedAt: string | null, now: string) {
  if (!authenticatedAt) return null
  const authenticated = Date.parse(authenticatedAt)
  const current = Date.parse(now)
  if (!Number.isFinite(authenticated) || !Number.isFinite(current)) return null
  const age = (current - authenticated) / 60_000
  return age >= -1 ? age : null
}

export function authorizeRemoteAction(
  request: RemoteAuthorizationRequest,
  flags: Readonly<Record<ReleaseCapability, boolean>> = releaseFlags,
): RemoteAuthorizationDecision {
  if (!actionSet.has(request.action)) return denied('unknown-action')
  const action = request.action as RemoteAction
  const capability = capabilityForAction[action]
  if (!flags[capability]) return denied('capability-disabled', action, capability)

  const { context } = request
  if (action === 'recoverAccount') {
    if (context.sessionKind !== 'recovery') return denied('recovery-session-required', action, capability)
    if (!context.recoveryFactorVerified || !context.subjectId) return denied('recovery-factor-required', action, capability)
    return { allowed: true, action, capability, subjectId: context.subjectId, resourceHouseholdId: null, reason: 'allowed' }
  }

  if (context.sessionKind !== 'authenticated' || !context.subjectId) return denied('authenticated-session-required', action, capability)
  const age = sessionAgeMinutes(context.authenticatedAt, request.now)
  if (age === null) return denied('invalid-session-time', action, capability)
  if (age > 12 * 60) return denied('session-expired', action, capability)
  if (context.membershipStatus !== 'active') return denied('active-membership-required', action, capability)
  if (!context.role || !roleSet.has(context.role)) return denied('unknown-role', action, capability)
  if (!context.householdId || !request.resourceHouseholdId || context.householdId !== request.resourceHouseholdId) return denied('cross-household-access', action, capability)
  const role = context.role as RemoteRole
  if ((role === 'householdEditor' || role === 'householdViewer') && !flags.householdCollaboration) return denied('capability-disabled', action, 'householdCollaboration')
  if (role === 'advisorReadOnly' && !flags.advisorSharing) return denied('capability-disabled', action, 'advisorSharing')
  if (!permissions[role].includes(action)) return denied('role-denied', action, capability)
  if (highAssuranceActions.has(action) && (!context.mfaVerified || age > 10)) return denied('recent-mfa-required', action, capability)
  return { allowed: true, action, capability, subjectId: context.subjectId, resourceHouseholdId: request.resourceHouseholdId, reason: 'allowed' }
}

export interface CloudKeyRecord {
  keyId: string
  generation: number
  status: 'active' | 'pending' | 'retired'
  createdAt: string
  retiredAt: string | null
}

export interface CloudKeyring {
  ownerSubjectId: string
  activeKeyId: string
  keys: readonly CloudKeyRecord[]
  recoveryEnvelopeConfigured: boolean
}

export type CloudKeyTransitionResult =
  | { ok: false; reason: 'authorization-required' | 'invalid-key-id' | 'invalid-keyring' | 'key-id-reused' | 'recovery-envelope-required' | 'rotation-already-pending' }
  | { ok: true; keyring: CloudKeyring; requiredSteps: readonly ['generate-client-key', 'rewrap-plan-keys', 'verify-all-envelopes', 'retire-previous-key'] }

function validKeyId(value: string) {
  return value.length >= 8 && value.length <= 128 && /^[a-zA-Z0-9._-]+$/.test(value)
}

export function planCloudKeyRotation(
  keyring: CloudKeyring,
  newKeyId: string,
  now: string,
  authorization: RemoteAuthorizationDecision,
  mode: 'scheduled' | 'recovery',
): CloudKeyTransitionResult {
  const expectedAction: RemoteAction = mode === 'recovery' ? 'recoverAccount' : 'rotateCloudKeys'
  if (!authorization.allowed || authorization.action !== expectedAction || authorization.subjectId !== keyring.ownerSubjectId) return { ok: false, reason: 'authorization-required' }
  if (!validKeyId(newKeyId) || !Number.isFinite(Date.parse(now))) return { ok: false, reason: 'invalid-key-id' }
  const activeKeys = keyring.keys.filter((key) => key.status === 'active')
  if (activeKeys.length !== 1 || activeKeys[0].keyId !== keyring.activeKeyId) return { ok: false, reason: 'invalid-keyring' }
  if (keyring.keys.some((key) => key.status === 'pending')) return { ok: false, reason: 'rotation-already-pending' }
  if (keyring.keys.some((key) => key.keyId === newKeyId)) return { ok: false, reason: 'key-id-reused' }
  if (mode === 'recovery' && !keyring.recoveryEnvelopeConfigured) return { ok: false, reason: 'recovery-envelope-required' }

  const nextGeneration = Math.max(0, ...keyring.keys.map((key) => key.generation)) + 1
  const keys = keyring.keys.map((key) => key.keyId === keyring.activeKeyId
    ? { ...key, status: 'pending' as const }
    : key)
  keys.push({ keyId: newKeyId, generation: nextGeneration, status: 'pending', createdAt: now, retiredAt: null })
  return {
    ok: true,
    keyring: { ...keyring, keys },
    requiredSteps: ['generate-client-key', 'rewrap-plan-keys', 'verify-all-envelopes', 'retire-previous-key'],
  }
}

export function completeCloudKeyRotation(
  keyring: CloudKeyring,
  newKeyId: string,
  now: string,
  rewrappedPlanCount: number,
  expectedPlanCount: number,
  authorization: RemoteAuthorizationDecision,
): CloudKeyring | null {
  if (!authorization.allowed || !authorization.subjectId || authorization.subjectId !== keyring.ownerSubjectId || (authorization.action !== 'rotateCloudKeys' && authorization.action !== 'recoverAccount')) return null
  if (!Number.isInteger(rewrappedPlanCount) || !Number.isInteger(expectedPlanCount) || expectedPlanCount < 0 || rewrappedPlanCount !== expectedPlanCount) return null
  if (!Number.isFinite(Date.parse(now)) || !keyring.keys.some((key) => key.keyId === newKeyId && key.status === 'pending')) return null
  const keys = keyring.keys.map((key): CloudKeyRecord => {
    if (key.keyId === newKeyId) return { ...key, status: 'active', retiredAt: null }
    if (key.keyId === keyring.activeKeyId) return { ...key, status: 'retired', retiredAt: now }
    return key
  })
  return { ...keyring, activeKeyId: newKeyId, keys }
}
