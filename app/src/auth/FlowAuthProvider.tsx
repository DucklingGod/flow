import { lazy, Suspense, type ReactNode } from 'react'
import { resolveSession } from './session'
import { authConfigured, SessionContext } from './sessionContext'

// Clerk is ~90 kB of the bundle and is not needed to paint the marketing page.
// Loading it in its own chunk lets the landing page render immediately; the
// session simply reports `loading` until the SDK arrives, which is the same
// state it would occupy while Clerk initialises anyway.
const ClerkGate = lazy(() => import('./ClerkGate'))

const loadingSession = resolveSession({ configured: true, loaded: false, signedIn: false })

export function FlowAuthProvider({ children }: { children: ReactNode }) {
  if (!authConfigured) return <>{children}</>
  return (
    <Suspense fallback={<SessionContext.Provider value={loadingSession}>{children}</SessionContext.Provider>}>
      <ClerkGate>{children}</ClerkGate>
    </Suspense>
  )
}
