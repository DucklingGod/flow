import { useMemo, type ReactNode } from 'react'
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-react'
import { orderedPlans } from '../domain/entitlements'
import { resolveSession } from './session'
import { clerkPublishableKey, SessionContext } from './sessionContext'
import { clerkAppearance } from './clerkAppearance'

/**
 * Reads Clerk and projects it onto `FlowSession`. Only ever rendered inside
 * `ClerkProvider`, because Clerk's hooks throw outside it.
 */
function ClerkSessionBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, has } = useAuth()
  const { user } = useUser()

  const session = useMemo(() => {
    // Probe the billing provider highest-tier-first so the most generous active
    // plan wins. `has` is optional across Clerk versions and billing setups, so
    // a missing or throwing implementation degrades to plan metadata instead of
    // breaking sign-in entirely.
    let planClaim: unknown = user?.publicMetadata?.plan ?? user?.publicMetadata?.tier ?? null
    if (typeof has === 'function') {
      for (const plan of [...orderedPlans].reverse()) {
        if (plan.monthlyThb <= 0) continue
        try {
          if (has({ plan: plan.billingPlanId })) { planClaim = plan.billingPlanId; break }
        } catch { /* fall back to plan metadata below */ }
      }
    }
    return resolveSession({
      configured: true,
      loaded: isLoaded,
      signedIn: Boolean(isSignedIn),
      userId: user?.id,
      displayName: user?.fullName ?? user?.firstName ?? user?.username,
      email: user?.primaryEmailAddress?.emailAddress,
      avatarUrl: user?.imageUrl,
      planClaim,
    })
  }, [isLoaded, isSignedIn, has, user])

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export default function ClerkGate({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} appearance={clerkAppearance} afterSignOutUrl="/">
      <ClerkSessionBridge>{children}</ClerkSessionBridge>
    </ClerkProvider>
  )
}
