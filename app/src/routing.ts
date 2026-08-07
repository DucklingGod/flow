export type Surface = 'app' | 'landing' | 'signIn' | 'signUp'

/**
 * Top-level surface routing.
 *
 * The planner keeps its existing hash routes untouched — `/#/studio`,
 * `/#/vault`, and friends still resolve to the app exactly as before, which is
 * what every accessibility and end-to-end script already navigates to. The
 * marketing site occupies the bare paths that previously fell through to the
 * planner's default view.
 */
export function resolveSurface(pathname: string, hash: string): Surface {
  if (pathname.startsWith('/sign-in')) return 'signIn'
  if (pathname.startsWith('/sign-up')) return 'signUp'
  if (pathname.startsWith('/app')) return 'app'
  // Only the planner's `#/route` form means "app". A bare fragment such as
  // `#pricing` is a marketing anchor and must stay on the landing page.
  if (pathname === '/' || pathname === '') return hash.startsWith('#/') ? 'app' : 'landing'
  // /pricing and any other marketing path render the landing page; deep links
  // to its sections are handled by the fragment once it mounts.
  return 'landing'
}
