import { useMemo } from 'react'
import { AlertTriangle, HeartPulse, Home, ShieldCheck, Stethoscope, UsersRound, WalletCards } from 'lucide-react'
import { calculateProtection } from '../domain/protection'
import { migratePlan, type WealthPlan } from '../domain/schema'
import { FormattedNumberInput } from './FormattedNumberInput'

const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 2 })

export function ProtectionStudio({ plan, setPlan }: { plan: WealthPlan; setPlan: React.Dispatch<React.SetStateAction<WealthPlan>> }) {
  const normalizedPlan = plan.protectionConfig ? plan : migratePlan(plan)
  const config = normalizedPlan.protectionConfig
  const result = useMemo(() => calculateProtection(normalizedPlan), [normalizedPlan])
  const update = <K extends keyof WealthPlan['protectionConfig']>(key: K, value: WealthPlan['protectionConfig'][K]) => {
    setPlan((current) => {
      const migrated = current.protectionConfig ? current : migratePlan(current)
      return { ...migrated, protectionConfig: { ...migrated.protectionConfig, [key]: value } }
    })
  }
  const gapCards = [
    { icon: WalletCards, label: 'เงินสำรองฉุกเฉิน', gap: result.emergencyReserveGap, target: result.emergencyReserveTarget, existing: result.availableEmergencyCash, unit: 'เงินก้อน' },
    { icon: ShieldCheck, label: 'Life coverage', gap: result.lifeCoverageGap, target: result.lifeCoverageNeed, existing: config.existingLifeCover, unit: 'เงินก้อน' },
    { icon: Stethoscope, label: 'Health annual limit', gap: result.healthAnnualGap, target: result.healthAnnualTarget, existing: config.existingHealthAnnualLimit, unit: 'ต่อปี' },
    { icon: HeartPulse, label: 'Disability income', gap: result.disabilityMonthlyGap, target: result.disabilityMonthlyTarget, existing: config.existingDisabilityMonthlyBenefit, unit: 'ต่อเดือน' },
  ]

  return (
    <section className={`content-section protection-studio ${config.enabled ? 'enabled' : 'locked'}`} id="protection-studio">
      <div className="section-heading protection-heading"><div><span className="eyebrow">PROTECTION GAP · RELEASE 0.7</span><h2>ปกป้องแผน ก่อนเร่งให้พอร์ตเติบโต</h2><p>แยกเงินสำรอง ชีวิต สุขภาพ และรายได้เมื่อทุพพลภาพ เพื่อให้แต่ละช่องว่างตรวจสอบได้โดยไม่ผูกกับผลิตภัณฑ์</p></div><span className="expert-lock"><ShieldCheck />Planning only · ไม่มีการขาย</span></div>

      {!config.enabled && <div className="protection-gate panel"><ShieldCheck /><div><span className="eyebrow">EXPERT-REVIEW GATE</span><h2>Protection estimate ยังปิดเป็นค่าเริ่มต้น</h2><p>คุณแก้สมมติฐานได้ แต่ผลลัพธ์จะถูกปิดบังจนกว่าจะเลือกเปิด estimate โดยยังคงสถานะผู้เชี่ยวชาญ: {config.expertReviewStatus}</p></div><button onClick={() => update('enabled', true)}>เปิด Protection estimate</button></div>}

      <div className="protection-gap-grid" role="region" aria-label="สรุปช่องว่างความคุ้มครอง เลื่อนแนวนอนได้" aria-hidden={!config.enabled} tabIndex={config.enabled ? 0 : undefined}>{gapCards.map(({ icon: Icon, label, gap, target, existing, unit }) => <article className={`panel ${gap > 0 ? 'has-gap' : 'covered'}`} key={label}><Icon /><span>{label}</span><strong>{gap > 0 ? compact.format(gap) : 'พร้อมตามเป้า'}</strong><small>{gap > 0 ? `ช่องว่าง ${unit}` : `ส่วนคุ้มครองถึงเป้า ${unit}`}</small><div><span>เป้าหมาย {compact.format(target)}</span><span>มีแล้ว {compact.format(existing)}</span></div></article>)}</div>

      <div className="protection-main-grid">
        <article className="panel protection-formula-card" aria-hidden={!config.enabled}>
          <div className="panel-head"><div><span className="eyebrow">NEEDS ANALYSIS</span><h2>สูตร Life coverage ที่ตรวจย้อนกลับได้</h2></div><span className="source-chip">ไม่รวมผลประโยชน์ซ้ำ</span></div>
          <div className="life-formula-total"><span>ความต้องการรวม</span><strong>{money.format(result.lifeCoverageNeed)}</strong><small>หักความคุ้มครองเดิม {money.format(config.existingLifeCover)} → gap {money.format(result.lifeCoverageGap)}</small></div>
          <div className="life-formula-list">
            <div><Home /><span>ปิดหนี้คงเหลือ</span><strong>{money.format(result.debtPayoffNeed)}</strong><small>ใช้ debt ledger เป็นหลัก</small></div>
            <div><UsersRound /><span>ทดแทนรายได้ครอบครัว</span><strong>{money.format(result.incomeReplacementNeed)}</strong><small>{config.dependantCount} ผู้พึ่งพิง · {config.incomeReplacementYears} ปี · {config.incomeReplacementPercent}% ของรายได้</small></div>
            <div><WalletCards /><span>ภาระการศึกษา</span><strong>{money.format(result.educationNeed)}</strong><small>กรอก commitment ที่ยังไม่ถูกกันเงินไว้</small></div>
            <div><ShieldCheck /><span>ค่าใช้จ่ายสุดท้าย</span><strong>{money.format(result.finalExpenseNeed)}</strong><small>สมมติฐานที่ผู้ใช้ปรับเอง</small></div>
          </div>
          <div className="coverage-boundary"><AlertTriangle /><p><strong>เหตุผลที่ไม่รวมเป็น “คะแนนเดียว”</strong><br />วงเงินสุขภาพต่อปีและรายได้ทุพพลภาพต่อเดือนไม่ใช่เงินก้อนประเภทเดียวกับ life coverage การรวมกันจะทำให้ตัดสินใจผิดได้</p></div>
        </article>

        <aside className="panel protection-controls">
          <div className="panel-head compact"><div><span className="eyebrow">YOUR ASSUMPTIONS</span><h2>ครอบครัวและความคุ้มครองเดิม</h2></div><UsersRound /></div>
          <div className="two-fields"><label>ผู้พึ่งพิง<span>คน</span><FormattedNumberInput min="0" max="30" value={config.dependantCount} onValueChange={(value) => update('dependantCount', Math.max(0, value))} /></label><label>ทดแทนรายได้<span>ปี</span><FormattedNumberInput min="0" max="50" value={config.incomeReplacementYears} onValueChange={(value) => update('incomeReplacementYears', Math.max(0, value))} /></label></div>
          <label>สัดส่วนรายได้ที่ต้องทดแทน<span>{config.incomeReplacementPercent}%</span><input type="range" min="0" max="100" value={config.incomeReplacementPercent} onChange={(event) => update('incomeReplacementPercent', Number(event.target.value))} /></label>
          <label>เงินสำรองฉุกเฉินเป้าหมาย<span>{config.emergencyMonthsTarget} เดือน</span><input type="range" min="0" max="24" step="1" value={config.emergencyMonthsTarget} onChange={(event) => update('emergencyMonthsTarget', Number(event.target.value))} /></label>
          <label>Life coverage ที่มีอยู่<span>บาท</span><FormattedNumberInput min="0" value={config.existingLifeCover} onValueChange={(value) => update('existingLifeCover', Math.max(0, value))} /></label>
          <div className="two-fields"><label>Health limit ที่มี<span>บาท/ปี</span><FormattedNumberInput min="0" value={config.existingHealthAnnualLimit} onValueChange={(value) => update('existingHealthAnnualLimit', Math.max(0, value))} /></label><label>Health limit เป้าหมาย<span>บาท/ปี</span><FormattedNumberInput min="0" value={config.targetHealthAnnualLimit} onValueChange={(value) => update('targetHealthAnnualLimit', Math.max(0, value))} /></label></div>
          <label>Disability benefit ที่มี<span>บาท/เดือน</span><FormattedNumberInput min="0" value={config.existingDisabilityMonthlyBenefit} onValueChange={(value) => update('existingDisabilityMonthlyBenefit', Math.max(0, value))} /></label>
          <div className="two-fields"><label>ภาระการศึกษา<span>บาท</span><FormattedNumberInput min="0" value={config.educationCommitments} onValueChange={(value) => update('educationCommitments', Math.max(0, value))} /></label><label>ค่าใช้จ่ายสุดท้าย<span>บาท</span><FormattedNumberInput min="0" value={config.finalExpenses} onValueChange={(value) => update('finalExpenses', Math.max(0, value))} /></label></div>
          {config.enabled && <button className="disable-protection" onClick={() => update('enabled', false)}><ShieldCheck />ปิดผล Protection estimate</button>}
        </aside>
      </div>

      <div className="protection-warnings"><AlertTriangle /><div><strong>ขอบเขตคำแนะนำ</strong>{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}<p>ก่อนตัดสินใจจริงต้องตรวจข้อยกเว้น ระยะรอคอย เงื่อนไขต่ออายุ ความสามารถชำระเบี้ย และคำแนะนำจากผู้เชี่ยวชาญที่ได้รับอนุญาต</p></div></div>
    </section>
  )
}
