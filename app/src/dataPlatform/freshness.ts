import { DataObservationSchema, type DataObservation } from './contracts'

export type FreshnessStatus = 'current' | 'stale' | 'missing' | 'invalid' | 'licenseBlocked'

export interface FreshnessResult {
  status: FreshnessStatus
  ageHours: number | null
  reason: string
}

export interface ObservationSelection {
  observation: DataObservation | null
  freshness: FreshnessResult
  usedLastKnownGood: boolean
}

const licenseAllowed = (observation: DataObservation) => observation.licensingStatus === 'open' || observation.licensingStatus === 'userAuthorized'

export function classifyObservation(input: unknown, now = new Date()): FreshnessResult {
  if (input === null || input === undefined) return { status: 'missing', ageHours: null, reason: 'no-observation' }
  const parsed = DataObservationSchema.safeParse(input)
  if (!parsed.success) return { status: 'invalid', ageHours: null, reason: 'contract-invalid' }
  const observation = parsed.data
  if (observation.validationStatus !== 'valid') return { status: 'invalid', ageHours: null, reason: observation.validationStatus }
  if (!licenseAllowed(observation)) return { status: 'licenseBlocked', ageHours: null, reason: observation.licensingStatus }
  const ageHours = Math.max(0, (now.getTime() - Date.parse(observation.observedAt)) / 3_600_000)
  if (ageHours > observation.staleAfterHours) return { status: 'stale', ageHours, reason: 'freshness-window-exceeded' }
  return { status: 'current', ageHours, reason: 'within-freshness-window' }
}

export function selectLastKnownGood(inputs: unknown[], now = new Date()): ObservationSelection {
  const parsed = inputs.flatMap((input) => {
    const result = DataObservationSchema.safeParse(input)
    return result.success ? [result.data] : []
  })
  const latestAny = parsed.toSorted((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt))[0]
  const valid = parsed
    .filter((item) => item.validationStatus === 'valid' && licenseAllowed(item))
    .toSorted((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt))
  const selected = valid[0]
  if (!selected) {
    const status = latestAny && !licenseAllowed(latestAny) ? 'licenseBlocked' : parsed.length > 0 ? 'invalid' : 'missing'
    return { observation: null, freshness: { status, ageHours: null, reason: status === 'missing' ? 'no-observation' : 'no-usable-observation' }, usedLastKnownGood: false }
  }
  return {
    observation: selected,
    freshness: classifyObservation(selected, now),
    usedLastKnownGood: Boolean(latestAny && latestAny.id !== selected.id),
  }
}

export function freshnessLabel(result: FreshnessResult, sourceAsOf?: string) {
  if (result.status === 'current' && sourceAsOf) return `ข้อมูล ณ ${sourceAsOf}`
  if (result.status === 'stale' && sourceAsOf) return `ข้อมูลเก่า · ณ ${sourceAsOf}`
  if (result.status === 'licenseBlocked') return 'ยังไม่มีสิทธิ์ใช้ข้อมูล'
  if (result.status === 'invalid') return 'ข้อมูลไม่ผ่านการตรวจสอบ'
  return 'ยังไม่มีข้อมูล'
}
