import { describe, expect, it } from 'vitest'
import {
  approvedRemoteCapabilities, enabledProhibitedCapabilities, enabledRemoteCapabilities,
  prohibitedCapabilities, releaseFlags, unapprovedRemoteCapabilities,
} from './releaseFlags'

describe('production capability flags', () => {
  it('keeps the local planner capabilities on', () => {
    expect(releaseFlags.localPlanVault).toBe(true)
    expect(releaseFlags.localReports).toBe(true)
    expect(releaseFlags.calculationModelUpdates).toBe(true)
  })

  it('enables exactly the commercially approved remote capabilities', () => {
    expect(enabledRemoteCapabilities()).toEqual([...approvedRemoteCapabilities])
    expect(unapprovedRemoteCapabilities()).toEqual([])
  })

  it('keeps cloud sync off until a transport and key-recovery design exist', () => {
    expect(releaseFlags.cloudSync).toBe(false)
    expect(releaseFlags.householdCollaboration).toBe(false)
    expect(releaseFlags.advisorSharing).toBe(false)
    expect(releaseFlags.externalAnalytics).toBe(false)
    expect(releaseFlags.externalAi).toBe(false)
    expect(releaseFlags.liveMarketRetrieval).toBe(false)
  })

  it('never permits a transactional capability', () => {
    expect(enabledProhibitedCapabilities()).toEqual([])
    for (const capability of prohibitedCapabilities) expect(releaseFlags[capability]).toBe(false)
  })

  it('detects an accidentally enabled remote capability', () => {
    expect(unapprovedRemoteCapabilities({ ...releaseFlags, cloudSync: true })).toEqual(['cloudSync'])
    expect(unapprovedRemoteCapabilities({ ...releaseFlags, externalAnalytics: true })).toEqual(['externalAnalytics'])
  })

  it('detects an accidentally enabled transactional capability', () => {
    expect(enabledProhibitedCapabilities({ ...releaseFlags, tradeExecution: true })).toEqual(['tradeExecution'])
    expect(enabledProhibitedCapabilities({ ...releaseFlags, paymentOrTransfer: true })).toEqual(['paymentOrTransfer'])
  })

  it('does not treat an approved capability as a regression', () => {
    expect(unapprovedRemoteCapabilities({ ...releaseFlags, account: true, subscriptionBilling: true })).toEqual([])
  })
})
