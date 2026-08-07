import { createContext, useContext } from 'react'
import { resolveSession, type FlowSession } from './session'

/**
 * Absent publishable key = no identity provider = local-only build. The app
 * stays fully usable and ungated, which keeps the offline promise intact and
 * lets the existing browser test suite run without any auth infrastructure.
 */
const publishableKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined)?.trim() ?? ''
export const authConfigured = publishableKey.length > 0
export const clerkPublishableKey = publishableKey

export const SessionContext = createContext<FlowSession>(
  resolveSession({ configured: false, loaded: false, signedIn: false }),
)

export function useFlowSession() {
  return useContext(SessionContext)
}
