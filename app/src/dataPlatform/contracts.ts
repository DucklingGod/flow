import '../domain/zodRuntime'
import { z } from 'zod'

export const DataKindSchema = z.enum([
  'nav',
  'price',
  'fx',
  'dividend',
  'benchmark',
  'factsheet',
  'fee',
  'depositRate',
  'taxRule',
])

export const LicensingStatusSchema = z.enum(['open', 'userAuthorized', 'restricted', 'unknown'])
export const ConfidenceSchema = z.enum(['official', 'verified', 'userProvided', 'estimate'])
export const ValidationStatusSchema = z.enum(['valid', 'invalid', 'quarantined'])
export const DistributionModeSchema = z.enum(['accumulating', 'distributing', 'mixed', 'unknown'])
export const ProviderAuthModeSchema = z.enum(['none', 'sessionKey', 'backend'])

const optionalIdentifier = z.string().trim().min(1).max(120).nullable()
const isoInstant = z.string().datetime({ offset: true })
const sourceDate = z.string().min(10).max(35).refine((value) => Number.isFinite(Date.parse(value)), 'invalid-source-date')

export const SecurityIdentitySchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(200),
  ticker: optionalIdentifier,
  exchange: optionalIdentifier,
  isin: optionalIdentifier,
  thaiFundCode: optionalIdentifier,
  shareClass: optionalIdentifier,
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  distributionMode: DistributionModeSchema,
  fxHedgedPercent: z.number().min(0).max(100).nullable(),
  aliases: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  updatedAt: isoInstant,
})

export const DataObservationSchema = z.object({
  id: z.string().trim().min(1).max(240),
  kind: DataKindSchema,
  identityId: z.string().trim().min(1).max(120).nullable(),
  field: z.string().trim().min(1).max(120),
  numericValue: z.number().finite().nullable(),
  textValue: z.string().max(20_000).nullable(),
  unit: z.string().trim().min(1).max(40),
  currency: z.string().trim().length(3).nullable(),
  observedAt: isoInstant,
  fetchedAt: isoInstant,
  providerId: z.string().trim().min(1).max(100),
  sourceUrl: z.string().url().max(2_000),
  sourceAsOf: sourceDate,
  staleAfterHours: z.number().positive().max(24 * 366 * 20),
  licensingStatus: LicensingStatusSchema,
  licenseNotes: z.string().max(500),
  confidence: ConfidenceSchema,
  validationStatus: ValidationStatusSchema,
  checksum: z.string().trim().min(8).max(256),
}).superRefine((value, context) => {
  if (value.numericValue === null && value.textValue === null) {
    context.addIssue({ code: 'custom', path: ['numericValue'], message: 'observation-value-required' })
  }
  if (Date.parse(value.observedAt) > Date.parse(value.fetchedAt)) {
    context.addIssue({ code: 'custom', path: ['observedAt'], message: 'observed-after-fetched' })
  }
})

export const ProviderRunSchema = z.object({
  id: z.string().trim().min(1).max(160),
  providerId: z.string().trim().min(1).max(100),
  startedAt: isoInstant,
  completedAt: isoInstant,
  status: z.enum(['success', 'partial', 'failed', 'authorizationRequired', 'rateLimited']),
  attemptCount: z.number().int().min(1).max(20),
  receivedCount: z.number().int().min(0),
  acceptedCount: z.number().int().min(0),
  quarantinedCount: z.number().int().min(0),
  errorCode: z.string().max(120).nullable(),
  message: z.string().max(500),
})

export const ProviderBatchSchema = z.object({
  providerId: z.string().trim().min(1).max(100),
  fetchedAt: isoInstant,
  securities: z.array(SecurityIdentitySchema).max(20_000),
  observations: z.array(DataObservationSchema).max(100_000),
  warnings: z.array(z.string().max(500)).max(100),
})

export type DataKind = z.infer<typeof DataKindSchema>
export type LicensingStatus = z.infer<typeof LicensingStatusSchema>
export type DataConfidence = z.infer<typeof ConfidenceSchema>
export type ValidationStatus = z.infer<typeof ValidationStatusSchema>
export type DistributionMode = z.infer<typeof DistributionModeSchema>
export type ProviderAuthMode = z.infer<typeof ProviderAuthModeSchema>
export type SecurityIdentity = z.infer<typeof SecurityIdentitySchema>
export type DataObservation = z.infer<typeof DataObservationSchema>
export type ProviderRun = z.infer<typeof ProviderRunSchema>
export type ProviderBatch = z.infer<typeof ProviderBatchSchema>

export interface ProviderDescriptor {
  id: string
  name: string
  kinds: DataKind[]
  authMode: ProviderAuthMode
  sourceUrl: string
  licensingStatus: LicensingStatus
  rateLimitPerHour: number | null
  scheduledIngestion: 'disabled' | 'backendOnly'
  notes: string
}

export interface ProviderRequest {
  kinds: DataKind[]
  identityIds?: string[]
  asOf?: string
  endpoint?: string
}

export interface RuntimeCredentials {
  apiKey?: string
}

export interface DataProviderAdapter {
  descriptor: ProviderDescriptor
  fetch(request: ProviderRequest, credentials?: RuntimeCredentials): Promise<ProviderBatch>
}
