export const releaseFlags = Object.freeze({
  localPlanVault: true,
  localReports: true,
  localCopilot: true,
  calculationModelUpdates: true,
  // Hosted identity via Clerk. Enabled with the commercial pivot; the planner
  // remains fully usable without an account.
  account: true,
  // Subscription entitlements. Gating is a client-side UX affordance only —
  // see docs/MONETIZATION.md for the server-side enforcement obligation.
  subscriptionBilling: true,
  // Still false: the envelope/queue client preflight exists but there is no
  // backend transport, no persisted key, and no device registry. Do not enable
  // this until a sync service and key-recovery design exist.
  cloudSync: false,
  householdCollaboration: false,
  advisorSharing: false,
  externalAnalytics: false,
  externalAi: false,
  liveMarketRetrieval: false,
  tradeExecution: false,
  paymentOrTransfer: false,
  taxFiling: false,
})

export type ReleaseCapability = keyof typeof releaseFlags

/** Capabilities that reach off-device. Enabling any requires named evidence. */
export const remoteCapabilities = ['account', 'subscriptionBilling', 'cloudSync', 'householdCollaboration', 'advisorSharing', 'externalAnalytics', 'externalAi', 'liveMarketRetrieval', 'tradeExecution', 'paymentOrTransfer', 'taxFiling'] as const satisfies readonly ReleaseCapability[]

/**
 * The permanent product boundary. These may never be true: Flow does not place
 * orders, move money, or file returns. `check:boundaries` fails the build if any
 * of them is flipped, and no gate approval unlocks them.
 */
export const prohibitedCapabilities = ['tradeExecution', 'paymentOrTransfer', 'taxFiling'] as const satisfies readonly ReleaseCapability[]

/** Deprecated alias retained so existing call sites keep compiling. */
export const transactionCapabilities = prohibitedCapabilities

/**
 * Remote capabilities intentionally enabled for the commercial release. Anything
 * reaching off-device that is NOT in this set is a regression.
 */
export const approvedRemoteCapabilities = ['account', 'subscriptionBilling'] as const satisfies readonly ReleaseCapability[]

export function enabledRemoteCapabilities(flags: Readonly<Record<ReleaseCapability, boolean>> = releaseFlags) {
  return remoteCapabilities.filter((capability) => flags[capability])
}

/** Enabled remote capabilities that were never approved for release. */
export function unapprovedRemoteCapabilities(flags: Readonly<Record<ReleaseCapability, boolean>> = releaseFlags) {
  return enabledRemoteCapabilities(flags).filter((capability) => !(approvedRemoteCapabilities as readonly ReleaseCapability[]).includes(capability))
}

/** Prohibited capabilities that have been switched on. Must always be empty. */
export function enabledProhibitedCapabilities(flags: Readonly<Record<ReleaseCapability, boolean>> = releaseFlags) {
  return prohibitedCapabilities.filter((capability) => flags[capability])
}
