import { describe, expect, it } from 'vitest'
import { enabledRemoteCapabilities, releaseFlags } from './releaseFlags'

describe('production capability flags', () => {
  it('keeps every remote or transactional capability disabled in the alpha', () => {
    expect(enabledRemoteCapabilities()).toEqual([])
    expect(releaseFlags.localPlanVault).toBe(true)
    expect(releaseFlags.localReports).toBe(true)
    expect(releaseFlags.calculationModelUpdates).toBe(true)
    expect(releaseFlags.externalAnalytics).toBe(false)
  })

  it('detects an accidentally enabled remote capability', () => {
    expect(enabledRemoteCapabilities({ ...releaseFlags, cloudSync: true })).toEqual(['cloudSync'])
    expect(enabledRemoteCapabilities({ ...releaseFlags, externalAnalytics: true })).toEqual(['externalAnalytics'])
  })
})
