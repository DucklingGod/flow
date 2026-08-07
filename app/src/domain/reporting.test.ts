import { describe, expect, it } from 'vitest'
import { defaultPlan } from './schema'
import { buildCsvReport, buildPrintableReport } from './reporting'

describe('local report exports', () => {
  it('creates UTF-8 CSV and neutralizes spreadsheet formula cells', () => {
    const plan = { ...defaultPlan, accounts: [{ ...defaultPlan.accounts[0], name: '=HYPERLINK("bad")' }] }
    const csv = buildCsvReport(plan, new Date('2026-08-07T00:00:00.000Z'))
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"')
    expect(csv).toContain('2026-08-07T00:00:00.000Z')
    expect(csv).toContain(defaultPlan.calculationModel.version)
  })

  it('escapes user content and emits a print-safe report without scripts', () => {
    const plan = { ...defaultPlan, accounts: [{ ...defaultPlan.accounts[0], name: '<script>alert(1)</script>' }] }
    const html = buildPrintableReport(plan, new Date('2026-08-07T00:00:00.000Z'))
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('Content-Security-Policy')
    expect(html).toContain('ผลลัพธ์เป็นแบบจำลอง')
    expect(html).toContain(defaultPlan.calculationModel.version)
  })
})
