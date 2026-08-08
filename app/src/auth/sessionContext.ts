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

/**
 * True only while `ClerkProvider` is actually mounted.
 *
 * The provider lives in a lazily loaded chunk so the marketing page does not
 * pay for the auth SDK. During that load the Suspense fallback still renders
 * the page, which means any Clerk component mounted in that window would throw
 * "can only be used within <ClerkProvider />". Components that render Clerk
 * children must gate on this rather than on `authConfigured`, which is true
 * from the first paint.
 */
export const ClerkReadyContext = createContext(false)

export function useClerkReady() {
  return useContext(ClerkReadyContext)
}
