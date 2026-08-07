export const releaseFlags = Object.freeze({
  localPlanVault: true,
  localReports: true,
  localCopilot: true,
  calculationModelUpdates: true,
  account: false,
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

export const remoteCapabilities = ['account', 'cloudSync', 'householdCollaboration', 'advisorSharing', 'externalAnalytics', 'externalAi', 'liveMarketRetrieval', 'tradeExecution', 'paymentOrTransfer', 'taxFiling'] as const satisfies readonly ReleaseCapability[]
export const transactionCapabilities = ['tradeExecution', 'paymentOrTransfer', 'taxFiling'] as const satisfies readonly ReleaseCapability[]

export function enabledRemoteCapabilities(flags: Readonly<Record<ReleaseCapability, boolean>> = releaseFlags) {
  return remoteCapabilities.filter((capability) => flags[capability])
}
