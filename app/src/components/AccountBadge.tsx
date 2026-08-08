import { LogIn, Sparkles } from 'lucide-react'
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import { authConfigured, useClerkReady, useFlowSession } from '../auth/sessionContext'
import { planFor, upgradeTargetsFrom } from '../domain/entitlements'

/**
 * Sidebar account strip. Renders nothing when no identity provider is
 * configured, so a local-only build keeps its original chrome exactly.
 */
export function AccountBadge() {
  const session = useFlowSession()
  const clerkReady = useClerkReady()
  // Waits for ClerkProvider: SignedIn/SignedOut/UserButton throw without it.
  if (!authConfigured || !clerkReady) return null

  const plan = planFor(session.tier)
  const canUpgrade = upgradeTargetsFrom(session.tier).length > 0

  return (
    <div className="account-badge">
      <SignedIn>
        <div className="account-identity">
          <UserButton afterSignOutUrl="/" />
          <div>
            <strong>{session.displayName ?? 'บัญชีของคุณ'}</strong>
            <small>{plan.name}</small>
          </div>
        </div>
        {canUpgrade && <a className="account-upgrade" href="/pricing"><Sparkles />อัปเกรดแพ็กเกจ</a>}
      </SignedIn>
      <SignedOut>
        <a className="account-signin" href="/sign-in"><LogIn />เข้าสู่ระบบเพื่อซิงก์</a>
      </SignedOut>
    </div>
  )
}
