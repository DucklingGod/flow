import type { AssetClass, Holding, PortfolioTransaction, WealthPlan } from './schema'
import { assertTextSize, MAX_CSV_CELL_CHARACTERS, MAX_CSV_COLUMNS, MAX_CSV_IMPORT_BYTES, MAX_CSV_ROWS, MAX_PORTFOLIO_TRANSACTIONS, TRANSACTION_LIMITS } from './importLimits'

export const assetClassLabels: Record<AssetClass, string> = {
  thaiEquity: 'หุ้นไทย', globalEquity: 'หุ้นต่างประเทศ', bond: 'ตราสารหนี้', cash: 'เงินสด',
  property: 'อสังหาฯ', commodity: 'สินค้าโภคภัณฑ์', other: 'อื่น ๆ',
}

export function holdingValue(holding: Holding) {
  return holding.quantity * holding.currentPrice * holding.fxToThb
}

export function transactionKey(transaction: PortfolioTransaction) {
  return transaction.externalId || [transaction.accountId, transaction.holdingId, transaction.type, transaction.date, transaction.quantity, transaction.price, transaction.amount, transaction.currency].join('|')
}

export function reconcileTransactions(plan: WealthPlan) {
  const seen = new Set<string>()
  const duplicates: PortfolioTransaction[] = []
  const issues: string[] = []
  const positions = new Map<string, { quantity: number; costThb: number; realized: number; dividends: number; fees: number }>()
  const ordered = [...plan.transactions].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  for (const tx of ordered) {
    const key = transactionKey(tx)
    if (seen.has(key)) { duplicates.push(tx); continue }
    seen.add(key)
    if (!tx.holdingId) { if (tx.type !== 'fee') issues.push(`รายการ ${tx.id} ไม่มี holding`); continue }
    const row = positions.get(tx.holdingId) ?? { quantity: 0, costThb: 0, realized: 0, dividends: 0, fees: 0 }
    if (tx.type === 'buy') {
      if (tx.quantity <= 0) issues.push(`รายการซื้อ ${tx.id} ต้องมีจำนวนมากกว่า 0`)
      else { row.quantity += tx.quantity; row.costThb += tx.quantity * tx.price * tx.fxToThb }
    } else if (tx.type === 'sell') {
      if (tx.quantity <= 0 || tx.quantity > row.quantity + .000001) issues.push(`รายการขาย ${tx.id} เกินจำนวนคงเหลือ`)
      else {
        const averageCost = row.quantity > 0 ? row.costThb / row.quantity : 0
        row.quantity -= tx.quantity
        row.costThb -= averageCost * tx.quantity
        row.realized += tx.quantity * tx.price * tx.fxToThb - averageCost * tx.quantity
      }
    } else if (tx.type === 'dividend') row.dividends += tx.amount * tx.fxToThb
    else if (tx.type === 'fee') row.fees += Math.abs(tx.amount * tx.fxToThb)
    else if (tx.type === 'split') {
      if (tx.quantity <= 0) issues.push(`Split ${tx.id} ต้องมีอัตราส่วนมากกว่า 0`)
      else row.quantity *= tx.quantity
    }
    positions.set(tx.holdingId, row)
  }
  const reconciliation = plan.holdings.map((holding) => {
    const position = positions.get(holding.id) ?? { quantity: 0, costThb: 0, realized: 0, dividends: 0, fees: 0 }
    return { holdingId: holding.id, ledgerQuantity: position.quantity, statedQuantity: holding.quantity, difference: holding.quantity - position.quantity, ...position }
  })
  return { positions, reconciliation, duplicates, issues }
}

function aggregateExposure(holdings: Holding[], key: 'geography' | 'sector' | 'currencyExposure' | 'factor') {
  const total = holdings.reduce((sum, holding) => sum + holdingValue(holding), 0)
  const map = new Map<string, number>()
  for (const holding of holdings) for (const slice of holding[key]) map.set(slice.name, (map.get(slice.name) ?? 0) + holdingValue(holding) * slice.weight / 100)
  return [...map.entries()].map(([name, value]) => ({ name, value, weight: total > 0 ? value / total * 100 : 0 })).sort((a, b) => b.value - a.value)
}

export function analyzePortfolio(plan: WealthPlan) {
  const ledger = reconcileTransactions(plan)
  const totalValue = plan.holdings.reduce((sum, holding) => sum + holdingValue(holding), 0)
  const totalCost = plan.holdings.reduce((sum, holding) => sum + holding.quantity * holding.costBasisPerUnit * holding.fxToThb, 0)
  const realizedReturn = [...ledger.positions.values()].reduce((sum, row) => sum + row.realized, 0)
  const dividendIncome = [...ledger.positions.values()].reduce((sum, row) => sum + row.dividends, 0)
  const transactionFees = [...ledger.positions.values()].reduce((sum, row) => sum + row.fees, 0)
  const unrealizedReturn = totalValue - totalCost
  const periodReturn = totalCost > 0 ? (unrealizedReturn + realizedReturn + dividendIncome - transactionFees) / totalCost * 100 : 0
  const holdings = plan.holdings.map((holding) => {
    const value = holdingValue(holding)
    const cost = holding.quantity * holding.costBasisPerUnit * holding.fxToThb
    return { holding, value, cost, weight: totalValue > 0 ? value / totalValue * 100 : 0, unrealized: value - cost, annualFeeBaht: value * holding.annualFee / 100, annualIncome: value * holding.dividendYield / 100 }
  }).sort((a, b) => b.value - a.value)
  const assetMap = new Map<AssetClass, number>()
  for (const row of holdings) assetMap.set(row.holding.assetClass, (assetMap.get(row.holding.assetClass) ?? 0) + row.value)
  const assetAllocation = [...assetMap.entries()].map(([assetClass, value]) => ({ assetClass, label: assetClassLabels[assetClass], value, weight: totalValue > 0 ? value / totalValue * 100 : 0 })).sort((a, b) => b.value - a.value)
  const annualFeeBaht = holdings.reduce((sum, row) => sum + row.annualFeeBaht, 0)
  const annualIncome = holdings.reduce((sum, row) => sum + row.annualIncome, 0)
  const weightedVolatility = totalValue > 0 ? holdings.reduce((sum, row) => sum + row.value * row.holding.volatility, 0) / totalValue : 0
  const weightedDrawdown = totalValue > 0 ? holdings.reduce((sum, row) => sum + row.value * row.holding.maxDrawdown, 0) / totalValue : 0
  const feeRate = totalValue > 0 ? annualFeeBaht / totalValue * 100 : 0
  const incomeYield = totalValue > 0 ? annualIncome / totalValue * 100 : 0
  const concentrationHhi = holdings.reduce((sum, row) => sum + Math.pow(row.weight / 100, 2), 0) * 10_000
  const riskDenominator = holdings.reduce((sum, row) => sum + row.value * row.holding.volatility, 0)
  const riskContribution = holdings.map((row) => ({ symbol: row.holding.symbol, contribution: riskDenominator > 0 ? row.value * row.holding.volatility / riskDenominator * 100 : 0 })).sort((a, b) => b.contribution - a.contribution)

  const underlyingMap = new Map<string, { symbol: string; name: string; value: number; funds: string[] }>()
  for (const row of holdings) for (const item of row.holding.underlying) {
    const current = underlyingMap.get(item.symbol) ?? { symbol: item.symbol, name: item.name, value: 0, funds: [] }
    current.value += row.value * item.weight / 100
    if (!current.funds.includes(row.holding.symbol)) current.funds.push(row.holding.symbol)
    underlyingMap.set(item.symbol, current)
  }
  const overlap = [...underlyingMap.values()].filter((item) => item.funds.length > 1).map((item) => ({ ...item, portfolioWeight: totalValue > 0 ? item.value / totalValue * 100 : 0 })).sort((a, b) => b.value - a.value)
  const correlations: Array<{ left: string; right: string; proxy: number; reason: string }> = []
  for (let left = 0; left < plan.holdings.length; left += 1) for (let right = left + 1; right < plan.holdings.length; right += 1) {
    const a = plan.holdings[left], b = plan.holdings[right]
    const shared = a.underlying.filter((item) => b.underlying.some((other) => other.symbol === item.symbol)).length
    const proxy = Math.min(.95, (a.assetClass === b.assetClass ? .65 : .15) + Math.min(.25, shared * .1))
    correlations.push({ left: a.symbol, right: b.symbol, proxy, reason: shared ? `สินทรัพย์ย่อยซ้ำ ${shared} รายการ` : a.assetClass === b.assetClass ? 'อยู่ในสินทรัพย์ประเภทเดียวกัน' : 'proxy จากประเภทสินทรัพย์' })
  }
  correlations.sort((a, b) => b.proxy - a.proxy)

  const unhedgedFxValue = holdings.reduce((sum, row) => sum + row.value * (100 - row.holding.fxHedgedPercent) / 100, 0)
  const bondRows = holdings.filter((row) => row.holding.assetClass === 'bond' && row.holding.durationYears !== null)
  const bondValue = bondRows.reduce((sum, row) => sum + row.value, 0)
  const durationYears = bondValue > 0 ? bondRows.reduce((sum, row) => sum + row.value * (row.holding.durationYears ?? 0), 0) / bondValue : null
  return {
    totalValue, totalCost, unrealizedReturn, realizedReturn, dividendIncome, transactionFees, periodReturn,
    benchmarkDifference: periodReturn - plan.benchmark.periodReturn, holdings, assetAllocation,
    geography: aggregateExposure(plan.holdings, 'geography'), sector: aggregateExposure(plan.holdings, 'sector'),
    currency: aggregateExposure(plan.holdings, 'currencyExposure'), factor: aggregateExposure(plan.holdings, 'factor'),
    annualFeeBaht, annualIncome, feeRate, incomeYield, weightedVolatility, weightedDrawdown, concentrationHhi,
    riskContribution, overlap, correlations, unhedgedFxValue, unhedgedFxWeight: totalValue > 0 ? unhedgedFxValue / totalValue * 100 : 0,
    durationYears, creditQualities: bondRows.map((row) => ({ symbol: row.holding.symbol, quality: row.holding.creditQuality, weight: bondValue > 0 ? row.value / bondValue * 100 : 0 })), ledger,
  }
}

export function buildRebalancePreview(plan: WealthPlan) {
  const analysis = analyzePortfolio(plan)
  const targetMap = new Map(plan.investmentPolicy.targets.map((target) => [target.assetClass, target.targetWeight]))
  const classes = new Set<AssetClass>([...targetMap.keys(), ...analysis.assetAllocation.map((row) => row.assetClass)])
  return [...classes].map((assetClass) => {
    const currentWeight = analysis.assetAllocation.find((row) => row.assetClass === assetClass)?.weight ?? 0
    const targetWeight = targetMap.get(assetClass) ?? 0
    const difference = targetWeight - currentWeight
    const outsideBand = Math.abs(difference) > plan.investmentPolicy.rebalanceBand
    const contributors = analysis.holdings.filter((row) => row.holding.assetClass === assetClass).map((row) => ({ symbol: row.holding.symbol, source: row.holding.source, sourceAsOf: row.holding.sourceAsOf, weight: row.weight }))
    return { assetClass, label: assetClassLabels[assetClass], currentWeight, targetWeight, difference, amount: analysis.totalValue * difference / 100, outsideBand, action: !outsideBand ? 'hold' as const : difference > 0 ? 'buy' as const : 'sell' as const, contributors }
  }).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
}

export interface CsvMapping { externalId: string; accountId: string; symbol: string; type: string; date: string; quantity: string; price: string; amount: string; currency: string; fxToThb: string }

export function parseCsv(csv: string) {
  assertTextSize(csv, MAX_CSV_IMPORT_BYTES, 'CSV ใหญ่เกิน 2 MB')
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  const append = (value: string) => {
    if (cell.length + value.length > MAX_CSV_CELL_CHARACTERS) throw new Error('CSV มี cell ยาวเกิน 10,000 ตัวอักษร')
    cell += value
  }
  const commitCell = () => {
    if (row.length >= MAX_CSV_COLUMNS) throw new Error('CSV มีเกิน 64 columns')
    row.push(cell)
    cell = ''
  }
  const commitRow = () => {
    commitCell()
    if (row.some((value) => value.trim())) {
      if (rows.length >= MAX_CSV_ROWS) throw new Error('CSV มีเกิน 20,000 รายการ')
      rows.push(row)
    }
    row = []
  }
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    if (char === '"' && quoted && csv[index + 1] === '"') { append('"'); index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) commitCell()
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[index + 1] === '\n') index += 1
      commitRow()
    } else append(char)
  }
  if (quoted) throw new Error('CSV มี quote ที่ปิดไม่ครบ')
  commitRow()
  return rows
}

export function validateCsvImport(csv: string, mapping: CsvMapping, plan: WealthPlan) {
  let rows: string[][]
  try { rows = parseCsv(csv) }
  catch (error) { return { headers: [], rows: [], valid: [], duplicates: [], invalid: [{ row: 0, issues: [error instanceof Error ? error.message : 'CSV อ่านไม่ได้'] }] } }
  if (rows.length < 2) return { headers: rows[0] ?? [], rows: [], valid: [], duplicates: [], invalid: [{ row: 0, issues: ['ไม่พบข้อมูล'] }] }
  const headers = rows[0].map((header) => header.trim())
  const indexOf = (field: keyof CsvMapping) => headers.indexOf(mapping[field])
  const existing = new Set(plan.transactions.map(transactionKey))
  const availableSlots = Math.max(0, MAX_PORTFOLIO_TRANSACTIONS - plan.transactions.length)
  let acceptedCount = 0
  const output = rows.slice(1).map((values, index) => {
    const get = (field: keyof CsvMapping) => values[indexOf(field)]?.trim() ?? ''
    const holding = plan.holdings.find((item) => item.symbol.toLowerCase() === get('symbol').toLowerCase())
    const candidate: PortfolioTransaction = {
      id: crypto.randomUUID(), externalId: get('externalId') || null, accountId: get('accountId'), holdingId: holding?.id ?? null,
      type: get('type') as PortfolioTransaction['type'], date: get('date'), quantity: Number(get('quantity') || 0), price: Number(get('price') || 0),
      amount: Number(get('amount') || 0), currency: (get('currency') || 'THB').toUpperCase(), fxToThb: Number(get('fxToThb') || 1), sourceRow: index + 2, notes: 'นำเข้าจาก CSV',
    }
    const issues: string[] = []
    if (!plan.portfolioAccounts.some((account) => account.id === candidate.accountId)) issues.push('ไม่พบบัญชี')
    if (!holding && candidate.type !== 'fee') issues.push('ไม่พบ symbol')
    if (!['buy', 'sell', 'dividend', 'split', 'fee'].includes(candidate.type)) issues.push('ประเภทรายการไม่ถูกต้อง')
    const parsedDate = Date.parse(`${candidate.date}T00:00:00Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate.date) || !Number.isFinite(parsedDate) || new Date(parsedDate).toISOString().slice(0, 10) !== candidate.date) issues.push('วันที่ไม่ถูกต้อง')
    if (candidate.externalId !== null && candidate.externalId.length > 100) issues.push('รหัสรายการยาวเกิน 100 ตัวอักษร')
    if (!Number.isFinite(candidate.quantity) || candidate.quantity < 0 || candidate.quantity > TRANSACTION_LIMITS.quantity || !Number.isFinite(candidate.price) || candidate.price < 0 || candidate.price > TRANSACTION_LIMITS.price || !Number.isFinite(candidate.amount) || Math.abs(candidate.amount) > TRANSACTION_LIMITS.amount) issues.push('จำนวน ราคา หรือมูลค่าไม่ถูกต้อง')
    if (candidate.currency.length !== 3 || !Number.isFinite(candidate.fxToThb) || candidate.fxToThb <= 0 || candidate.fxToThb > TRANSACTION_LIMITS.fxToThb) issues.push('สกุลเงินหรือ FX ไม่ถูกต้อง')
    const duplicate = existing.has(transactionKey(candidate))
    if (!duplicate && !issues.length && acceptedCount >= availableSlots) issues.push(`เกินขีดจำกัด ${MAX_PORTFOLIO_TRANSACTIONS.toLocaleString('en-US')} รายการ`)
    if (!duplicate && !issues.length) { existing.add(transactionKey(candidate)); acceptedCount += 1 }
    return { row: index + 2, values, candidate, issues, duplicate }
  })
  return { headers, rows: output, valid: output.filter((row) => !row.duplicate && !row.issues.length), duplicates: output.filter((row) => row.duplicate), invalid: output.filter((row) => row.issues.length) }
}
