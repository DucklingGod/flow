import { hasEntitlement, type EntitlementKey } from '../domain/entitlements'
import { useFlowSession } from './sessionContext'

/**
 * True when the current tier grants `key`.
 *
 * When gating is inactive — no billing provider configured — everything is
 * available; there is nothing to sell and nothing to protect.
 *
 * This is a presentation control, not an access control. Anything that costs
 * money to serve must be re-checked server-side. See docs/MONETIZATION.md.
 */
export function useEntitlement(key: EntitlementKey) {
  const session = useFlowSession()
  return !session.gatingActive || hasEntitlement(session.tier, key)
}
