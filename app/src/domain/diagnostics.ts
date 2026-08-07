export interface SafeDiagnostic {
  id: string
  at: string
  category: 'render-boundary'
  errorType: string
  route: string
  containsUserData: false
}

const safeRoutes = new Set(['studio', 'wealth', 'life', 'portfolio', 'scenario', 'retirement', 'protection', 'tax', 'legacy', 'data', 'reviews', 'vault', 'more'])

export function createSafeDiagnostic(error: unknown, hash: string, now = new Date()): SafeDiagnostic {
  const candidate = error instanceof Error ? error.name : typeof error
  const errorType = /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/.test(candidate) ? candidate : 'UnknownError'
  const routeCandidate = hash.replace(/^#\/?/, '').split(/[?&]/)[0]
  return {
    id: crypto.randomUUID(),
    at: now.toISOString(),
    category: 'render-boundary',
    errorType,
    route: safeRoutes.has(routeCandidate) ? routeCandidate : 'unknown',
    containsUserData: false,
  }
}
