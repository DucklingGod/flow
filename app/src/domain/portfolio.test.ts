import { describe, expect, it } from 'vitest'
import { defaultPlan, type PortfolioTransaction } from './schema'
import { MAX_CSV_CELL_CHARACTERS, MAX_CSV_IMPORT_BYTES, MAX_PORTFOLIO_TRANSACTIONS } from './importLimits'
import { analyzePortfolio, buildRebalancePreview, parseCsv, reconcileTransactions, validateCsvImport } from './portfolio'

describe('portfolio reconciliation and X-Ray', () => {
  it('reconciles seeded quantities, value, cost, dividends, and benchmark', () => {
    const result = analyzePortfolio(defaultPlan)
    expect(result.ledger.reconciliation.every((row) => Math.abs(row.difference) < .0001)).toBe(true)
    expect(result.totalValue).toBeGreaterThan(result.totalCost)
    expect(result.dividendIncome).toBe(6_300)
    expect(result.holdings.reduce((sum, row) => sum + row.value, 0)).toBeCloseTo(result.totalValue)
    expect(result.assetAllocation.reduce((sum, row) => sum + row.weight, 0)).toBeCloseTo(100)
    expect(result.geography[0].weight).toBeGreaterThan(0)
    expect(result.overlap.some((row) => row.symbol === 'US-TECH-A')).toBe(true)
    expect(result.riskContribution.reduce((sum, row) => sum + row.contribution, 0)).toBeCloseTo(100)
    expect(result.durationYears).toBeCloseTo(5.5)
  })

  it('handles sell, fee, split, duplicates, FX, and invalid corporate actions', () => {
    const base = defaultPlan.transactions.filter((tx) => tx.holdingId !== 'holding-vt')
    const tx = (patch: Partial<PortfolioTransaction>): PortfolioTransaction => ({ id: crypto.randomUUID(), externalId: null, accountId: 'portfolio-global', holdingId: 'holding-vt', type: 'buy', date: '2026-01-01', quantity: 10, price: 100, amount: 1_000, currency: 'USD', fxToThb: 35, sourceRow: null, notes: '', ...patch })
    const buy = tx({ externalId: 'B1' })
    const plan = { ...defaultPlan, transactions: [...base, buy, { ...buy, id: 'duplicate' }, tx({ type: 'split', date: '2026-02-01', quantity: 2, externalId: 'SPLIT' }), tx({ type: 'sell', date: '2026-03-01', quantity: 5, price: 120, externalId: 'SELL' }), tx({ type: 'fee', date: '2026-03-02', amount: 10, externalId: 'FEE' }), tx({ type: 'split', date: '2026-04-01', quantity: 0, externalId: 'BAD-SPLIT' }), tx({ type: 'sell', date: '2026-05-01', quantity: 99, externalId: 'BAD-SELL' })] }
    const result = reconcileTransactions(plan)
    expect(result.duplicates).toHaveLength(1)
    expect(result.issues.some((issue) => issue.includes('Split'))).toBe(true)
    expect(result.issues.some((issue) => issue.includes('เกินจำนวน'))).toBe(true)
    expect(result.positions.get('holding-vt')!.quantity).toBe(15)
    expect(result.positions.get('holding-vt')!.realized).toBeGreaterThan(0)
    expect(result.positions.get('holding-vt')!.fees).toBe(350)
  })

  it('creates preview-only IPS actions outside configured bands', () => {
    const preview = buildRebalancePreview(defaultPlan)
    expect(preview).toHaveLength(defaultPlan.investmentPolicy.targets.length)
    expect(preview.some((row) => row.outsideBand)).toBe(true)
    expect(preview.filter((row) => row.outsideBand).every((row) => row.contributors.length > 0)).toBe(true)
    expect(defaultPlan.investmentPolicy.approvalStatus).toBe('draft')
  })
})

describe('CSV import validation', () => {
  const mapping = { externalId: 'id', accountId: 'account', symbol: 'symbol', type: 'type', date: 'date', quantity: 'quantity', price: 'price', amount: 'amount', currency: 'currency', fxToThb: 'fx' }

  it('parses quoted CSV cells and preserves source rows', () => {
    expect(parseCsv('name,note\r\n"Fund, A","quote ""ok"""')).toEqual([['name', 'note'], ['Fund, A', 'quote "ok"']])
  })

  it('separates valid, duplicate, and invalid rows without silent correction', () => {
    const csv = [
      'id,account,symbol,type,date,quantity,price,amount,currency,fx',
      'NEW-1,portfolio-thai,K-SET50,buy,2026-08-01,10,16,160,THB,1',
      'SEED-1,portfolio-thai,K-SET50,buy,2026-08-01,10,16,160,THB,1',
      'BAD,missing,UNKNOWN,wrong,08/01/2026,0,0,0,X,0',
    ].join('\n')
    const result = validateCsvImport(csv, mapping, defaultPlan)
    expect(result.valid).toHaveLength(1)
    expect(result.duplicates).toHaveLength(1)
    expect(result.invalid).toHaveLength(1)
    expect(result.invalid[0].issues.length).toBeGreaterThan(2)
    expect(result.valid[0].candidate.sourceRow).toBe(2)
  })

  it('reports an empty file', () => {
    expect(validateCsvImport('', mapping, defaultPlan).invalid[0].issues).toContain('ไม่พบข้อมูล')
  })

  it('fails closed on oversized, wide, overlong, and unterminated CSV input', () => {
    expect(() => parseCsv('x'.repeat(MAX_CSV_IMPORT_BYTES + 1))).toThrow('2 MB')
    expect(validateCsvImport('x'.repeat(MAX_CSV_IMPORT_BYTES + 1), mapping, defaultPlan).invalid[0].issues).toContain('CSV ใหญ่เกิน 2 MB')
    expect(() => parseCsv(new Array(65).fill('column').join(','))).toThrow('64 columns')
    expect(() => parseCsv(`header\n${'x'.repeat(MAX_CSV_CELL_CHARACTERS + 1)}`)).toThrow('10,000')
    expect(() => parseCsv('header\n"unterminated')).toThrow('quote')
  })

  it('rejects non-finite, out-of-range, invalid-date, and overlong transaction fields', () => {
    const csv = [
      'id,account,symbol,type,date,quantity,price,amount,currency,fx',
      `${'X'.repeat(101)},portfolio-thai,K-SET50,buy,2026-02-31,not-a-number,1e309,1e309,THB,1e309`,
    ].join('\n')
    const result = validateCsvImport(csv, mapping, defaultPlan)
    expect(result.valid).toHaveLength(0)
    expect(result.invalid[0].issues).toEqual(expect.arrayContaining(['วันที่ไม่ถูกต้อง', 'รหัสรายการยาวเกิน 100 ตัวอักษร', 'จำนวน ราคา หรือมูลค่าไม่ถูกต้อง', 'สกุลเงินหรือ FX ไม่ถูกต้อง']))
  })

  it('does not let a valid staging batch exceed the plan transaction schema limit', () => {
    const fullPlan = { ...defaultPlan, transactions: new Array(MAX_PORTFOLIO_TRANSACTIONS).fill(defaultPlan.transactions[0]) }
    const csv = 'id,account,symbol,type,date,quantity,price,amount,currency,fx\nCAPACITY,portfolio-thai,K-SET50,buy,2026-08-01,1,1,1,THB,1'
    const result = validateCsvImport(csv, mapping, fullPlan)
    expect(result.valid).toHaveLength(0)
    expect(result.invalid[0].issues).toContain('เกินขีดจำกัด 20,000 รายการ')
  })
})
