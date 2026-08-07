import { describe, expect, it } from 'vitest'
import { defaultPlan } from './schema'
import { calculateTax, TAX_DATASETS } from './tax'

const enabled = (overrides = {}) => ({ ...defaultPlan.taxProfile, enabled: true, datasetVersion: TAX_DATASETS[2025].version, ...overrides })

describe('Thailand PIT estimate', () => {
  it('uses employment expense and progressive brackets', () => {
    const result = calculateTax(enabled({ employmentIncome: 1_104_000, otherTaxableIncome: 0 }))
    expect(result.status).toBe('estimate')
    expect(result.employmentExpense).toBe(100_000)
    expect(result.taxableIncome).toBe(944_000)
    expect(result.taxBeforeWithholding).toBe(103_800)
    expect(result.marginalRate).toBe(20)
  })

  it('caps insurance, social security, retirement group, and Thai ESG', () => {
    const result = calculateTax(enabled({ employmentIncome: 2_000_000, socialSecurityContribution: 20_000, providentFundContribution: 450_000, rmfContribution: 400_000, thaiEsgContribution: 900_000, lifeInsurancePremium: 100_000, healthInsurancePremium: 25_000 }))
    expect(result.eligible.socialSecurity).toBe(9_000)
    expect(result.eligible.retirementGroup).toBe(500_000)
    expect(result.eligible.lifeHealthInsurance).toBe(100_000)
    expect(result.eligible.thaiEsg).toBe(300_000)
  })

  it('applies the donation cap after other allowances', () => {
    const result = calculateTax(enabled({ employmentIncome: 800_000, donations: 1_000_000 }))
    const assessable = 800_000 - 100_000 - 60_000
    expect(result.donationAllowance).toBe(assessable * .1)
  })

  it('stays disabled by default and rejects unsupported years', () => {
    expect(calculateTax(defaultPlan.taxProfile).status).toBe('disabled')
    expect(calculateTax({ ...defaultPlan.taxProfile, enabled: true, taxYear: 2026 }).status).toBe('unsupported-year')
  })

  it('never returns negative payable tax', () => {
    const result = calculateTax(enabled({ employmentIncome: 300_000, withholdingTax: 50_000 }))
    expect(result.taxPayable).toBe(0)
    expect(result.estimatedRefund).toBeGreaterThanOrEqual(0)
  })
})
