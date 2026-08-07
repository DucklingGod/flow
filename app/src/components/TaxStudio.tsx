import { useMemo } from 'react'
import { AlertTriangle, BadgePercent, Database, ExternalLink, LockKeyhole, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react'
import { calculateTax, TAX_DATASETS } from '../domain/tax'
import { migratePlan, type WealthPlan } from '../domain/schema'
import { FormattedNumberInput } from './FormattedNumberInput'

const money = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })
const compact = new Intl.NumberFormat('th-TH', { notation: 'compact', maximumFractionDigits: 2 })

export function TaxStudio({ plan, setPlan }: { plan: WealthPlan; setPlan: React.Dispatch<React.SetStateAction<WealthPlan>> }) {
  const normalizedPlan = plan.taxProfile ? plan : migratePlan(plan)
  const profile = normalizedPlan.taxProfile
  const result = useMemo(() => calculateTax(profile), [profile])
  const dataset = result.dataset
  const update = <K extends keyof WealthPlan['taxProfile']>(key: K, value: WealthPlan['taxProfile'][K]) => {
    setPlan((current) => {
      const migrated = current.taxProfile ? current : migratePlan(current)
      return { ...migrated, taxProfile: { ...migrated.taxProfile, [key]: value } }
    })
  }
  const toggleEstimate = () => {
    setPlan((current) => {
      const migrated = current.taxProfile ? current : migratePlan(current)
      const selected = TAX_DATASETS[migrated.taxProfile.taxYear]
      return { ...migrated, taxProfile: { ...migrated.taxProfile, enabled: !migrated.taxProfile.enabled, datasetVersion: selected?.version ?? migrated.taxProfile.datasetVersion } }
    })
  }
  const taxResultLabel = result.taxPayable > 0 ? 'คาดว่าต้องชำระเพิ่ม' : result.estimatedRefund > 0 ? 'คาดว่าชำระไว้เกิน' : 'ภาษีหลังหัก ณ ที่จ่าย'
  const taxResultValue = result.taxPayable > 0 ? result.taxPayable : result.estimatedRefund
  const deductionRows = dataset ? [
    ['ค่าใช้จ่ายเงินเดือน', result.employmentExpense], ['ส่วนตัว', result.eligible.personal], ['คู่สมรส', result.eligible.spouse], ['บุตร', result.eligible.child],
    ['บิดามารดา', result.eligible.parent], ['ประกันสังคม', result.eligible.socialSecurity], ['PVD + RMF', result.eligible.retirementGroup],
    ['Thai ESG', result.eligible.thaiEsg], ['ประกันชีวิต + สุขภาพ', result.eligible.lifeHealthInsurance], ['เงินบริจาค', result.donationAllowance],
  ] as const : []

  return (
    <section className="content-section tax-studio" id="tax-studio">
      <div className="section-heading tax-heading"><div><span className="eyebrow">THAILAND TAX STUDIO · RELEASE 0.7</span><h2>เห็นภาษีเป็นระบบ ไม่ใช่ยอดลดหย่อนโดด ๆ</h2><p>คำนวณจากชุดกฎที่ระบุปี เวอร์ชัน วันที่มีผล และแหล่งทางการ พร้อมปิดผลลัพธ์เมื่อปีภาษียังไม่รองรับ</p></div><div className={`tax-dataset-state ${profile.enabled ? 'enabled' : ''}`}><Database /><span>Tax year {profile.taxYear}</span><strong>{dataset?.version ?? 'unsupported'}</strong><small>{dataset?.status ?? 'disabled'}</small></div></div>

      {!profile.enabled && <div className="tax-gate panel"><LockKeyhole /><div><span className="eyebrow">EXPERT-REVIEW GATE</span><h2>Tax estimate ยังปิดเป็นค่าเริ่มต้น</h2><p>ข้อมูลที่กรอกจะเก็บในเครื่อง แต่ระบบจะไม่แสดงยอดภาษีจนกว่าคุณเลือกเปิด estimate และยอมรับว่ายังไม่ใช่แบบยื่นภาษี</p></div><button onClick={toggleEstimate}><ShieldCheck />เปิด estimate ปี {profile.taxYear}</button></div>}

      {result.status === 'unsupported-year' && <div className="tax-unsupported"><AlertTriangle /><div><strong>ยังไม่รองรับปีภาษี {profile.taxYear}</strong><p>ระบบปิดการคำนวณเพื่อไม่ใช้กฎปีอื่นแทนโดยเงียบ ๆ กรุณาเลือกปีที่มี dataset</p></div></div>}

      <div className={`tax-results ${profile.enabled && result.status === 'estimate' ? '' : 'locked'}`}>
        <div className="tax-summary-grid" role="region" aria-label="สรุปภาษีโดยประมาณ เลื่อนแนวนอนได้" aria-hidden={!profile.enabled} tabIndex={profile.enabled ? 0 : undefined}>
          <article className="panel tax-primary"><span>ภาษีคำนวณก่อนหัก ณ ที่จ่าย</span><strong>{money.format(result.taxBeforeWithholding)}</strong><small>effective rate {result.effectiveRate.toFixed(1)}% · marginal {result.marginalRate}%</small></article>
          <article className="panel"><WalletCards /><span>เงินได้รวม</span><strong>{compact.format(result.grossIncome)}</strong><small>ค่าใช้จ่ายเงินเดือน {compact.format(result.employmentExpense)}</small></article>
          <article className="panel"><ReceiptText /><span>เงินได้สุทธิ</span><strong>{compact.format(result.taxableIncome)}</strong><small>หลังค่าใช้จ่ายและค่าลดหย่อนที่รองรับ</small></article>
          <article className="panel"><BadgePercent /><span>{taxResultLabel}</span><strong>{compact.format(taxResultValue)}</strong><small>หัก ณ ที่จ่าย {compact.format(result.withholdingTax)}</small></article>
        </div>

        <div className="tax-main-grid">
          <article className="panel deduction-card" aria-hidden={!profile.enabled}>
            <div className="panel-head"><div><span className="eyebrow">DEDUCTION INVENTORY</span><h2>รายการที่ถูกนำไปคำนวณจริง</h2></div><span className="source-chip">ไม่เกินเพดาน</span></div>
            <div className="deduction-waterfall"><div className="waterfall-start"><span>รายได้รวม</span><strong>{money.format(result.grossIncome)}</strong></div>{deductionRows.filter(([, value]) => value > 0).map(([label, value]) => <div key={label}><span>{label}</span><strong>− {money.format(value)}</strong></div>)}<div className="waterfall-end"><span>เงินได้สุทธิ</span><strong>{money.format(result.taxableIncome)}</strong></div></div>
            <div className="tax-room-grid"><div><span>เพดานกลุ่มเกษียณที่เหลือ</span><strong>{money.format(result.remainingRoom.retirementGroup)}</strong><small>ไม่ใช่คำแนะนำให้ซื้อเพิ่ม</small></div><div><span>RMF room ที่คำนวณได้</span><strong>{money.format(result.remainingRoom.rmf)}</strong><small>ยังต้องตรวจเงื่อนไขถือครอง</small></div><div><span>Thai ESG room ที่เหลือ</span><strong>{money.format(result.remainingRoom.thaiEsg)}</strong><small>30% ของเงินได้ สูงสุด 300,000</small></div></div>
          </article>

          <aside className="panel tax-controls">
            <div className="panel-head compact"><div><span className="eyebrow">TAX INPUTS</span><h2>รายได้และสิทธิลดหย่อน</h2></div><ReceiptText /></div>
            <label>ปีภาษี<select value={profile.taxYear} onChange={(event) => update('taxYear', Number(event.target.value))}>{Object.keys(TAX_DATASETS).map((year) => <option key={year} value={year}>{Number(year) + 543} / {year}</option>)}</select></label>
            <div className="two-fields"><label>เงินได้จากงาน<span>บาท/ปี</span><FormattedNumberInput min="0" value={profile.employmentIncome} onValueChange={(value) => update('employmentIncome', Math.max(0, value))} /></label><label>เงินได้อื่น<span>บาท/ปี</span><FormattedNumberInput min="0" value={profile.otherTaxableIncome} onValueChange={(value) => update('otherTaxableIncome', Math.max(0, value))} /></label></div>
            <label>ภาษีหัก ณ ที่จ่าย<span>บาท</span><FormattedNumberInput min="0" value={profile.withholdingTax} onValueChange={(value) => update('withholdingTax', Math.max(0, value))} /></label>
            <div className="tax-family-row"><label><input type="checkbox" checked={profile.spouseAllowance} onChange={(event) => update('spouseAllowance', event.target.checked)} />คู่สมรสไม่มีเงินได้</label><label>บุตร<FormattedNumberInput min="0" max="30" value={profile.childCount} onValueChange={(value) => update('childCount', Math.max(0, value))} /></label><label>บิดามารดา<FormattedNumberInput min="0" max="4" value={profile.parentAllowanceCount} onValueChange={(value) => update('parentAllowanceCount', Math.max(0, value))} /></label></div>
            <div className="two-fields"><label>ประกันสังคม<span>บาท</span><FormattedNumberInput min="0" value={profile.socialSecurityContribution} onValueChange={(value) => update('socialSecurityContribution', Math.max(0, value))} /></label><label>กองทุนสำรองเลี้ยงชีพ<span>บาท</span><FormattedNumberInput min="0" value={profile.providentFundContribution} onValueChange={(value) => update('providentFundContribution', Math.max(0, value))} /></label></div>
            <div className="two-fields"><label>RMF<span>บาท</span><FormattedNumberInput min="0" value={profile.rmfContribution} onValueChange={(value) => update('rmfContribution', Math.max(0, value))} /></label><label>Thai ESG<span>บาท</span><FormattedNumberInput min="0" value={profile.thaiEsgContribution} onValueChange={(value) => update('thaiEsgContribution', Math.max(0, value))} /></label></div>
            <div className="two-fields"><label>ประกันชีวิต<span>บาท</span><FormattedNumberInput min="0" value={profile.lifeInsurancePremium} onValueChange={(value) => update('lifeInsurancePremium', Math.max(0, value))} /></label><label>ประกันสุขภาพ<span>บาท</span><FormattedNumberInput min="0" value={profile.healthInsurancePremium} onValueChange={(value) => update('healthInsurancePremium', Math.max(0, value))} /></label></div>
            <label>เงินบริจาคทั่วไป<span>บาท</span><FormattedNumberInput min="0" value={profile.donations} onValueChange={(value) => update('donations', Math.max(0, value))} /></label>
            {profile.enabled && <button className="disable-tax" onClick={toggleEstimate}><LockKeyhole />ปิดผล Tax estimate</button>}
          </aside>
        </div>
      </div>

      {dataset && <article className="panel tax-source-card"><div><span className="eyebrow">OFFICIAL SOURCE REGISTER</span><h2>แหล่งข้อมูลและวันที่ตรวจล่าสุด</h2><p>ลิงก์นี้ใช้ยืนยันกฎ ไม่ได้ดึงข้อมูลส่วนตัวหรือยื่นแบบแทนคุณ</p></div><div>{dataset.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span><strong>{source.title}</strong><small>มีผล {source.effectiveFrom} · ตรวจ {source.checkedAt}</small></span><ExternalLink /></a>)}</div></article>}

      <div className="tax-warnings"><AlertTriangle /><div><strong>ข้อจำกัดของ estimate</strong>{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}<p>ก่อนยื่นจริงต้องเทียบหนังสือรับรอง ภ.ง.ด. เอกสารกองทุน/ประกัน และปรึกษาผู้เชี่ยวชาญภาษีเมื่อโครงสร้างรายได้ซับซ้อน</p></div></div>
    </section>
  )
}
