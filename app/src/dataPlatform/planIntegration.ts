import type { Holding, WealthPlan } from '../domain/schema'
import type { DataObservation } from './contracts'
import { classifyObservation } from './freshness'

export type MarketTargetField = keyof Pick<Holding, 'currentPrice' | 'fxToThb' | 'annualFee' | 'dividendYield'>

export function observationTargetField(observation: DataObservation): MarketTargetField | null {
  if (observation.kind === 'nav' || observation.kind === 'price') return 'currentPrice'
  if (observation.kind === 'fx') return 'fxToThb'
  const percentUnit = observation.unit.includes('%') || observation.unit.toLowerCase().includes('percent')
  if (observation.kind === 'fee' && percentUnit) return 'annualFee'
  if (observation.kind === 'dividend' && percentUnit && observation.field.toLowerCase().includes('yield')) return 'dividendYield'
  return null
}

export type PlanIntegrationResult =
  | { status: 'applied'; plan: WealthPlan; field: MarketTargetField; holdingSymbol: string }
  | { status: 'rejected'; plan: WealthPlan; reason: 'unsupported-field' | 'missing-value' | 'holding-not-found' | 'not-current' | 'currency-mismatch' }

export function applyObservationToPlan(plan: WealthPlan, observation: DataObservation, holdingId: string, now = new Date()): PlanIntegrationResult {
  const field = observationTargetField(observation)
  if (!field) return { status: 'rejected', plan, reason: 'unsupported-field' }
  if (observation.numericValue === null) return { status: 'rejected', plan, reason: 'missing-value' }
  const holding = plan.holdings.find((item) => item.id === holdingId)
  if (!holding) return { status: 'rejected', plan, reason: 'holding-not-found' }
  if (classifyObservation(observation, now).status !== 'current') return { status: 'rejected', plan, reason: 'not-current' }
  if (field === 'currentPrice' && observation.currency && observation.currency !== holding.currency) return { status: 'rejected', plan, reason: 'currency-mismatch' }

  const next: WealthPlan = {
    ...plan,
    holdings: plan.holdings.map((item) => item.id === holdingId ? {
      ...item,
      [field]: observation.numericValue,
      source: `${observation.kind} จาก ${observation.providerId}`,
      sourceProvider: observation.providerId,
      sourceUrl: observation.sourceUrl,
      sourceAsOf: observation.sourceAsOf,
      sourceFetchedAt: observation.fetchedAt,
      sourceStaleAfterHours: observation.staleAfterHours,
      sourceLicensingStatus: observation.licensingStatus,
      sourceConfidence: observation.confidence,
      sourceValidationStatus: observation.validationStatus,
    } : item),
    investmentPolicy: { ...plan.investmentPolicy, approvalStatus: 'draft', approvedAt: null },
  }
  return { status: 'applied', plan: next, field, holdingSymbol: holding.symbol }
}
