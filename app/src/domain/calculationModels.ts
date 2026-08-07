import type { WealthPlan } from './schema'

export const CALCULATION_MODEL_VERSIONS = ['wealth-model-2026.08.0', 'wealth-model-2026.08.1'] as const
export type CalculationModelVersion = typeof CALCULATION_MODEL_VERSIONS[number]

export interface CalculationModelRelease {
  version: CalculationModelVersion
  releasedAt: string
  label: string
  summary: string
  changes: readonly string[]
  affectedOutputs: readonly string[]
  conventions: {
    annualToMonthly: 'effective-rate'
    contributionTiming: 'explicit-beginning-or-end'
    rounding: 'display-only'
  }
}

export const LEGACY_CALCULATION_MODEL_VERSION: CalculationModelVersion = 'wealth-model-2026.08.0'
export const CURRENT_CALCULATION_MODEL_VERSION: CalculationModelVersion = 'wealth-model-2026.08.1'

export const calculationModelRegistry: Readonly<Record<CalculationModelVersion, CalculationModelRelease>> = {
  'wealth-model-2026.08.0': {
    version: 'wealth-model-2026.08.0',
    releasedAt: '2026-08-06',
    label: 'Baseline 2026.08',
    summary: 'สูตร projection เดิมก่อนเพิ่มการอนุมัติ model update แบบมีหลักฐาน',
    changes: ['ตรึงสูตร projection ที่แผนรุ่นก่อนหน้าเคยใช้'],
    affectedOutputs: ['Goal Projection', 'Reverse Goal', 'เงินปันผลปลายทาง', 'เปรียบเทียบเงินฝากประจำ'],
    conventions: { annualToMonthly: 'effective-rate', contributionTiming: 'explicit-beginning-or-end', rounding: 'display-only' },
  },
  'wealth-model-2026.08.1': {
    version: 'wealth-model-2026.08.1',
    releasedAt: '2026-08-07',
    label: 'Auditable 2026.08',
    summary: 'เพิ่ม model manifest, safety snapshot และการยอมรับโดยผู้ใช้ก่อน rerun โดยยังไม่เปลี่ยนสูตรตัวเลข',
    changes: [
      'บันทึกรุ่น calculation model แยกจาก schema version',
      'สร้าง restore point ก่อนเปลี่ยนรุ่น',
      'แสดงรุ่นสูตรในผลลัพธ์และรายงานเพื่อ audit ย้อนหลัง',
    ],
    affectedOutputs: ['Goal Projection', 'Reverse Goal', 'เงินปันผลปลายทาง', 'เปรียบเทียบเงินฝากประจำ'],
    conventions: { annualToMonthly: 'effective-rate', contributionTiming: 'explicit-beginning-or-end', rounding: 'display-only' },
  },
}

export function getCalculationModel(version: CalculationModelVersion) {
  return calculationModelRegistry[version]
}

export function resolveCalculationModelVersion(value: unknown): CalculationModelVersion {
  return CALCULATION_MODEL_VERSIONS.includes(value as CalculationModelVersion) ? value as CalculationModelVersion : LEGACY_CALCULATION_MODEL_VERSION
}

export function hasCalculationModelUpdate(plan: Pick<WealthPlan, 'calculationModel'>) {
  return resolveCalculationModelVersion(plan.calculationModel?.version) !== CURRENT_CALCULATION_MODEL_VERSION
}

export function applyCurrentCalculationModel(plan: WealthPlan, now = new Date()): WealthPlan {
  const appliedAt = now.toISOString()
  return {
    ...plan,
    version: 10,
    updatedAt: appliedAt,
    calculationModel: { version: CURRENT_CALCULATION_MODEL_VERSION, appliedAt, appliedBy: 'user' },
  }
}
