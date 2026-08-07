import { describe, expect, it } from 'vitest'
import { resolveSurface } from './routing'

describe('surface routing', () => {
  it('keeps every existing planner hash route on the app', () => {
    const routes = ['studio', 'wealth', 'life', 'portfolio', 'scenario', 'retirement', 'protection', 'tax', 'legacy', 'data', 'reviews', 'vault', 'more']
    for (const route of routes) expect(resolveSurface('/', `#/${route}`)).toBe('app')
  })

  it('serves the landing page only at the bare root', () => {
    expect(resolveSurface('/', '')).toBe('landing')
    expect(resolveSurface('', '')).toBe('landing')
    expect(resolveSurface('/', '#')).toBe('landing')
  })

  it('keeps the landing page in place for its own section anchors', () => {
    // The landing nav links to #features/#studios/#pricing/#faq. Treating a
    // bare fragment as an app route would navigate the visitor into the
    // planner mid-scroll.
    for (const anchor of ['#features', '#studios', '#pricing', '#faq']) {
      expect(resolveSurface('/', anchor), anchor).toBe('landing')
    }
  })

  it('routes the auth paths and their Clerk sub-paths', () => {
    expect(resolveSurface('/sign-in', '')).toBe('signIn')
    expect(resolveSurface('/sign-in/factor-one', '')).toBe('signIn')
    expect(resolveSurface('/sign-up', '')).toBe('signUp')
    expect(resolveSurface('/sign-up/verify-email-address', '')).toBe('signUp')
  })

  it('routes an explicit /app path to the planner', () => {
    expect(resolveSurface('/app', '')).toBe('app')
    expect(resolveSurface('/app', '#/vault')).toBe('app')
  })

  it('falls back to the landing page for unknown marketing paths', () => {
    expect(resolveSurface('/pricing', '')).toBe('landing')
    expect(resolveSurface('/anything-else', '')).toBe('landing')
  })
})
