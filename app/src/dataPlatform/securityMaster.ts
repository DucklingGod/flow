import { SecurityIdentitySchema, type SecurityIdentity } from './contracts'

const normalize = (value: string | null | undefined) => value?.trim().replace(/\s+/g, '').toUpperCase() ?? null
const same = (left: string | null | undefined, right: string | null | undefined) => normalize(left) === normalize(right)

export type IdentityResolution =
  | { status: 'matched'; match: SecurityIdentity; conflicts: [] }
  | { status: 'unmatched'; match: null; conflicts: [] }
  | { status: 'ambiguous'; match: null; conflicts: string[] }
  | { status: 'conflict'; match: SecurityIdentity; conflicts: string[] }

function candidatesFor(candidate: SecurityIdentity, master: SecurityIdentity[]) {
  if (candidate.isin) return master.filter((item) => item.isin && same(item.isin, candidate.isin))
  if (candidate.thaiFundCode) {
    return master.filter((item) => item.thaiFundCode && same(item.thaiFundCode, candidate.thaiFundCode) && same(item.shareClass, candidate.shareClass))
  }
  if (candidate.ticker && candidate.exchange) {
    return master.filter((item) => item.ticker && item.exchange && same(item.ticker, candidate.ticker) && same(item.exchange, candidate.exchange) && same(item.shareClass, candidate.shareClass))
  }
  return []
}

function identityConflicts(candidate: SecurityIdentity, match: SecurityIdentity) {
  const conflicts: string[] = []
  if (!same(candidate.currency, match.currency)) conflicts.push('currency')
  if (candidate.shareClass && match.shareClass && !same(candidate.shareClass, match.shareClass)) conflicts.push('shareClass')
  if (candidate.distributionMode !== 'unknown' && match.distributionMode !== 'unknown' && candidate.distributionMode !== match.distributionMode) conflicts.push('distributionMode')
  if (candidate.fxHedgedPercent !== null && match.fxHedgedPercent !== null && Math.abs(candidate.fxHedgedPercent - match.fxHedgedPercent) > 0.01) conflicts.push('fxHedgedPercent')
  return conflicts
}

export function resolveSecurityIdentity(candidateInput: SecurityIdentity, masterInput: SecurityIdentity[]): IdentityResolution {
  const candidate = SecurityIdentitySchema.parse(candidateInput)
  const master = masterInput.map((item) => SecurityIdentitySchema.parse(item))
  const candidates = candidatesFor(candidate, master)
  if (candidates.length === 0) return { status: 'unmatched', match: null, conflicts: [] }
  if (candidates.length > 1) return { status: 'ambiguous', match: null, conflicts: candidates.map((item) => item.id) }
  const match = candidates[0]
  const conflicts = identityConflicts(candidate, match)
  return conflicts.length > 0 ? { status: 'conflict', match, conflicts } : { status: 'matched', match, conflicts: [] }
}

export function normalizedSecurityKey(identity: SecurityIdentity) {
  if (identity.isin) return `isin:${normalize(identity.isin)}`
  if (identity.thaiFundCode) return `thfund:${normalize(identity.thaiFundCode)}:${normalize(identity.shareClass) ?? '-'}`
  if (identity.ticker && identity.exchange) return `ticker:${normalize(identity.exchange)}:${normalize(identity.ticker)}:${normalize(identity.shareClass) ?? '-'}`
  return `local:${identity.id}`
}
