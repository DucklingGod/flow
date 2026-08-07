import { describe, expect, it } from 'vitest'
import { calculateProjection } from './finance/projection'
import { defaultPlan, migratePlan } from './schema'
import {
  applyCurrentCalculationModel,
  CURRENT_CALCULATION_MODEL_VERSION,
  getCalculationModel,
  hasCalculationModelUpdate,
  LEGACY_CALCULATION_MODEL_VERSION,
} from './calculationModels'

describe('calculation model governance', () => {
  it('keeps a migrated plan on its prior model until the user adopts an update', () => {
    const v9 = { ...defaultPlan, version: 9 } as Record<string, unknown>
    delete v9.calculationModel
    const migrated = migratePlan(v9)

    expect(migrated.calculationModel.version).toBe(LEGACY_CALCULATION_MODEL_VERSION)
    expect(hasCalculationModelUpdate(migrated)).toBe(true)
    expect(calculateProjection(migrated).modelVersion).toBe(LEGACY_CALCULATION_MODEL_VERSION)
  })

  it('applies the current model only through an explicit user action', () => {
    const legacy = {
      ...defaultPlan,
      calculationModel: { version: LEGACY_CALCULATION_MODEL_VERSION, appliedAt: '2026-08-06T00:00:00.000Z', appliedBy: 'migration' as const },
    }
    const updated = applyCurrentCalculationModel(legacy, new Date('2026-08-07T12:00:00.000Z'))

    expect(updated.calculationModel).toEqual({ version: CURRENT_CALCULATION_MODEL_VERSION, appliedAt: '2026-08-07T12:00:00.000Z', appliedBy: 'user' })
    expect(updated.updatedAt).toBe('2026-08-07T12:00:00.000Z')
    expect(hasCalculationModelUpdate(updated)).toBe(false)
    expect(calculateProjection(updated).modelVersion).toBe(CURRENT_CALCULATION_MODEL_VERSION)
  })

  it('publishes auditable release metadata for the update notice', () => {
    const release = getCalculationModel(CURRENT_CALCULATION_MODEL_VERSION)
    expect(release.changes.length).toBeGreaterThan(1)
    expect(release.affectedOutputs).toContain('Goal Projection')
    expect(release.conventions.rounding).toBe('display-only')
  })
})
