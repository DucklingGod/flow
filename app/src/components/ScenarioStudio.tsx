import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, FlaskConical, Gauge, RefreshCw, SlidersHorizontal, TimerReset } from 'lucide-react'
import type { StressPreset, WealthPlan } from '../domain/schema'
import { planToMonteCarloInput, withStressPreset, type MonteCarloResult } from '../domain/scenario'
import { FormattedNumberInput } from './FormattedNumberInput'

const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 2 })
const percent = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 })

const presetCopy: Record<StressPreset, { label: string; note: string }> = {
  none: { label: 'ไม่ใส่ shock', note: 'ใช้ distribution จากสมมติฐานฐาน' },
  equityCrash: { label: 'Equity crash', note: 'หุ้นลงแรงและค่อย ๆ ฟื้นตัว' },
  ratesInflation: { label: 'Rates + inflation', note: 'ดอกเบี้ยและเงินเฟ้อเร่งพร้อมกัน' },
  fxShock: { label: 'FX shock', note: 'ค่าเงินผันผวนกระทบสินทรัพย์ต่างประเทศ' },
  incomeHealth: { label: 'Income + health', note: 'รายได้สะดุดพร้อมค่าใช้จ่ายสุขภาพ' },
  custom: { label: 'กำหนดเอง', note: 'ปรับทุกตัวแปรได้โดยตรง' },
}

type ConfigKey = keyof WealthPlan['simulationConfig']

export function ScenarioStudio({ plan, setPlan }: { plan: WealthPlan; setPlan: React.Dispatch<React.SetStateAction<WealthPlan>> }) {
  const [result, setResult] = useState<MonteCarloResult | null>(null)
  const [running, setRunning] = useState(true)
  const [error, setError] = useState('')
  const [rerun, setRerun] = useState(0)
  const input = useMemo(() => planToMonteCarloInput(plan), [plan])

  useEffect(() => {
    setRunning(true)
    setError('')
    const worker = new Worker(new URL('../workers/monteCarlo.worker.ts', import.meta.url), { type: 'module' })
    const timer = window.setTimeout(() => worker.postMessage(input), 180)
    worker.onmessage = (event: MessageEvent<MonteCarloResult>) => { setResult(event.data); setRunning(false) }
    worker.onerror = () => { setError('ไม่สามารถรัน simulation ได้ กรุณาลองใหม่'); setRunning(false) }
    return () => { window.clearTimeout(timer); worker.terminate() }
  }, [input, rerun])

  const updateConfig = <K extends ConfigKey>(key: K, value: WealthPlan['simulationConfig'][K], custom = false) => {
    setPlan((current) => ({
      ...current,
      simulationConfig: { ...current.simulationConfig, [key]: value, ...(custom ? { stressPreset: 'custom' as const } : {}) },
    }))
  }
  const selectPreset = (preset: StressPreset) => setPlan((current) => ({ ...current, simulationConfig: withStressPreset(current.simulationConfig, preset) }))
  const topImpact = result?.sensitivity.slice(0, 3) ?? []
  const maxImpact = Math.max(...topImpact.map((item) => item.impact), 1)
  const percentileMax = Math.max(result?.p90 ?? 1, result?.targetWithOverrun ?? 1)
  const markerPosition = (value: number) => `${Math.max(2, Math.min(98, value / percentileMax * 100))}%`

  return (
    <section className="content-section scenario-studio" id="scenario-lab">
      <div className="section-heading scenario-heading">
        <div><span className="eyebrow">SCENARIO STUDIO · RELEASE 0.6</span><h2>ทดลองความไม่แน่นอน ก่อนตัดสินใจจริง</h2><p>สุ่มหลายเส้นทางด้วย seed ที่รันซ้ำได้ พร้อม stress test และ sensitivity — เป็นแบบจำลอง ไม่ใช่ forecast</p></div>
        <div className={`simulation-state ${running ? 'running' : ''}`}><Activity />{running ? 'กำลังคำนวณนอกหน้าจอ…' : result ? `${result.simulations.toLocaleString('th-TH')} paths · ${result.durationMs.toFixed(0)} ms` : 'รอคำนวณ'}</div>
      </div>

      <div className="scenario-toolbar panel">
        <label><span>Stress preset</span><select value={plan.simulationConfig.stressPreset} onChange={(event) => selectPreset(event.target.value as StressPreset)}>{Object.entries(presetCopy).map(([key, copy]) => <option key={key} value={key}>{copy.label}</option>)}</select><small>{presetCopy[plan.simulationConfig.stressPreset].note}</small></label>
        <label><span>Seed</span><FormattedNumberInput min="1" max="2147483647" value={plan.simulationConfig.seed} onValueChange={(value) => updateConfig('seed', Math.max(1, value))} /><small>ใช้เลขเดิม = ได้ distribution เดิม</small></label>
        <label><span>จำนวนเส้นทาง</span><select value={plan.simulationConfig.simulations} onChange={(event) => updateConfig('simulations', Number(event.target.value))}><option value="500">500</option><option value="1000">1,000</option><option value="5000">5,000</option><option value="10000">10,000</option><option value="25000">25,000</option></select><small>ยิ่งมากยิ่งนิ่ง แต่ใช้เวลามากขึ้น</small></label>
        <button className="rerun-seed-button" onClick={() => setRerun((value) => value + 1)} disabled={running}><RefreshCw />รัน seed เดิมอีกครั้ง</button>
      </div>

      {error && <div className="scenario-error"><AlertTriangle />{error}</div>}

      <div className="simulation-metrics" role="region" aria-label="สรุปผลการจำลอง เลื่อนแนวนอนได้" tabIndex={0}>
        <article className="panel probability-card"><Gauge /><span>โอกาสถึงเป้าหมาย</span><strong>{result ? `${percent.format(result.probabilityOfSuccess)}%` : '—'}</strong><small>เป้าหมายรวม overrun {result ? money.format(result.targetWithOverrun) : '—'}</small></article>
        <article className="panel"><span>P10 · แผนเผื่อใจ</span><strong>{result ? compact.format(result.p10) : '—'}</strong><small>10% ของเส้นทางต่ำกว่าค่านี้</small></article>
        <article className="panel median-card"><span>P50 · ค่ากลาง</span><strong>{result ? compact.format(result.p50) : '—'}</strong><small>หลังเงินเฟ้อ {result ? compact.format(result.realP50) : '—'}</small></article>
        <article className="panel"><span>P90 · ด้านบวก</span><strong>{result ? compact.format(result.p90) : '—'}</strong><small>ไม่ใช่ค่าที่ควรนำไปสัญญา</small></article>
        <article className="panel sequence-card"><TimerReset /><span>ต้นทุนจาก sequence risk</span><strong>{result ? compact.format(result.sequenceRiskCost) : '—'}</strong><small>ส่วนต่างเมื่อ drawdown มาในช่วงต้นแผน</small></article>
      </div>

      <div className="scenario-main-grid">
        <article className="panel distribution-card">
          <div className="scenario-card-head"><div><FlaskConical /><span><b>Outcome range</b><small>P10 / P50 / P90 เทียบเป้าหมาย</small></span></div><b>{plan.years + plan.simulationConfig.retirementDelayYears} ปี</b></div>
          <div className="distribution-track" role="img" aria-label="ช่วงผลลัพธ์ Monte Carlo">
            {result && <><i className="p10" style={{ left: markerPosition(result.p10) }} /><i className="p50" style={{ left: markerPosition(result.p50) }} /><i className="p90" style={{ left: markerPosition(result.p90) }} /><i className="target" style={{ left: markerPosition(result.targetWithOverrun) }} /></>}
          </div>
          <div className="distribution-legend"><span><i className="p10" />P10</span><span><i className="p50" />P50</span><span><i className="p90" />P90</span><span><i className="target" />เป้าหมาย</span></div>
          <div className="comparison-grid">{result?.comparison.map((item) => <div key={item.scenario} className={item.scenario === plan.scenario ? 'active' : ''}><span>{item.label}</span><strong>{compact.format(item.finalValue)}</strong><small className={item.targetGap >= 0 ? 'positive' : 'negative'}>{item.targetGap >= 0 ? 'เกินเป้า' : 'ต่ำกว่าเป้า'} {compact.format(Math.abs(item.targetGap))}</small></div>)}</div>
        </article>

        <article className="panel sensitivity-card">
          <div className="scenario-card-head"><div><SlidersHorizontal /><span><b>Top sensitivity</b><small>3 ตัวแปรที่ขยับปลายทางมากที่สุด</small></span></div></div>
          <div className="tornado-list">{topImpact.map((item, index) => <div key={item.key}><span><b>0{index + 1}</b>{item.label}</span><i><b style={{ width: `${item.impact / maxImpact * 100}%` }} /></i><small>{compact.format(item.downside)} → {compact.format(item.upside)}</small></div>)}</div>
        </article>
      </div>

      <details className="panel scenario-assumptions" open>
        <summary><SlidersHorizontal />สมมติฐานที่ใช้คำนวณ <small>แก้ไขได้ทุกค่า</small></summary>
        <div className="assumption-grid">
          <label>ผลตอบแทนเฉลี่ย %<FormattedNumberInput step="0.1" value={plan.simulationConfig.expectedReturn} onValueChange={(value) => updateConfig('expectedReturn', value)} /></label>
          <label>ความผันผวน %<FormattedNumberInput step="0.5" value={plan.simulationConfig.volatility} onValueChange={(value) => updateConfig('volatility', value)} /></label>
          <label>Equity/Bond correlation<FormattedNumberInput min="-1" max="1" step="0.05" value={plan.simulationConfig.equityBondCorrelation} onValueChange={(value) => updateConfig('equityBondCorrelation', value)} /></label>
          <label>เงินเฟ้อเฉลี่ย %<FormattedNumberInput step="0.1" value={plan.simulationConfig.inflationMean} onValueChange={(value) => updateConfig('inflationMean', value)} /></label>
          <label>ความผันผวนเงินเฟ้อ %<FormattedNumberInput step="0.1" value={plan.simulationConfig.inflationVolatility} onValueChange={(value) => updateConfig('inflationVolatility', value)} /></label>
          <label>ความผันผวน FX %<FormattedNumberInput step="0.5" value={plan.simulationConfig.fxVolatility} onValueChange={(value) => updateConfig('fxVolatility', value)} /></label>
          <label>พัก DCA (เดือน)<FormattedNumberInput min="0" value={plan.simulationConfig.contributionPauseMonths} onValueChange={(value) => updateConfig('contributionPauseMonths', value)} /></label>
          <label>เลื่อนเกษียณ (ปี)<FormattedNumberInput min="0" value={plan.simulationConfig.retirementDelayYears} onValueChange={(value) => updateConfig('retirementDelayYears', value)} /></label>
          <label>ราคาบ้านเกินงบ %<FormattedNumberInput min="0" value={plan.simulationConfig.homeOverrunPercent} onValueChange={(value) => updateConfig('homeOverrunPercent', value)} /></label>
          <label>Drawdown ช่วงต้น %<FormattedNumberInput min="0" value={plan.simulationConfig.earlyDrawdownPercent} onValueChange={(value) => updateConfig('earlyDrawdownPercent', value, true)} /></label>
          <label>ใช้เวลาฟื้น (ปี)<FormattedNumberInput min="0" value={plan.simulationConfig.recoveryYears} onValueChange={(value) => updateConfig('recoveryYears', value, true)} /></label>
          <label>Equity shock %<FormattedNumberInput value={plan.simulationConfig.equityShock} onValueChange={(value) => updateConfig('equityShock', value, true)} /></label>
          <label>Rate shock %<FormattedNumberInput step="0.1" value={plan.simulationConfig.rateShock} onValueChange={(value) => updateConfig('rateShock', value, true)} /></label>
          <label>Inflation shock %<FormattedNumberInput step="0.1" value={plan.simulationConfig.inflationShock} onValueChange={(value) => updateConfig('inflationShock', value, true)} /></label>
          <label>FX shock %<FormattedNumberInput step="0.5" value={plan.simulationConfig.fxShock} onValueChange={(value) => updateConfig('fxShock', value, true)} /></label>
          <label>รายได้ลดลง %<FormattedNumberInput min="0" value={plan.simulationConfig.incomeLossPercent} onValueChange={(value) => updateConfig('incomeLossPercent', value, true)} /></label>
          <label>รายได้สะดุด (เดือน)<FormattedNumberInput min="0" value={plan.simulationConfig.incomeLossMonths} onValueChange={(value) => updateConfig('incomeLossMonths', value, true)} /></label>
          <label>ค่ารักษาพยาบาล/ปี<FormattedNumberInput min="0" step="10000" value={plan.simulationConfig.healthcareCostAnnual} onValueChange={(value) => updateConfig('healthcareCostAnnual', value, true)} /></label>
        </div>
      </details>

      <div className="scenario-warnings">{(result?.warnings ?? []).map((warning) => <p key={warning}><AlertTriangle />{warning}</p>)}</div>
    </section>
  )
}
