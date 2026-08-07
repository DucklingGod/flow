import { lazy, Suspense, useEffect, useState } from 'react'
import { FlowAuthProvider } from './auth/FlowAuthProvider'
import { resolveSurface, type Surface } from './routing'

// The planner and the marketing site are disjoint bundles: a visitor landing on
// the marketing page should not download the planner, and vice versa.
const App = lazy(() => import('./App'))
const LandingPage = lazy(() => import('./marketing/LandingPage').then((module) => ({ default: module.LandingPage })))
const SignInPage = lazy(() => import('./marketing/AuthPage').then((module) => ({ default: module.SignInPage })))
const SignUpPage = lazy(() => import('./marketing/AuthPage').then((module) => ({ default: module.SignUpPage })))

function currentSurface(): Surface {
  return resolveSurface(window.location.pathname, window.location.hash)
}

export function Root() {
  const [surface, setSurface] = useState<Surface>(currentSurface)

  useEffect(() => {
    const sync = () => setSurface(currentSurface())
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [])

  return (
    <FlowAuthProvider>
      <Suspense fallback={<div className="marketing-loading" role="status">กำลังโหลด…</div>}>
        {surface === 'app' && <App />}
        {surface === 'landing' && <LandingPage />}
        {surface === 'signIn' && <SignInPage />}
        {surface === 'signUp' && <SignUpPage />}
      </Suspense>
    </FlowAuthProvider>
  )
}
