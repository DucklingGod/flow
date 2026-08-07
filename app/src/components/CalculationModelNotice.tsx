import { useState, type Dispatch, type SetStateAction } from 'react'
import { CheckCircle2, ChevronDown, History, RefreshCw, ShieldCheck } from 'lucide-react'
import {
  applyCurrentCalculationModel,
  CURRENT_CALCULATION_MODEL_VERSION,
  getCalculationModel,
  hasCalculationModelUpdate,
  LEGACY_CALCULATION_MODEL_VERSION,
  resolveCalculationModelVersion,
} from '../domain/calculationModels'
import type { WealthPlan } from '../domain/schema'
import { createPlanSnapshot } from '../data/planRepository'

interface CalculationModelNoticeProps {
  plan: WealthPlan
  setPlan: Dispatch<SetStateAction<WealthPlan>>
}

export function CalculationModelNotice({ plan, setPlan }: CalculationModelNoticeProps) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  if (!hasCalculationModelUpdate(plan)) return null

  const appliedModel = plan.calculationModel ?? { version: LEGACY_CALCULATION_MODEL_VERSION, appliedAt: plan.updatedAt, appliedBy: 'migration' as const }
  const current = getCalculationModel(resolveCalculationModelVersion(appliedModel.version))
  const next = getCalculationModel(CURRENT_CALCULATION_MODEL_VERSION)

  const applyUpdate = async () => {
    setBusy(true)
    setMessage('')
    try {
      await createPlanSnapshot(plan, `ก่อนเปลี่ยนสูตรจาก ${current.version} เป็น ${next.version}`, 'beforeModelUpdate')
      setPlan((value) => applyCurrentCalculationModel(value))
      setMessage('อัปเดตแล้วและสร้าง restore point ไว้ใน Plan Vault')
    } catch {
      setMessage('ยังอัปเดตไม่ได้ แผนเดิมและผลลัพธ์เดิมยังไม่ถูกเปลี่ยน')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="model-update-notice" aria-labelledby="model-update-title" data-model-update="available">
      <div className="model-update-icon"><RefreshCw /></div>
      <div className="model-update-copy">
        <span className="eyebrow">CALCULATION MODEL UPDATE</span>
        <h2 id="model-update-title">มีรุ่นสูตรใหม่ — รอคุณอนุมัติก่อนคำนวณใหม่</h2>
        <p>แผนนี้ยังใช้ <b>{current.label}</b> อยู่ ระบบจะไม่เปลี่ยนผลลัพธ์ย้อนหลังเอง รุ่นใหม่ <b>{next.label}</b> ยังไม่เปลี่ยนสูตรตัวเลข แต่เพิ่มหลักฐานและ rollback ที่ตรวจสอบได้</p>
        <button className="model-details-toggle" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          ดูสิ่งที่เปลี่ยนและผลลัพธ์ที่เกี่ยวข้อง <ChevronDown />
        </button>
        {expanded && <div className="model-update-details">
          <div><History /><span><b>รุ่นที่ใช้อยู่</b><small>{current.version} · applied {appliedModel.appliedAt.slice(0, 10)}</small></span></div>
          <div><CheckCircle2 /><span><b>รุ่นที่เสนอ</b><small>{next.version} · released {next.releasedAt}</small></span></div>
          <div className="model-change-list"><b>การเปลี่ยนแปลง</b><ul>{next.changes.map((change) => <li key={change}>{change}</li>)}</ul></div>
          <div className="model-impact-list"><b>ผลลัพธ์ที่จะ rerun หลังอนุมัติ</b><p>{next.affectedOutputs.join(' · ')}</p></div>
        </div>}
        {message && <p className="model-update-message" role="status">{message}</p>}
      </div>
      <div className="model-update-actions">
        <span><ShieldCheck /> สร้าง restore point ก่อนเสมอ</span>
        <button className="primary-button" disabled={busy} onClick={applyUpdate}>{busy ? 'กำลังสร้างจุดย้อนกลับ…' : 'อนุมัติและคำนวณใหม่'}</button>
      </div>
    </section>
  )
}
