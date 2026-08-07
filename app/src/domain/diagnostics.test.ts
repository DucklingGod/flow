import { describe, expect, it } from 'vitest'
import { createSafeDiagnostic } from './diagnostics'

describe('privacy-safe diagnostics', () => {
  it('records only an error class and allowlisted route', () => {
    const event = createSafeDiagnostic(new TypeError('balance 999999 password=secret'), '#/vault', new Date('2026-08-07T00:00:00.000Z'))
    expect(event.errorType).toBe('TypeError')
    expect(event.route).toBe('vault')
    expect(event.at).toBe('2026-08-07T00:00:00.000Z')
    expect(JSON.stringify(event)).not.toContain('999999')
    expect(JSON.stringify(event)).not.toContain('secret')
    expect(event.containsUserData).toBe(false)
  })

  it('rejects unknown routes and unsafe error-type labels', () => {
    class UnsafeError extends Error { override name = '<script>' }
    const event = createSafeDiagnostic(new UnsafeError('private'), '#/not-real?account=123')
    expect(event.errorType).toBe('UnknownError')
    expect(event.route).toBe('unknown')
  })
})
