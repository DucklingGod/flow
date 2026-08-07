import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp, ArrowUpRight, BarChart3, BookOpenCheck,
  Calculator, CircleGauge, Compass, Database, DatabaseBackup, Flag, Goal, Info, Landmark,
  FlaskConical, LayoutGrid, PiggyBank, Plus, ReceiptText, RotateCcw, Save, ShieldCheck, Sparkles, Target, Trash2, WalletCards,
} from 'lucide-react'
import './App.css'
import { calculateProjection, calculateWealthMetrics } from './domain/finance/projection'
import { defaultPlan, type Scenario, type WealthPlan } from './domain/schema'
import { loadPlan, resetPlan, savePlan } from './data/planRepository'
import { browserUsageMetrics } from './data/usageMetrics'
import { CalculationModelNotice } from './components/CalculationModelNotice'
import { releaseFlags } from './config/releaseFlags'
import { ProjectionChart } from './components/ProjectionChart'
import { FormattedNumberInput } from './components/FormattedNumberInput'

const WealthStudio = lazy(() => import('./components/WealthStudio').then((module) => ({ default: module.WealthStudio })))
const LifeCanvas = lazy(() => import('./components/LifeCanvas').then((module) => ({ default: module.LifeCanvas })))
const PortfolioStudio = lazy(() => import('./components/PortfolioStudio').then((module) => ({ default: module.PortfolioStudio })))
const ScenarioStudio = lazy(() => import('./components/ScenarioStudio').then((module) => ({ default: module.ScenarioStudio })))
const RetirementStudio = lazy(() => import('./components/RetirementStudio').then((module) => ({ default: module.RetirementStudio })))
const ProtectionStudio = lazy(() => import('./components/ProtectionStudio').then((module) => ({ default: module.ProtectionStudio })))
const TaxStudio = lazy(() => import('./components/TaxStudio').then((module) => ({ default: module.TaxStudio })))
const LegacyStudio = lazy(() => import('./components/LegacyStudio').then((module) => ({ default: module.LegacyStudio })))
const DataStudio = lazy(() => import('./components/DataStudio').then((module) => ({ default: module.DataStudio })))
const WealthReviewStudio = lazy(() => import('./components/WealthReviewStudio').then((module) => ({ default: module.WealthReviewStudio })))
const PlanVault = lazy(() => import('./components/PlanVault').then((module) => ({ default: module.PlanVault })))

const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })

type ViewId = 'studio' | 'wealth' | 'life' | 'portfolio' | 'scenario' | 'retirement' | 'protection' | 'tax' | 'legacy' | 'data' | 'reviews' | 'vault' | 'more'

const viewMeta: Record<ViewId, { label: string; eyebrow: string; description: string }> = {
  studio: { label: 'Studio', eyebrow: 'STUDIO VIEW', description: 'ภาพรวมแผนและสมมติฐานหลัก' },
  wealth: { label: 'Wealth Map', eyebrow: 'WEALTH MAP', description: 'ทรัพย์สิน หนี้สิน และกระแสเงินสด' },
  life: { label: 'Life Canvas', eyebrow: 'LIFE CANVAS', description: 'จัดลำดับและติดตามทุกเป้าหมายชีวิต' },
  portfolio: { label: 'Portfolio X-Ray', eyebrow: 'PORTFOLIO X-RAY', description: 'ดู holdings, exposure, fee และความเสี่ยงจริง' },
  scenario: { label: 'Scenario Studio', eyebrow: 'SCENARIO STUDIO', description: 'Monte Carlo, stress test และ sensitivity' },
  retirement: { label: 'Retirement', eyebrow: 'RETIREMENT STUDIO', description: 'เตรียม cash-flow หลังเกษียณ' },
  protection: { label: 'Protection Gap', eyebrow: 'PROTECTION STUDIO', description: 'เงินสำรอง ชีวิต สุขภาพ และรายได้เมื่อทุพพลภาพ' },
  tax: { label: 'Thailand Tax', eyebrow: 'TAX STUDIO', description: 'ภาษีรายปีและสิทธิลดหย่อนแบบมี version' },
  legacy: { label: 'Family & Legacy', eyebrow: 'LEGACY STUDIO', description: 'ผู้รับผลประโยชน์ เอกสาร และแผนครอบครัว' },
  data: { label: 'Data Studio', eyebrow: 'DATA PLATFORM', description: 'แหล่งข้อมูล วันที่ ความสด และสิทธิ์ใช้งาน' },
  reviews: { label: 'Wealth Review', eyebrow: 'WEALTH REVIEW', description: 'ทบทวนแผนและข้อเสนอที่รออนุมัติ' },
  vault: { label: 'Plan Vault', eyebrow: 'DATA & PRIVACY', description: 'สำรอง ย้อนเวอร์ชัน และลบข้อมูล local' },
  more: { label: 'เพิ่มเติม', eyebrow: 'MORE STUDIOS', description: 'เลือกเครื่องมือวางแผนเพิ่มเติม' },
}

const viewIds = Object.keys(viewMeta) as ViewId[]
const planningViews: ViewId[] = ['retirement', 'protection', 'tax', 'legacy']
const viewFromLocation = (): ViewId => {
  const hash = window.location.hash.replace('#/', '').replace('#', '') as ViewId
  return viewIds.includes(hash) ? hash : 'studio'
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>
}

const scenarioCopy: Record<Scenario, { label: string; note: string }> = {
  bear: { label: 'Bear', note: 'ผลตอบแทนต่ำกว่าฐาน 3.2%' },
  base: { label: 'Base', note: 'สมมติฐานหลักของแผน' },
  bull: { label: 'Bull', note: 'ผลตอบแทนสูงกว่าฐาน 2.3%' },
}

const scenarioShiftText = (scenario: Scenario) => scenario === 'bear' ? '− 3.2%' : scenario === 'bull' ? '+ 2.3%' : '+ 0%'

function App() {
  const [plan, setPlan] = useState<WealthPlan>(defaultPlan)
  const [loaded, setLoaded] = useState(false)
  const [saveState, setSaveState] = useState<'saved' | 'saving'>('saved')
  const [activeView, setActiveView] = useState<ViewId>(viewFromLocation)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [navigationPending, setNavigationPending] = useState(false)
  const [navigationFeedbackKey, setNavigationFeedbackKey] = useState(0)
  const navigationTimer = useRef<number | null>(null)
  const showNavigationFeedback = () => {
    if (navigationTimer.current !== null) window.clearTimeout(navigationTimer.current)
    setNavigationFeedbackKey((current) => current + 1)
    setNavigationPending(true)
    navigationTimer.current = window.setTimeout(() => { setNavigationPending(false); navigationTimer.current = null }, 420)
  }

  useEffect(() => { loadPlan().then((stored) => { setPlan(stored); setLoaded(true) }) }, [])
  useEffect(() => {
    if (!loaded) return
    setSaveState('saving')
    const timer = window.setTimeout(() => savePlan(plan).then(() => setSaveState('saved')), 450)
    return () => window.clearTimeout(timer)
  }, [plan, loaded])
  useEffect(() => {
    const syncView = () => { showNavigationFeedback(); setActiveView(viewFromLocation()); window.scrollTo({ top: 0 }) }
    window.addEventListener('popstate', syncView)
    window.addEventListener('hashchange', syncView)
    return () => { window.removeEventListener('popstate', syncView); window.removeEventListener('hashchange', syncView) }
  }, [])
  useEffect(() => () => { if (navigationTimer.current !== null) window.clearTimeout(navigationTimer.current) }, [])
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 420)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => { document.title = `${viewMeta[activeView].label} · Flow Wealth Studio` }, [activeView])
  useEffect(() => { void browserUsageMetrics.record(activeView, 'routeViewed') }, [activeView])

  const projection = useMemo(() => calculateProjection(plan), [plan])
  const wealth = useMemo(() => calculateWealthMetrics(plan), [plan])
  const update = <K extends keyof WealthPlan>(key: K, value: WealthPlan[K]) => setPlan((current) => ({ ...current, [key]: value }))
  const addIrregularCashFlow = () => setPlan((current) => ({ ...current, irregularCashFlows: [...current.irregularCashFlows, { id: crypto.randomUUID(), month: Math.min(current.years * 12, 12), amount: 100_000 }] }))
  const updateIrregularCashFlow = (id: string, key: 'month' | 'amount', value: number) => setPlan((current) => ({ ...current, irregularCashFlows: current.irregularCashFlows.map((flow) => flow.id === id ? { ...flow, [key]: Math.max(key === 'month' ? 1 : 0, value) } : flow) }))
  const removeIrregularCashFlow = (id: string) => setPlan((current) => ({ ...current, irregularCashFlows: current.irregularCashFlows.filter((flow) => flow.id !== id) }))
  const openView = (view: ViewId) => {
    if (activeView !== view) {
      showNavigationFeedback()
      window.history.pushState({ view }, '', `#/${view}`)
    }
    setActiveView(view)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const actions = [
    { icon: Target, title: projection.fundingGap > 0 ? (plan.investmentMode === 'dca' ? `เพิ่ม DCA อีก ${money.format(Math.max(0, projection.requiredMonthly - plan.monthlyContribution))}` : `เพิ่มเงินก้อนอีก ${money.format(Math.max(0, projection.requiredInitial - plan.initialInvestment))}`) : 'เป้าหมายมีเงินรองรับแล้ว', detail: projection.fundingGap > 0 ? `เพื่อปิดช่องว่าง ${money.format(projection.fundingGap)} ภายใน ${plan.years} ปี` : 'ทบทวนความเสี่ยงและสมมติฐานอย่างน้อยปีละครั้ง', tone: 'lime', view: 'studio' as ViewId },
    { icon: ShieldCheck, title: wealth.emergencyMonths < 6 ? 'เติมเงินสำรองให้ครบ 6 เดือน' : 'เงินสำรองอยู่ในระดับพร้อม', detail: `ปัจจุบันรองรับค่าใช้จ่ายได้ ${wealth.emergencyMonths.toFixed(1)} เดือน`, tone: 'blue', view: 'wealth' as ViewId },
    { icon: CircleGauge, title: 'ตรวจความเสี่ยงพอร์ต', detail: 'เปิด Portfolio X-Ray เพื่อดู concentration, fee drag และ risk contribution', tone: 'peach', view: 'portfolio' as ViewId },
  ]

  return (
    <div className="app-shell">
      {navigationPending && <div key={navigationFeedbackKey} className="navigation-feedback" role="status" aria-live="polite"><i /><span><b />กำลังเปิด {viewMeta[activeView].label}</span></div>}
      <aside className="sidebar">
        <div className="brand"><img src="/flow-logo-optimized.png" alt="Flow Wealth Studio" /><div><strong>flow.</strong><small>wealth studio</small></div></div>
        <nav aria-label="เมนูหลัก">
          <button className={activeView === 'studio' ? 'active' : ''} aria-current={activeView === 'studio' ? 'page' : undefined} onClick={() => openView('studio')}><Compass />Studio View</button>
          <button className={activeView === 'wealth' ? 'active' : ''} aria-current={activeView === 'wealth' ? 'page' : undefined} onClick={() => openView('wealth')}><WalletCards />Wealth Map</button>
          <button className={activeView === 'life' ? 'active' : ''} aria-current={activeView === 'life' ? 'page' : undefined} onClick={() => openView('life')}><Flag />Life Canvas</button>
          <button className={activeView === 'portfolio' ? 'active' : ''} aria-current={activeView === 'portfolio' ? 'page' : undefined} onClick={() => openView('portfolio')}><BarChart3 />Portfolio X-Ray</button>
          <button className={activeView === 'scenario' ? 'active' : ''} aria-current={activeView === 'scenario' ? 'page' : undefined} onClick={() => openView('scenario')}><FlaskConical />Scenario Studio</button>
          <button className={planningViews.includes(activeView) ? 'active' : ''} aria-current={planningViews.includes(activeView) ? 'page' : undefined} onClick={() => openView('retirement')}><Landmark />Retirement</button>
          <button className={activeView === 'data' ? 'active' : ''} aria-current={activeView === 'data' ? 'page' : undefined} onClick={() => openView('data')}><Database />Data Studio</button>
          <button className={activeView === 'reviews' ? 'active' : ''} aria-current={activeView === 'reviews' ? 'page' : undefined} onClick={() => openView('reviews')}><BookOpenCheck />Wealth Review</button>
          <button className={activeView === 'vault' ? 'active' : ''} aria-current={activeView === 'vault' ? 'page' : undefined} onClick={() => openView('vault')}><DatabaseBackup />Plan Vault</button>
        </nav>
        <div className="sidebar-note"><Sparkles /><strong>Design wealth.<br />Live with clarity.</strong><p>ทุกตัวเลขคือแบบจำลอง ไม่ใช่การรับประกันผลตอบแทน</p></div>
      </aside>

      <main>
        {loaded && releaseFlags.calculationModelUpdates && <CalculationModelNotice plan={plan} setPlan={setPlan} />}
        {activeView !== 'studio' && <header className="view-toolbar panel"><div><span className="eyebrow">{viewMeta[activeView].eyebrow}</span><strong>{viewMeta[activeView].label}</strong><p>{viewMeta[activeView].description}</p></div><div className="top-actions"><span className={`save-status ${saveState}`}><Database />{saveState === 'saving' ? 'กำลังบันทึก' : 'บันทึกในเครื่องแล้ว'}</span><button className="icon-button" onClick={async () => setPlan(await resetPlan())} title="เริ่มแผนใหม่"><RotateCcw /></button><button className="primary-button" onClick={() => savePlan(plan).then(() => setSaveState('saved'))}><Save />บันทึกแผน</button></div></header>}

        {planningViews.includes(activeView) && <nav className="planning-suite-nav" aria-label="เครื่องมือวางแผนชีวิต"><button className={activeView === 'retirement' ? 'active' : ''} aria-current={activeView === 'retirement' ? 'page' : undefined} onClick={() => openView('retirement')}><Landmark />Retirement</button><button className={activeView === 'protection' ? 'active' : ''} aria-current={activeView === 'protection' ? 'page' : undefined} onClick={() => openView('protection')}><ShieldCheck />Protection</button><button className={activeView === 'tax' ? 'active' : ''} aria-current={activeView === 'tax' ? 'page' : undefined} onClick={() => openView('tax')}><ReceiptText />Tax</button><button className={activeView === 'legacy' ? 'active' : ''} aria-current={activeView === 'legacy' ? 'page' : undefined} onClick={() => openView('legacy')}><BookOpenCheck />Legacy</button></nav>}

        {activeView === 'studio' && <>
        <header className="topbar" id="studio">
          <div className="banner-copy"><span className="eyebrow">PERSONAL WEALTH OPERATING SYSTEM</span><h1>ออกแบบความมั่งคั่ง<br /><em>ให้ไปพร้อมกับชีวิต</em></h1><p>เห็นภาพวันนี้ ทดลองอนาคต และเลือกสิ่งที่ควรทำต่อจากข้อมูลชุดเดียว</p></div>
          <div className="top-actions"><span className={`save-status ${saveState}`}><Database />{saveState === 'saving' ? 'กำลังบันทึก' : 'บันทึกในเครื่องแล้ว'}</span><button className="icon-button" onClick={async () => setPlan(await resetPlan())} title="เริ่มแผนใหม่"><RotateCcw /></button><button className="primary-button" onClick={() => savePlan(plan).then(() => setSaveState('saved'))}><Save />บันทึกแผน</button></div>
        </header>

        <section className="scenario-strip" aria-label="สถานการณ์จำลอง">
          <div><span className="eyebrow">SCENARIO STUDIO</span><strong>ลองอนาคตก่อนตัดสินใจ</strong></div>
          <div className="scenario-buttons">{(['bear', 'base', 'bull'] as Scenario[]).map((scenario) => <button key={scenario} className={plan.scenario === scenario ? 'active' : ''} aria-pressed={plan.scenario === scenario} onClick={() => update('scenario', scenario)}><span>{scenarioCopy[scenario].label}</span><small>{scenarioCopy[scenario].note}</small></button>)}</div>
        </section>

        <section className="studio-grid">
          <article className="panel projection-panel">
            <div className="panel-head"><div><span className="eyebrow">GOAL PROJECTION</span><h2>เงินของคุณอาจเติบโตเป็น</h2></div><div className="return-orb"><strong>{projection.netAnnualReturn.toFixed(1)}%</strong><span>สุทธิ/ปี</span></div></div>
            <div className="hero-number">{money.format(projection.futureValue)}</div>
            <div className="goal-progress"><div><span>ความคืบหน้าเป้าหมาย</span><strong>{projection.progress.toFixed(0)}%</strong></div><div className="progress-track"><i style={{ width: `${projection.progress}%` }} /></div></div>
            <ProjectionChart points={projection.points} />
            <div className="metric-grid"><Metric label="เงินต้นสะสม" value={money.format(projection.contributed)} /><Metric label="ผลตอบแทนสุทธิ" value={money.format(projection.investmentGrowth)} /><Metric label="มูลค่าจริง" value={money.format(projection.realValue)} note={`หักเงินเฟ้อ ${plan.inflation}%`} /><Metric label="ปันผลต่อปีปลายทาง" value={money.format(projection.annualDividendAtGoal)} note={`หลังภาษีปันผล ${plan.dividendTaxRate}%`} /></div>
            <div className="audit-strip">
              <div><span>ก่อนค่าธรรมเนียม</span><strong>{money.format(projection.grossFutureValue)}</strong></div>
              <div><span>หลังค่าธรรมเนียม</span><strong>{money.format(projection.afterFeeFutureValue)}</strong><small>fee drag {money.format(projection.feeDrag)}</small></div>
              <div><span>หลังภาษีปันผล</span><strong>{money.format(projection.futureValue)}</strong><small>tax drag {money.format(projection.taxDrag)}</small></div>
            </div>
            <details className="formula-card">
              <summary><Info /> เปิดดูสูตรและสมมติฐานที่ใช้</summary>
              <div className="formula-grid">
                <p><strong>ผลตอบแทนรวม</strong><span>{plan.expectedReturn}% ฐาน {scenarioShiftText(plan.scenario)} + FX {projection.fxImpact.toFixed(2)}%</span></p>
                <p><strong>ผลตอบแทนหลัง fee/tax</strong><span>หัก fee {plan.annualFee}% และภาษีปันผล {plan.dividendTaxRate}% ก่อนทบต้น</span></p>
                <p><strong>จังหวะเงินลงทุน</strong><span>{plan.investmentMode === 'lumpSum' ? 'เงินก้อนครั้งเดียว' : `DCA ${plan.contributionTiming === 'beginning' ? 'ต้นเดือน' : 'ปลายเดือน'}`}</span></p>
                <p><strong>Convention</strong><span>แปลง APY เป็นอัตรารายเดือนด้วย (1+r)^(1/12)-1 และไม่ปัดเศษระหว่างคำนวณ · {projection.modelVersion}</span></p>
              </div>
            </details>
          </article>

          <aside className="panel controls-panel">
            <div className="panel-head compact"><div><span className="eyebrow">ASSUMPTIONS</span><h2>ตั้งค่าแผน</h2></div><span className="source-chip">คุณกำหนดเอง</span></div>
            <div className="mode-control" role="group" aria-label="รูปแบบการลงทุน">
              <button className={plan.investmentMode === 'dca' ? 'active' : ''} aria-pressed={plan.investmentMode === 'dca'} onClick={() => update('investmentMode', 'dca')}>DCA รายเดือน</button>
              <button className={plan.investmentMode === 'lumpSum' ? 'active' : ''} aria-pressed={plan.investmentMode === 'lumpSum'} onClick={() => update('investmentMode', 'lumpSum')}>ลงทุนเงินก้อน</button>
            </div>
            <label>เงินลงทุนเริ่มต้น<span>บาท</span><FormattedNumberInput value={plan.initialInvestment} onValueChange={(value) => update('initialInvestment', value)} /></label>
            {plan.investmentMode === 'dca' && <label>ลงทุนทุกเดือน<span>บาท/เดือน</span><FormattedNumberInput value={plan.monthlyContribution} onValueChange={(value) => update('monthlyContribution', value)} /></label>}
            {plan.investmentMode === 'dca' && <div className="timing-control" role="group" aria-label="จังหวะ DCA"><span>จังหวะ DCA</span><button className={plan.contributionTiming === 'beginning' ? 'active' : ''} aria-pressed={plan.contributionTiming === 'beginning'} onClick={() => update('contributionTiming', 'beginning')}>ต้นเดือน</button><button className={plan.contributionTiming === 'end' ? 'active' : ''} aria-pressed={plan.contributionTiming === 'end'} onClick={() => update('contributionTiming', 'end')}>ปลายเดือน</button></div>}
            <label>ระยะเวลา<span>{plan.years} ปี</span><input type="range" min="1" max="50" value={plan.years} onChange={(event) => update('years', Number(event.target.value))} /></label>
            <div className="two-fields"><label>ผลตอบแทนฐาน<span>%/ปี</span><FormattedNumberInput step="0.1" value={plan.expectedReturn} onValueChange={(value) => update('expectedReturn', value)} /></label><label>ค่าธรรมเนียม<span>%/ปี</span><FormattedNumberInput step="0.1" value={plan.annualFee} onValueChange={(value) => update('annualFee', value)} /></label></div>
            <div className="two-fields"><label>เงินเฟ้อ<span>%/ปี</span><FormattedNumberInput step="0.1" value={plan.inflation} onValueChange={(value) => update('inflation', value)} /></label><label>ปันผล<span>%/ปี</span><FormattedNumberInput step="0.1" value={plan.dividendYield} onValueChange={(value) => update('dividendYield', value)} /></label></div>
            <div className="mode-control dividend-control" role="group" aria-label="วิธีรับเงินปันผล"><button className={plan.dividendMode === 'reinvest' ? 'active' : ''} aria-pressed={plan.dividendMode === 'reinvest'} onClick={() => update('dividendMode', 'reinvest')}>ทบกลับลงทุน</button><button className={plan.dividendMode === 'cash' ? 'active' : ''} aria-pressed={plan.dividendMode === 'cash'} onClick={() => update('dividendMode', 'cash')}>รับเป็นเงินสด</button></div>
            <details className="advanced-controls">
              <summary><Calculator /> สมมติฐานขั้นสูง</summary>
              <div className="two-fields"><label>ภาษีปันผล<span>%</span><FormattedNumberInput step="1" value={plan.dividendTaxRate} onValueChange={(value) => update('dividendTaxRate', value)} /></label><label>สัดส่วนต่างประเทศ<span>%</span><FormattedNumberInput step="1" value={plan.foreignAllocation} onValueChange={(value) => update('foreignAllocation', value)} /></label></div>
              <div className="two-fields"><label>ค่าเงินต่อปี<span>%</span><FormattedNumberInput step="0.1" value={plan.fxAnnualChange} onValueChange={(value) => update('fxAnnualChange', value)} /></label><label>ดอกเบี้ยฝากประจำ<span>%</span><FormattedNumberInput step="0.1" value={plan.depositRate} onValueChange={(value) => update('depositRate', value)} /></label></div>
              <label>ภาษีดอกเบี้ยเงินฝาก<span>%</span><FormattedNumberInput step="1" value={plan.depositInterestTaxRate} onValueChange={(value) => update('depositInterestTaxRate', value)} /></label>
              <div className="irregular-head"><span>เงินลงทุนพิเศษตามเดือน</span><button onClick={addIrregularCashFlow}><Plus /> เพิ่มรายการ</button></div>
              <div className="irregular-list">
                {plan.irregularCashFlows.map((flow) => <div className="irregular-row" key={flow.id}><label>เดือนที่<FormattedNumberInput aria-label="เดือนของเงินลงทุนพิเศษ" min="1" max={plan.years * 12} value={flow.month} onValueChange={(value) => updateIrregularCashFlow(flow.id, 'month', value)} /></label><label>จำนวนเงิน<FormattedNumberInput aria-label="จำนวนเงินลงทุนพิเศษ" min="0" value={flow.amount} onValueChange={(value) => updateIrregularCashFlow(flow.id, 'amount', value)} /></label><button className="remove-flow" onClick={() => removeIrregularCashFlow(flow.id)} aria-label="ลบเงินลงทุนพิเศษ"><Trash2 /></button></div>)}
                {plan.irregularCashFlows.length === 0 && <p className="empty-flow">ยังไม่มีเงินโบนัสหรือเงินลงทุนพิเศษในแผน</p>}
              </div>
            </details>
            <div className="target-box"><Goal /><div><span>เป้าหมายปลายทาง</span><FormattedNumberInput aria-label="เป้าหมายปลายทาง" value={plan.targetAmount} onValueChange={(value) => update('targetAmount', value)} /></div></div>
            <div className="reverse-result"><span>{plan.investmentMode === 'dca' ? 'เพื่อให้ถึงเป้าหมาย ควร DCA' : 'เงินก้อนที่ควรมีวันนี้'}</span><strong>{money.format(plan.investmentMode === 'dca' ? projection.requiredMonthly : projection.requiredInitial)}<small>{plan.investmentMode === 'dca' ? '/เดือน' : ''}</small></strong><div className="reverse-meta"><span>คาดว่าจะถึงเป้าหมาย</span><b>{projection.targetDateLabel}</b></div><p>คำนวณจาก {scenarioCopy[plan.scenario].label} scenario หลังค่าธรรมเนียมและภาษีปันผล ไม่ใช่การรับประกันผลลัพธ์</p></div>
          </aside>
        </section>

        <section className="deposit-comparison panel" aria-label="เปรียบเทียบกับเงินฝากประจำ">
          <div className="deposit-copy"><PiggyBank /><div><span className="eyebrow">FIXED DEPOSIT BENCHMARK</span><h2>ถ้านำเงินชุดเดียวกันไปฝากประจำ</h2><p>ใช้ดอกเบี้ย {plan.depositRate}% และหักภาษีดอกเบี้ย {plan.depositInterestTaxRate}% ตามสมมติฐานของคุณ</p></div></div>
          <div className="deposit-values"><Metric label="เงินฝากสุทธิปลายทาง" value={money.format(projection.depositNetFutureValue)} /><Metric label="ดอกเบี้ยก่อนภาษี" value={money.format(projection.depositGrossFutureValue - projection.contributed)} /><Metric label={projection.depositDifference >= 0 ? 'พอร์ตมากกว่า' : 'เงินฝากมากกว่า'} value={money.format(Math.abs(projection.depositDifference))} /></div>
          <div className="comparison-note"><ReceiptText /><span>เปรียบเทียบด้วยเงินต้น จังหวะฝาก และระยะเวลาเดียวกัน โดยไม่รวมเงื่อนไขถอนก่อนกำหนดหรือการคุ้มครองเงินฝาก</span></div>
        </section>
        </>}

        <Suspense fallback={<section className="panel route-loading" role="status"><i /><span>กำลังเปิดเครื่องมือวางแผน…</span></section>}>
        {activeView === 'wealth' && <WealthStudio plan={plan} setPlan={setPlan} />}

        {activeView === 'life' && <LifeCanvas plan={plan} setPlan={setPlan} />}

        {activeView === 'portfolio' && <PortfolioStudio plan={plan} setPlan={setPlan} />}

        {activeView === 'scenario' && <ScenarioStudio plan={plan} setPlan={setPlan} />}

        {activeView === 'studio' && <section className="action-section" id="next-actions">
          <div className="action-intro"><span className="eyebrow light">NEXT BEST ACTION</span><h2>เดือนนี้ควรทำอะไรต่อ</h2><p>ข้อเสนอแนะเรียงจากผลกระทบต่อแผน โดยยังไม่มีการซื้อขายหรือเปลี่ยนพอร์ตอัตโนมัติ</p></div>
          <div className="action-list">{actions.map(({ icon: Icon, title, detail, tone, view }, index) => <button key={title} onClick={() => openView(view)}><span className={`action-icon ${tone}`}><Icon /></span><span><small>0{index + 1}</small><strong>{title}</strong><em>{detail}</em></span><ArrowUpRight /></button>)}</div>
        </section>}

        {activeView === 'retirement' && <RetirementStudio plan={plan} setPlan={setPlan} />}

        {activeView === 'protection' && <ProtectionStudio plan={plan} setPlan={setPlan} />}

        {activeView === 'tax' && <TaxStudio plan={plan} setPlan={setPlan} />}

        {activeView === 'legacy' && <LegacyStudio plan={plan} setPlan={setPlan} />}

        {activeView === 'data' && <DataStudio plan={plan} setPlan={setPlan} />}

        {activeView === 'reviews' && <WealthReviewStudio plan={plan} setPlan={setPlan} />}

        {activeView === 'vault' && <PlanVault plan={plan} setPlan={setPlan} />}
        </Suspense>

        {activeView === 'more' && <section className="more-hub"><div className="section-heading"><span className="eyebrow">MORE STUDIOS</span><h2>เครื่องมือวางแผนเพิ่มเติม</h2></div><div className="more-grid"><button className="panel" onClick={() => openView('scenario')}><FlaskConical /><span><strong>Scenario Studio</strong><small>Monte Carlo และ stress test</small></span><ArrowUpRight /></button><button className="panel" onClick={() => openView('retirement')}><Landmark /><span><strong>Retirement</strong><small>กระแสเงินสดหลังเกษียณ</small></span><ArrowUpRight /></button><button className="panel" onClick={() => openView('protection')}><ShieldCheck /><span><strong>Protection Gap</strong><small>เงินสำรองและความคุ้มครอง</small></span><ArrowUpRight /></button><button className="panel" onClick={() => openView('tax')}><ReceiptText /><span><strong>Thailand Tax</strong><small>ภาษีและสิทธิลดหย่อนรายปี</small></span><ArrowUpRight /></button><button className="panel" onClick={() => openView('legacy')}><BookOpenCheck /><span><strong>Family & Legacy</strong><small>เช็กลิสต์ครอบครัวและเอกสาร</small></span><ArrowUpRight /></button><button className="panel" onClick={() => openView('data')}><Database /><span><strong>Data Studio</strong><small>แหล่งข้อมูล ความสด และสิทธิ์ใช้งาน</small></span><ArrowUpRight /></button><button className="panel" onClick={() => openView('reviews')}><Sparkles /><span><strong>Wealth Review</strong><small>ทบทวนและอนุมัติคำแนะนำ</small></span><ArrowUpRight /></button><button className="panel" onClick={() => openView('vault')}><DatabaseBackup /><span><strong>Plan Vault</strong><small>backup, version history และ privacy controls</small></span><ArrowUpRight /></button></div></section>}

        <footer><div><img src="/flow-logo-optimized.png" alt="" /><strong>Flow Wealth Studio</strong></div><p>Planning prototype · ผลลัพธ์เป็นแบบจำลองจากสมมติฐานที่ผู้ใช้กำหนด ไม่ใช่คำแนะนำการลงทุนหรือการรับประกันผลตอบแทน</p></footer>
      </main>

      <nav className="mobile-bottom-nav" aria-label="เมนูแอปบนมือถือ"><button className={activeView === 'studio' ? 'active' : ''} aria-current={activeView === 'studio' ? 'page' : undefined} onClick={() => openView('studio')}><Compass /><span>Studio</span></button><button className={activeView === 'wealth' ? 'active' : ''} aria-current={activeView === 'wealth' ? 'page' : undefined} onClick={() => openView('wealth')}><WalletCards /><span>Wealth</span></button><button className={activeView === 'life' ? 'active' : ''} aria-current={activeView === 'life' ? 'page' : undefined} onClick={() => openView('life')}><Flag /><span>Goals</span></button><button className={activeView === 'portfolio' ? 'active' : ''} aria-current={activeView === 'portfolio' ? 'page' : undefined} onClick={() => openView('portfolio')}><BarChart3 /><span>Portfolio</span></button><button className={['more', 'scenario', 'retirement', 'protection', 'tax', 'legacy', 'data', 'reviews', 'vault'].includes(activeView) ? 'active' : ''} aria-current={['more', 'scenario', 'retirement', 'protection', 'tax', 'legacy', 'data', 'reviews', 'vault'].includes(activeView) ? 'page' : undefined} onClick={() => openView('more')}><LayoutGrid /><span>More</span></button></nav>
      {showBackToTop && <button className="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><ArrowUp /><span>กลับด้านบน</span></button>}
    </div>
  )
}

export default App
