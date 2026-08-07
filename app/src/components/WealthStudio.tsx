import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Camera, Download, Landmark, Plus, ReceiptText, Trash2, Upload, WalletCards } from 'lucide-react'
import type { CashFlowEntry, Debt, WealthAccount, WealthPlan } from '../domain/schema'
import { calculateWealthHealth, cashFlowTrend, compareDebtVsInvest, compareRefinance, simulateDebtStrategy } from '../domain/wealth'
import { exportPlan, importPlan } from '../data/planRepository'
import { assertFileSize, MAX_PLAN_IMPORT_BYTES } from '../domain/importLimits'
import { FormattedNumberInput } from './FormattedNumberInput'

const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })
const accountTypes: Array<{ value: WealthAccount['type']; label: string }> = [
  { value: 'cash', label: 'เงินสด' }, { value: 'investment', label: 'การลงทุน' },
  { value: 'property', label: 'อสังหาฯ' }, { value: 'insurance', label: 'มูลค่าเวนคืนประกัน' }, { value: 'other', label: 'ไม่มีราคาตลาด/อื่น ๆ' },
]

function NetWorthChart({ plan }: { plan: WealthPlan }) {
  const points = plan.netWorthHistory
  const width = 640
  const height = 150
  const pad = 18
  const values = points.map((point) => point.assets - point.debt)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  const span = Math.max(1, max - min)
  const x = (index: number) => pad + index / Math.max(1, points.length - 1) * (width - pad * 2)
  const y = (value: number) => height - pad - (value - min) / span * (height - pad * 2)
  const path = values.map((value, index) => `${index ? 'L' : 'M'}${x(index)},${y(value)}`).join(' ')
  return <div className="networth-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="ประวัติความมั่งคั่งสุทธิ"><line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} /><path d={path} />{values.map((value, index) => <circle key={points[index].id} cx={x(index)} cy={y(value)} r="4"><title>{points[index].date}: {money.format(value)}</title></circle>)}</svg><div><span>{points[0]?.date}</span><strong>{money.format(values.at(-1) ?? 0)}</strong><span>{points.at(-1)?.date}</span></div></div>
}

export function WealthStudio({ plan, setPlan }: { plan: WealthPlan; setPlan: React.Dispatch<React.SetStateAction<WealthPlan>> }) {
  const wealth = useMemo(() => calculateWealthHealth(plan), [plan])
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>('avalanche')
  const [fileStatus, setFileStatus] = useState('')
  const [refinanceRate, setRefinanceRate] = useState(3.25)
  const [refinanceFee, setRefinanceFee] = useState(15_000)
  const fileInput = useRef<HTMLInputElement>(null)
  const payoff = useMemo(() => simulateDebtStrategy(plan.debts, strategy, plan.debtExtraPayment), [plan.debts, plan.debtExtraPayment, strategy])
  const refinance = useMemo(() => plan.debts[0] ? compareRefinance(plan.debts[0], refinanceRate, refinanceFee) : null, [plan.debts, refinanceRate, refinanceFee])
  const debtVsInvest = useMemo(() => compareDebtVsInvest(Math.max(0, ...plan.debts.map((debt) => debt.annualRate)), plan.expectedReturn - plan.annualFee), [plan.debts, plan.expectedReturn, plan.annualFee])
  const trend = useMemo(() => cashFlowTrend(plan).slice(-6), [plan])

  const patchAccount = (id: string, patch: Partial<WealthAccount>) => setPlan((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === id ? { ...item, ...patch } : item) }))
  const patchCashFlow = (id: string, patch: Partial<CashFlowEntry>) => setPlan((current) => ({ ...current, cashFlows: current.cashFlows.map((item) => item.id === id ? { ...item, ...patch } : item) }))
  const patchDebt = (id: string, patch: Partial<Debt>) => setPlan((current) => ({ ...current, debts: current.debts.map((item) => item.id === id ? { ...item, ...patch } : item) }))
  const addAccount = () => setPlan((current) => ({ ...current, accounts: [...current.accounts, { id: crypto.randomUUID(), name: 'บัญชีใหม่', type: 'cash', balance: 0, currency: 'THB' }] }))
  const addCashFlow = () => setPlan((current) => ({ ...current, cashFlows: [...current.cashFlows, { id: crypto.randomUUID(), name: 'รายการใหม่', type: 'expense', amount: 0, frequency: 'monthly', category: 'ทั่วไป' }] }))
  const addDebt = () => setPlan((current) => ({ ...current, debts: [...current.debts, { id: crypto.randomUUID(), name: 'หนี้ใหม่', balance: 0, annualRate: 0, minimumPayment: 0 }] }))
  const captureSnapshot = () => setPlan((current) => ({ ...current, netWorthHistory: [...current.netWorthHistory, { id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10), assets: wealth.assets, debt: wealth.debt }].slice(-600) }))
  const captureCashFlow = () => setPlan((current) => {
    const month = new Date().toISOString().slice(0, 7)
    const withoutMonth = current.cashFlowHistory.filter((item) => item.month !== month)
    const snapshot = current.cashFlows.map((item) => ({ id: crypto.randomUUID(), month, category: item.category, type: item.type, amount: item.frequency === 'annual' ? item.amount / 12 : item.amount }))
    return { ...current, cashFlowHistory: [...withoutMonth, ...snapshot].slice(-6_000) }
  })
  const download = () => {
    const blob = new Blob([exportPlan(plan)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = `flow-wealth-${new Date().toISOString().slice(0, 10)}.json`; anchor.click()
    URL.revokeObjectURL(url); setFileStatus('ส่งออกข้อมูลแล้ว')
  }
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try { assertFileSize(file.size, MAX_PLAN_IMPORT_BYTES, 'ไฟล์ใหญ่เกิน 10 MB'); setPlan(importPlan(await file.text())); setFileStatus('นำเข้าแผนสำเร็จ') } catch (error) { setFileStatus(error instanceof Error ? error.message : 'นำเข้าไม่สำเร็จ') }
    event.target.value = ''
  }

  return <section className="content-section" id="wealth-map">
    <div className="section-heading"><div><span className="eyebrow">WEALTH MAP</span><h2>ฐานะการเงินที่ตรวจสอบย้อนกลับได้</h2></div><div className="file-actions"><input ref={fileInput} type="file" accept="application/json,.json" onChange={upload} aria-label="นำเข้าแผน JSON" /><button onClick={() => fileInput.current?.click()}><Upload />นำเข้า</button><button onClick={download}><Download />ส่งออก</button></div></div>
    {fileStatus && <p className="file-status" role="status">{fileStatus}</p>}
    <div className="wealth-grid">
      <article className="panel score-card"><div className="score-ring" style={{ background: `conic-gradient(var(--lime) ${wealth.score}%, rgba(255,255,255,.12) 0)` }}><div><strong>{wealth.score}</strong><span>/100</span></div></div><div><span className="eyebrow light">WEALTH HEALTH</span><h3>{wealth.score >= 75 ? 'ฐานการเงินแข็งแรง' : wealth.score >= 55 ? 'กำลังไปได้ดี' : 'ควรเสริมฐานก่อน'}</h3><p>คะแนน 100 มาจากเงินสำรอง 35, อัตราออม 35 และภาระหนี้ 30 คะแนน</p></div></article>
      <article className="panel wealth-numbers"><div><span>ทรัพย์สินรวม</span><strong>{money.format(wealth.assets)}</strong></div><div><span>หนี้สินรวม</span><strong>{money.format(wealth.debt)}</strong></div><div><span>ความมั่งคั่งสุทธิ</span><strong>{money.format(wealth.netWorth)}</strong></div><div><span>รายรับ/เดือน</span><strong>{money.format(wealth.monthlyIncome)}</strong></div><div><span>รายจ่าย/เดือน</span><strong>{money.format(wealth.monthlyExpense)}</strong></div><div><span>เงินเหลือ/เดือน</span><strong>{money.format(wealth.monthlySurplus)}</strong></div></article>
    </div>
    <div className="health-drivers">{wealth.drivers.map((driver) => <article key={driver.id} className={driver.status}><div><span>{driver.label}</span><b>+{driver.points}</b></div><strong>{driver.value}</strong><p>{driver.reason}</p><small>{driver.action}</small></article>)}</div>

    <div className="ledger-grid">
      <article className="panel ledger-card"><div className="ledger-head"><div><WalletCards /><span><b>บัญชีทรัพย์สิน</b><small>ยอดรวมต้องตรงกับ Wealth Map</small></span></div><button onClick={addAccount}><Plus />เพิ่มบัญชี</button></div><div className="ledger-list">{plan.accounts.map((account) => <div className="ledger-row account-row" key={account.id}><input aria-label="ชื่อบัญชี" value={account.name} onChange={(event) => patchAccount(account.id, { name: event.target.value })} /><select aria-label="ประเภทบัญชี" value={account.type} onChange={(event) => patchAccount(account.id, { type: event.target.value as WealthAccount['type'] })}>{accountTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><FormattedNumberInput aria-label="ยอดคงเหลือ" min="0" value={account.balance} onValueChange={(value) => patchAccount(account.id, { balance: Math.max(0, value) })} /><button aria-label={`ลบ ${account.name}`} onClick={() => setPlan((current) => ({ ...current, accounts: current.accounts.filter((item) => item.id !== account.id) }))}><Trash2 /></button></div>)}</div></article>
      <article className="panel ledger-card"><div className="ledger-head"><div><ReceiptText /><span><b>กระแสเงินสด</b><small>รองรับหมวดหมู่ รายเดือนและรายปี</small></span></div><div className="ledger-actions"><button onClick={captureCashFlow}><Camera />บันทึกเดือนนี้</button><button onClick={addCashFlow}><Plus />เพิ่มรายการ</button></div></div><div className="ledger-list">{plan.cashFlows.map((flow) => <div className="ledger-row flow-row" key={flow.id}><input aria-label="ชื่อกระแสเงินสด" value={flow.name} onChange={(event) => patchCashFlow(flow.id, { name: event.target.value })} /><input aria-label="หมวดหมู่" value={flow.category} onChange={(event) => patchCashFlow(flow.id, { category: event.target.value || 'ทั่วไป' })} /><select aria-label="ประเภทรายการ" value={flow.type} onChange={(event) => patchCashFlow(flow.id, { type: event.target.value as CashFlowEntry['type'] })}><option value="income">รายรับ</option><option value="expense">รายจ่าย</option></select><FormattedNumberInput aria-label="จำนวนเงิน" min="0" value={flow.amount} onValueChange={(value) => patchCashFlow(flow.id, { amount: Math.max(0, value) })} /><select aria-label="ความถี่" value={flow.frequency} onChange={(event) => patchCashFlow(flow.id, { frequency: event.target.value as CashFlowEntry['frequency'] })}><option value="monthly">/เดือน</option><option value="annual">/ปี</option></select><button aria-label={`ลบ ${flow.name}`} onClick={() => setPlan((current) => ({ ...current, cashFlows: current.cashFlows.filter((item) => item.id !== flow.id) }))}><Trash2 /></button></div>)}</div>{trend.length > 0 && <div className="cashflow-trend">{trend.map((row) => { const max = Math.max(row.income, row.expense, 1); return <div key={row.month}><span>{row.month}</span><i className="income" style={{ width: `${row.income / max * 100}%` }} /><i className="expense" style={{ width: `${row.expense / max * 100}%` }} /><small>รับ {money.format(row.income)} · จ่าย {money.format(row.expense)}</small></div> })}</div>}</article>
    </div>

    <div className="wealth-tools-grid">
      <article className="panel history-card"><div className="ledger-head"><div><Camera /><span><b>Net Worth History</b><small>เก็บ snapshot เพื่อเห็นทิศทาง ไม่เขียนทับอดีต</small></span></div><button onClick={captureSnapshot}><Camera />บันทึกวันนี้</button></div><NetWorthChart plan={plan} /></article>
      <article className="panel debt-card" id="debt-studio"><div className="ledger-head"><div><Landmark /><span><b>Debt Studio</b><small>เปรียบเทียบวิธีปิดหนี้ด้วยเงินก้อนเดียวกัน</small></span></div><button onClick={addDebt}><Plus />เพิ่มหนี้</button></div><div className="debt-settings"><div className="mode-control" role="group" aria-label="กลยุทธ์ชำระหนี้"><button className={strategy === 'avalanche' ? 'active' : ''} aria-pressed={strategy === 'avalanche'} onClick={() => setStrategy('avalanche')}>Avalanche</button><button className={strategy === 'snowball' ? 'active' : ''} aria-pressed={strategy === 'snowball'} onClick={() => setStrategy('snowball')}>Snowball</button></div><label>จ่ายเพิ่ม/เดือน<FormattedNumberInput min="0" value={plan.debtExtraPayment} onValueChange={(value) => setPlan((current) => ({ ...current, debtExtraPayment: Math.max(0, value) }))} /></label></div><div className="debt-summary"><div><span>ปลดหนี้ใน</span><strong>{payoff.months === null ? 'เกิน 100 ปี' : `${Math.ceil(payoff.months / 12)} ปี ${payoff.months % 12} เดือน`}</strong></div><div><span>ดอกเบี้ยรวม</span><strong>{money.format(payoff.totalInterest)}</strong></div></div><div className="ledger-list debts">{plan.debts.map((debt) => <div className="debt-row" key={debt.id}><input aria-label="ชื่อหนี้" value={debt.name} onChange={(event) => patchDebt(debt.id, { name: event.target.value })} /><label>ยอดหนี้<FormattedNumberInput aria-label="ยอดหนี้" min="0" value={debt.balance} onValueChange={(value) => patchDebt(debt.id, { balance: Math.max(0, value) })} /></label><label>ดอกเบี้ย %<FormattedNumberInput aria-label="ดอกเบี้ยต่อปี" min="0" step="0.1" value={debt.annualRate} onValueChange={(value) => patchDebt(debt.id, { annualRate: Math.max(0, value) })} /></label><label>ขั้นต่ำ/เดือน<FormattedNumberInput aria-label="ยอดชำระขั้นต่ำ" min="0" value={debt.minimumPayment} onValueChange={(value) => patchDebt(debt.id, { minimumPayment: Math.max(0, value) })} /></label><button aria-label={`ลบ ${debt.name}`} onClick={() => setPlan((current) => ({ ...current, debts: current.debts.filter((item) => item.id !== debt.id) }))}><Trash2 /></button></div>)}</div>{plan.debts[0] && <div className="debt-decisions"><div><span>Refinance: {plan.debts[0].name}</span><label>ดอกเบี้ยใหม่ %<FormattedNumberInput min="0" step="0.1" value={refinanceRate} onValueChange={(value) => setRefinanceRate(Math.max(0, value))} /></label><label>ค่าดำเนินการ<FormattedNumberInput min="0" value={refinanceFee} onValueChange={(value) => setRefinanceFee(Math.max(0, value))} /></label><strong className={refinance?.worthwhile ? 'positive' : 'negative'}>{refinance?.worthwhile ? `ประหยัดสุทธิ ${money.format(refinance.netSaving)}` : `ยังไม่คุ้ม ${money.format(Math.abs(refinance?.netSaving ?? 0))}`}</strong></div><div><span>โปะหนี้ vs ลงทุน</span><strong>{debtVsInvest.preference === 'debt' ? 'โปะหนี้ก่อน' : 'ลงทุนได้ แต่รับความผันผวน'}</strong><p>ประหยัดดอกเบี้ย {debtVsInvest.debtReturn.toFixed(1)}% เทียบผลตอบแทนจำลอง {debtVsInvest.investmentReturn.toFixed(1)}%</p><small>{debtVsInvest.reason}</small></div></div>}<p className="debt-note">แบบจำลองสมมติว่าไม่มีหนี้ใหม่และชำระทุกเดือน ผลลัพธ์ใช้วางแผนเท่านั้น ไม่มีการชำระหนี้หรือทำธุรกรรมจริง</p></article>
    </div>
  </section>
}
