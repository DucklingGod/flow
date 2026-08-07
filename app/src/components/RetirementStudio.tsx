import { useMemo } from 'react'
import {
  AlertTriangle, CalendarClock, Coins, HeartPulse, Landmark, Plus,
  ShieldCheck, SlidersHorizontal, Trash2, TrendingUp, WalletCards,
} from 'lucide-react'
import { calculateRetirement, withdrawalStrategyLabels, type RetirementYear } from '../domain/retirement'
import { migratePlan, type RetirementIncomeSource, type WealthPlan, type WithdrawalStrategy } from '../domain/schema'
import { FormattedNumberInput } from './FormattedNumberInput'

const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 2 })
const percent = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 })

const incomeTypeLabels: Record<RetirementIncomeSource['type'], string> = {
  pension: 'บำนาญ',
  socialSecurity: 'ประกันสังคม',
  providentFund: 'กองทุนสำรองเลี้ยงชีพ',
  rent: 'ค่าเช่า',
  dividend: 'เงินปันผล',
  annuity: 'เงินงวด/Annuity',
  other: 'รายได้อื่น',
}

const frequencyLabels: Record<RetirementIncomeSource['frequency'], string> = {
  monthly: 'รายเดือน',
  annual: 'รายปี',
  oneTime: 'ครั้งเดียว',
}

function RetirementChart({ points, retirementAge }: { points: RetirementYear[]; retirementAge: number }) {
  const width = 900
  const height = 280
  const padding = { left: 24, right: 18, top: 20, bottom: 34 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const maximum = Math.max(...points.map((point) => point.endingBalance), 1)
  const x = (index: number) => padding.left + (points.length <= 1 ? 0 : index / (points.length - 1) * chartWidth)
  const y = (value: number) => padding.top + chartHeight - value / maximum * chartHeight
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(point.endingBalance).toFixed(1)}`).join(' ')
  const area = `${line} L ${x(points.length - 1).toFixed(1)} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`
  const retirementIndex = Math.max(0, points.findIndex((point) => point.age === retirementAge))
  const labelIndexes = [...new Set([0, retirementIndex, Math.floor((points.length - 1) / 2), points.length - 1])].sort((a, b) => a - b)

  return (
    <div className="retirement-chart" role="img" aria-label="กราฟมูลค่าพอร์ตตั้งแต่อายุปัจจุบันถึงอายุสูงสุด เลื่อนแนวนอนได้" tabIndex={0}>
      <div className="retirement-chart-plot"><svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <defs>
          <linearGradient id="retirement-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d7ff73" stopOpacity=".72" /><stop offset="1" stopColor="#d7ff73" stopOpacity=".06" /></linearGradient>
        </defs>
        {[0, .5, 1].map((ratio) => <line key={ratio} className="retirement-grid-line" x1={padding.left} x2={width - padding.right} y1={padding.top + chartHeight * ratio} y2={padding.top + chartHeight * ratio} />)}
        <path d={area} fill="url(#retirement-fill)" />
        <path className="retirement-balance-line" d={line} />
        <line className="retirement-marker" x1={x(retirementIndex)} x2={x(retirementIndex)} y1={padding.top} y2={padding.top + chartHeight} />
        <circle className="retirement-dot" cx={x(retirementIndex)} cy={y(points[retirementIndex]?.endingBalance ?? 0)} r="5" />
      </svg><div className="retirement-axis-html" aria-hidden="true">{labelIndexes.map((index) => <span key={index} className={index === 0 ? 'start' : index === points.length - 1 ? 'end' : ''} style={{ left: `${x(index) / width * 100}%` }}>อายุ {points[index]?.age}</span>)}</div></div>
      <div className="retirement-chart-legend"><span className="balance-key">มูลค่าพอร์ต</span><span className="retire-key">เริ่มเกษียณ อายุ {retirementAge}</span><strong>จุดสูงสุด {compact.format(maximum)}</strong></div>
    </div>
  )
}

export function RetirementStudio({ plan, setPlan }: { plan: WealthPlan; setPlan: React.Dispatch<React.SetStateAction<WealthPlan>> }) {
  const normalizedPlan = plan.retirementConfig ? plan : migratePlan(plan)
  const result = useMemo(() => calculateRetirement(normalizedPlan), [normalizedPlan])
  const config = normalizedPlan.retirementConfig

  const update = <K extends keyof WealthPlan['retirementConfig']>(key: K, value: WealthPlan['retirementConfig'][K]) => {
    setPlan((current) => {
      const migrated = current.retirementConfig ? current : migratePlan(current)
      return { ...migrated, retirementConfig: { ...migrated.retirementConfig, [key]: value } }
    })
  }
  const toggleAccount = (id: string) => update('fundingAccountIds', config.fundingAccountIds.includes(id) ? config.fundingAccountIds.filter((value) => value !== id) : [...config.fundingAccountIds, id])
  const updateIncome = <K extends keyof RetirementIncomeSource>(id: string, key: K, value: RetirementIncomeSource[K]) => {
    update('incomeSources', config.incomeSources.map((source) => source.id === id ? { ...source, [key]: value } : source))
  }
  const addIncome = () => {
    const id = `retirement-income-${Date.now()}`
    update('incomeSources', [...config.incomeSources, { id, name: 'รายได้หลังเกษียณ', type: 'other', frequency: 'monthly', amount: 0, startAge: config.retirementAge, endAge: null, inflationRate: 0, taxablePercent: 0, sourceNote: 'ผู้ใช้กรอกเอง' }])
  }
  const removeIncome = (id: string) => update('incomeSources', config.incomeSources.filter((source) => source.id !== id))
  const retirementPoints = result.points.filter((point) => point.phase === 'retirement')
  const firstRetirement = retirementPoints[0]
  const firstExpenseGap = Math.max(0, result.retirementMonthlyExpense - result.retirementMonthlyIncome)

  return (
    <section className="content-section retirement-studio" id="retirement-studio">
      <div className="section-heading retirement-heading">
        <div><span className="eyebrow">RETIREMENT STUDIO · RELEASE 0.7</span><h2>เปลี่ยนเงินก้อนให้เป็นกระแสเงินสดตลอดชีวิต</h2><p>แยกช่วงสะสมและช่วงถอนถึงอายุ {config.maxAge} พร้อมรายได้หลายแหล่ง เงินเฟ้อสุขภาพ และมรดกเป้าหมาย</p></div>
        <div className={`retirement-status ${result.fundingGapAtRetirement > 0 ? 'attention' : 'ready'}`}><ShieldCheck /><span>{result.fundingGapAtRetirement > 0 ? 'ยังมีช่องว่างเงินเกษียณ' : 'เงินตั้งต้นรองรับสมมติฐาน'}</span><strong>{result.fundingGapAtRetirement > 0 ? compact.format(result.fundingGapAtRetirement) : 'ตามแผนฐาน'}</strong></div>
      </div>

      <div className="retirement-summary-grid" role="region" aria-label="สรุปแผนเกษียณ เลื่อนแนวนอนได้" tabIndex={0}>
        <article className="panel retirement-hero-card"><span>คาดว่ามี ณ วันเกษียณ</span><strong>{money.format(result.capitalAtRetirement)}</strong><small>จากเงินปัจจุบัน {money.format(result.currentSavings)} + ลงทุนเดือนละ {money.format(config.monthlyContribution)}</small></article>
        <article className="panel"><Landmark /><span>เงินที่แบบจำลองต้องการ</span><strong>{compact.format(result.requiredCapitalAtRetirement)}</strong><small>รวมค่าใช้จ่ายถึงอายุ {config.maxAge} และ legacy target</small></article>
        <article className="panel"><Coins /><span>ส่วนต่างรายเดือนปีแรก</span><strong>{money.format(firstExpenseGap)}</strong><small>ค่าใช้จ่าย {money.format(result.retirementMonthlyExpense)} − รายได้ {money.format(result.retirementMonthlyIncome)}</small></article>
        <article className={`panel ${result.firstUnmetAge ? 'risk-card' : ''}`}><CalendarClock /><span>อายุที่เริ่มขาดกระแสเงินสด</span><strong>{result.firstUnmetAge ? `${result.firstUnmetAge} ปี` : `ไม่พบถึง ${config.maxAge}`}</strong><small>{result.depletionAge ? `พอร์ตอาจหมดที่อายุ ${result.depletionAge}` : `เหลือปลายทาง ${compact.format(result.legacyAtMaxAge)}`}</small></article>
      </div>

      <div className="retirement-main-grid">
        <article className="panel retirement-projection-card">
          <div className="panel-head"><div><span className="eyebrow">LIFETIME CASH-FLOW</span><h2>ก่อนเกษียณสะสม · หลังเกษียณถอน</h2></div><span className="source-chip">คำนวณรายปี</span></div>
          <RetirementChart points={result.points} retirementAge={config.retirementAge} />
          <div className="retirement-phase-grid">
            <div><TrendingUp /><span>ช่วงสะสม</span><strong>{config.retirementAge - config.currentAge} ปี</strong><small>ผลตอบแทนสมมติ {percent.format(config.preRetirementReturn)}%/ปี</small></div>
            <div><WalletCards /><span>ช่วงถอน</span><strong>{config.maxAge - config.retirementAge + 1} ปี</strong><small>ถอนปีแรก {money.format(firstRetirement?.withdrawal ?? 0)}</small></div>
            <div><HeartPulse /><span>สุขภาพปีแรก</span><strong>{money.format((firstRetirement?.healthcareExpense ?? 0) / 12)}/เดือน</strong><small>เงินเฟ้อสุขภาพ {percent.format(config.healthcareInflationRate)}%</small></div>
          </div>
          <details className="retirement-audit"><summary>เปิดตาราง cash-flow รายปี</summary><div className="retirement-table-wrap"><table><thead><tr><th>อายุ</th><th>ช่วง</th><th>ต้นปี</th><th>เติมเงิน/รายได้</th><th>ค่าใช้จ่าย</th><th>ถอน</th><th>ปลายปี</th></tr></thead><tbody>{result.points.map((point) => <tr key={`${point.phase}-${point.age}`}><td>{point.age}</td><td>{point.phase === 'accumulation' ? 'สะสม' : 'เกษียณ'}</td><td>{compact.format(point.openingBalance)}</td><td>{compact.format(point.contribution + point.recurringIncome + point.oneTimeIncome)}</td><td>{compact.format(point.livingExpense + point.healthcareExpense)}</td><td>{compact.format(point.withdrawal)}</td><td>{compact.format(point.endingBalance)}</td></tr>)}</tbody></table></div></details>
        </article>

        <aside className="panel retirement-controls">
          <div className="panel-head compact"><div><span className="eyebrow">CORE ASSUMPTIONS</span><h2>ช่วงชีวิตและเงินที่ใช้</h2></div><SlidersHorizontal /></div>
          <div className="retirement-age-grid"><label>อายุปัจจุบัน<FormattedNumberInput min="18" max="99" value={config.currentAge} onValueChange={(value) => update('currentAge', Math.max(18, value))} /></label><label>เกษียณ<FormattedNumberInput min={config.currentAge + 1} max="100" value={config.retirementAge} onValueChange={(value) => update('retirementAge', Math.max(config.currentAge + 1, value))} /></label><label>วางแผนถึง<FormattedNumberInput min={config.retirementAge + 1} max="110" value={config.maxAge} onValueChange={(value) => update('maxAge', Math.max(config.retirementAge + 1, value))} /></label></div>
          <label>ลงทุนเพื่อเกษียณต่อเดือน<span>บาท</span><FormattedNumberInput min="0" value={config.monthlyContribution} onValueChange={(value) => update('monthlyContribution', Math.max(0, value))} /></label>
          <div className="two-fields"><label>ค่าใช้จ่ายชีวิตวันนี้<span>บาท/เดือน</span><FormattedNumberInput min="0" value={config.monthlyLivingExpenseToday} onValueChange={(value) => update('monthlyLivingExpenseToday', Math.max(0, value))} /></label><label>สุขภาพวันนี้<span>บาท/เดือน</span><FormattedNumberInput min="0" value={config.monthlyHealthcareToday} onValueChange={(value) => update('monthlyHealthcareToday', Math.max(0, value))} /></label></div>
          <div className="two-fields"><label>ผลตอบแทนก่อนเกษียณ<span>%/ปี</span><FormattedNumberInput step="0.1" min="-20" max="30" value={config.preRetirementReturn} onValueChange={(value) => update('preRetirementReturn', value)} /></label><label>หลังเกษียณ<span>%/ปี</span><FormattedNumberInput step="0.1" min="-20" max="30" value={config.postRetirementReturn} onValueChange={(value) => update('postRetirementReturn', value)} /></label></div>
          <div className="two-fields"><label>เงินเฟ้อทั่วไป<span>%/ปี</span><FormattedNumberInput step="0.1" min="-5" max="30" value={config.inflationRate} onValueChange={(value) => update('inflationRate', value)} /></label><label>เงินเฟ้อสุขภาพ<span>%/ปี</span><FormattedNumberInput step="0.1" min="-5" max="50" value={config.healthcareInflationRate} onValueChange={(value) => update('healthcareInflationRate', value)} /></label></div>
          <label>Legacy target มูลค่าเงินวันนี้<span>บาท</span><FormattedNumberInput min="0" value={config.legacyTargetToday} onValueChange={(value) => update('legacyTargetToday', Math.max(0, value))} /></label>
          <fieldset className="funding-accounts"><legend>บัญชีที่นับเป็นเงินเกษียณ</legend>{normalizedPlan.accounts.map((account) => <label key={account.id}><input type="checkbox" checked={config.fundingAccountIds.includes(account.id)} onChange={() => toggleAccount(account.id)} /><span>{account.name}<small>{money.format(account.balance)}</small></span></label>)}</fieldset>
        </aside>
      </div>

      <article className="panel retirement-strategy-card">
        <div className="section-heading compact"><div><span className="eyebrow">WITHDRAWAL POLICY</span><h2>กำหนดวิธีถอนและขอบเขตความเสี่ยง</h2></div><span className="policy-chip">ต้องอนุมัติเองก่อนนำไปใช้จริง</span></div>
        <div className="strategy-tabs" role="group" aria-label="กลยุทธ์ถอนเงินหลังเกษียณ">{(Object.keys(withdrawalStrategyLabels) as WithdrawalStrategy[]).map((strategy) => <button key={strategy} className={config.withdrawalStrategy === strategy ? 'active' : ''} aria-pressed={config.withdrawalStrategy === strategy} onClick={() => update('withdrawalStrategy', strategy)}><strong>{withdrawalStrategyLabels[strategy]}</strong><small>{strategy === 'fixedReal' ? 'ถอนเท่าค่าใช้จ่ายที่ขาด' : strategy === 'percentage' ? 'คุมเพดานจากมูลค่าพอร์ต' : strategy === 'guardrails' ? 'ลด/เพิ่มตาม withdrawal rate' : 'แยกเงินสดจากพอร์ตเติบโต'}</small></button>)}</div>
        <div className="strategy-controls"><label>อัตราถอนตั้งต้น<span>{percent.format(config.initialWithdrawalRate)}%</span><input type="range" min="0" max="10" step="0.1" value={config.initialWithdrawalRate} onChange={(event) => update('initialWithdrawalRate', Number(event.target.value))} /></label>{config.withdrawalStrategy === 'guardrails' && <><label>ขอบล่าง<span>{percent.format(config.guardrailLowerRate)}%</span><input type="range" min="0" max="10" step="0.1" value={config.guardrailLowerRate} onChange={(event) => update('guardrailLowerRate', Number(event.target.value))} /></label><label>ขอบบน<span>{percent.format(config.guardrailUpperRate)}%</span><input type="range" min="0" max="12" step="0.1" value={config.guardrailUpperRate} onChange={(event) => update('guardrailUpperRate', Number(event.target.value))} /></label></>}{config.withdrawalStrategy === 'bucket' && <label>เงินสดสำรอง<span>{percent.format(config.cashBucketYears)} ปี</span><input type="range" min="0" max="10" step="0.5" value={config.cashBucketYears} onChange={(event) => update('cashBucketYears', Number(event.target.value))} /></label>}<label>หุ้นช่วงเริ่มเกษียณ<span>{percent.format(config.glidePathStartEquity)}%</span><input type="range" min="0" max="100" value={config.glidePathStartEquity} onChange={(event) => update('glidePathStartEquity', Number(event.target.value))} /></label><label>หุ้นช่วงปลายแผน<span>{percent.format(config.glidePathEndEquity)}%</span><input type="range" min="0" max="100" value={config.glidePathEndEquity} onChange={(event) => update('glidePathEndEquity', Number(event.target.value))} /></label><label>Shock ปีแรกเกษียณ<span>−{percent.format(config.retirementShockPercent)}%</span><input type="range" min="0" max="60" value={config.retirementShockPercent} onChange={(event) => update('retirementShockPercent', Number(event.target.value))} /></label></div>
      </article>

      <article className="panel retirement-income-card">
        <div className="ledger-head"><div><span className="eyebrow">RETIREMENT INCOME</span><h2>รายได้หลังเกษียณ</h2><p>เพิ่มบำนาญ ประกันสังคม PVD ค่าเช่า ปันผล หรือเงินก้อน โดยแต่ละรายการมีช่วงเวลาของตัวเอง</p></div><button onClick={addIncome}><Plus />เพิ่มรายได้</button></div>
        <div className="retirement-income-list">{config.incomeSources.map((source) => <div className="retirement-income-row" key={source.id}><label className="income-name">ชื่อรายการ<input value={source.name} onChange={(event) => updateIncome(source.id, 'name', event.target.value)} /></label><label>ประเภท<select value={source.type} onChange={(event) => updateIncome(source.id, 'type', event.target.value as RetirementIncomeSource['type'])}>{Object.entries(incomeTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>ความถี่<select value={source.frequency} onChange={(event) => { const frequency = event.target.value as RetirementIncomeSource['frequency']; update('incomeSources', config.incomeSources.map((item) => item.id === source.id ? { ...item, frequency, endAge: frequency === 'oneTime' ? null : item.endAge } : item)) }}>{Object.entries(frequencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>จำนวนเงิน<FormattedNumberInput min="0" value={source.amount} onValueChange={(value) => updateIncome(source.id, 'amount', Math.max(0, value))} /></label><label>เริ่มอายุ<FormattedNumberInput min="18" max="110" value={source.startAge} onValueChange={(value) => updateIncome(source.id, 'startAge', value)} /></label><label>สิ้นสุด<FormattedNumberInput allowEmpty min={source.startAge} max="110" disabled={source.frequency === 'oneTime'} value={source.endAge} placeholder="ตลอดชีพ" onValueChange={(value) => updateIncome(source.id, 'endAge', value)} /></label><label>ปรับเพิ่ม<span>%/ปี</span><FormattedNumberInput step="0.1" min="-5" max="30" value={source.inflationRate} onValueChange={(value) => updateIncome(source.id, 'inflationRate', value)} /></label><label>ส่วนที่อาจเสียภาษี<span>%</span><FormattedNumberInput min="0" max="100" value={source.taxablePercent} onValueChange={(value) => updateIncome(source.id, 'taxablePercent', value)} /></label><button className="remove-income" onClick={() => removeIncome(source.id)} aria-label={`ลบ ${source.name}`}><Trash2 /></button></div>)}</div>
        {config.incomeSources.length === 0 && <p className="empty-flow">ยังไม่มีรายได้หลังเกษียณ ระบบจะถือว่าถอนจากพอร์ตทั้งหมด</p>}
      </article>

      <div className="retirement-warnings"><AlertTriangle /><div><strong>ขอบเขตแบบจำลอง</strong>{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}<p>ตัวเลขภาษียังไม่ถูกหักจนกว่า Thailand Tax Studio จะผ่าน expert review และเปิดใช้งานโดยผู้ใช้</p></div></div>
    </section>
  )
}
