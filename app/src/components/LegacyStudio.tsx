import { useMemo, useState } from 'react'
import { AlertTriangle, BookOpenCheck, CheckCircle2, ContactRound, Eye, FileKey2, KeyRound, LockKeyhole, Plus, ShieldCheck, Trash2, UsersRound } from 'lucide-react'
import { decryptLocalReference, encryptLocalReference, isEncryptedReference } from '../domain/documentVault'
import { calculateLegacyReadiness } from '../domain/legacy'
import { migratePlan, type LegacyItem, type WealthPlan } from '../domain/schema'

const categoryLabels: Record<LegacyItem['category'], string> = {
  ownership: 'เจ้าของทรัพย์สิน', beneficiary: 'ผู้รับผลประโยชน์', will: 'พินัยกรรม', policy: 'กรมธรรม์', account: 'บัญชี', contact: 'ผู้ติดต่อ',
}
const statusLabels: Record<LegacyItem['status'], string> = { missing: 'ยังไม่เริ่ม', inProgress: 'กำลังทำ', complete: 'พร้อมแล้ว' }

export function LegacyStudio({ plan, setPlan }: { plan: WealthPlan; setPlan: React.Dispatch<React.SetStateAction<WealthPlan>> }) {
  const normalizedPlan = plan.legacyConfig ? plan : migratePlan(plan)
  const config = normalizedPlan.legacyConfig
  const readiness = useMemo(() => calculateLegacyReadiness(config), [config])
  const [passphrase, setPassphrase] = useState('')
  const [draftReferences, setDraftReferences] = useState<Record<string, string>>({})
  const [revealedReferences, setRevealedReferences] = useState<Record<string, string>>({})
  const [vaultMessage, setVaultMessage] = useState('')

  const updateConfig = <K extends keyof WealthPlan['legacyConfig']>(key: K, value: WealthPlan['legacyConfig'][K]) => {
    setPlan((current) => {
      const migrated = current.legacyConfig ? current : migratePlan(current)
      return { ...migrated, legacyConfig: { ...migrated.legacyConfig, [key]: value } }
    })
  }
  const updateItem = <K extends keyof LegacyItem>(id: string, key: K, value: LegacyItem[K]) => updateConfig('items', config.items.map((item) => item.id === id ? { ...item, [key]: value } : item))
  const addItem = () => updateConfig('items', [...config.items, { id: crypto.randomUUID(), title: 'รายการครอบครัวใหม่', category: 'account', status: 'missing', ownerMemberId: normalizedPlan.householdMembers[0]?.id ?? null, localDocumentReference: null, reviewedAt: null }])
  const removeItem = (id: string) => updateConfig('items', config.items.filter((item) => item.id !== id))

  const saveReference = async (item: LegacyItem) => {
    try {
      const encrypted = await encryptLocalReference(draftReferences[item.id] ?? '', passphrase)
      updateItem(item.id, 'localDocumentReference', encrypted)
      setDraftReferences((current) => ({ ...current, [item.id]: '' }))
      setVaultMessage(`เข้ารหัส reference ของ “${item.title}” แล้ว`)
    } catch (error) {
      setVaultMessage(error instanceof Error && error.message === 'passphrase-too-short' ? 'Passphrase ต้องมีอย่างน้อย 8 ตัวอักษร' : 'กรุณากรอก reference และ passphrase ให้ครบ')
    }
  }
  const revealReference = async (item: LegacyItem) => {
    try {
      const decrypted = await decryptLocalReference(item.localDocumentReference ?? '', passphrase)
      setRevealedReferences((current) => ({ ...current, [item.id]: decrypted }))
      setVaultMessage(`ถอดรหัส reference ของ “${item.title}” ชั่วคราวแล้ว`)
    } catch {
      setVaultMessage('ถอดรหัสไม่สำเร็จ ตรวจ passphrase แล้วลองอีกครั้ง')
    }
  }
  const deleteReference = (item: LegacyItem) => {
    updateItem(item.id, 'localDocumentReference', null)
    setRevealedReferences((current) => { const next = { ...current }; delete next[item.id]; return next })
    setVaultMessage(`ลบ encrypted reference ของ “${item.title}” แล้ว`)
  }

  return (
    <section className="content-section legacy-studio" id="legacy-studio">
      <div className="section-heading legacy-heading"><div><span className="eyebrow">FAMILY & LEGACY · RELEASE 0.7</span><h2>ทำให้คนที่ไว้ใจรู้ว่าต้องทำอะไร เมื่อคุณไม่พร้อมบอกเอง</h2><p>จัดเจ้าของข้อมูล ผู้รับผลประโยชน์ พินัยกรรม กรมธรรม์ บัญชี และผู้ติดต่อ โดยไม่อัปโหลดเอกสารจริง</p></div><span className="local-vault-chip"><LockKeyhole />Local-first encrypted references</span></div>

      <div className="legacy-overview-grid" role="region" aria-label="ภาพรวมความพร้อมด้านครอบครัวและมรดก เลื่อนแนวนอนได้" tabIndex={0}>
        <article className="panel legacy-score-card"><div className="legacy-score-visual"><div className="legacy-score-ring" aria-hidden="true" style={{ background: `conic-gradient(var(--lime) ${readiness.score}%, rgba(255,255,255,.13) 0)` }} /><span>{readiness.score}%</span></div><div><span>Legacy readiness</span><strong>{readiness.completedItems} พร้อม · {readiness.inProgressItems} กำลังทำ</strong><small>คะแนนมาจาก checklist 80% + emergency contact 10% + beneficiary review 10%</small></div></article>
        <article className="panel"><BookOpenCheck /><span>รายการที่ยังขาด</span><strong>{readiness.missingItems}</strong><small>จากทั้งหมด {config.items.length} รายการ</small></article>
        <article className="panel"><FileKey2 /><span>Encrypted references</span><strong>{readiness.encryptedReferenceCount}</strong><small>เก็บเฉพาะตำแหน่ง/ชื่ออ้างอิง ไม่เก็บเอกสาร</small></article>
        <article className={`panel ${readiness.beneficiaryReviewStale ? 'review-due' : ''}`}><UsersRound /><span>Beneficiary review</span><strong>{readiness.beneficiaryReviewStale ? 'ถึงเวลาทบทวน' : 'อยู่ในรอบ 12 เดือน'}</strong><small>{config.beneficiaryReviewDate ?? 'ยังไม่มีวันที่ทบทวน'}</small></article>
      </div>

      <div className="legacy-main-grid">
        <article className="panel legacy-checklist-card">
          <div className="ledger-head"><div><span className="eyebrow">FAMILY CHECKLIST</span><h2>สิ่งที่ต้องพร้อมและคนรับผิดชอบ</h2></div><button onClick={addItem}><Plus />เพิ่มรายการ</button></div>
          <div className="legacy-list">{config.items.map((item) => <div className={`legacy-row ${item.status}`} key={item.id}>
            <span className="legacy-status-icon">{item.status === 'complete' ? <CheckCircle2 /> : item.status === 'inProgress' ? <ShieldCheck /> : <AlertTriangle />}</span>
            <label className="legacy-title">รายการ<input maxLength={100} value={item.title} onChange={(event) => updateItem(item.id, 'title', event.target.value)} /></label>
            <label>หมวด<select value={item.category} onChange={(event) => updateItem(item.id, 'category', event.target.value as LegacyItem['category'])}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>สถานะ<select value={item.status} onChange={(event) => updateItem(item.id, 'status', event.target.value as LegacyItem['status'])}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>เจ้าของ<select value={item.ownerMemberId ?? ''} onChange={(event) => updateItem(item.id, 'ownerMemberId', event.target.value || null)}><option value="">ยังไม่ระบุ</option>{normalizedPlan.householdMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
            <label>ทบทวนล่าสุด<input type="date" value={item.reviewedAt ?? ''} onChange={(event) => updateItem(item.id, 'reviewedAt', event.target.value || null)} /></label>
            <button className="legacy-delete" onClick={() => removeItem(item.id)} aria-label={`ลบ ${item.title}`}><Trash2 /></button>
            <div className="legacy-reference">
              {isEncryptedReference(item.localDocumentReference) ? <><span><LockKeyhole />Reference ถูกเข้ารหัสแล้ว</span>{revealedReferences[item.id] && <strong>{revealedReferences[item.id]}</strong>}<button onClick={() => revealReference(item)}><Eye />{revealedReferences[item.id] ? 'ถอดรหัสอีกครั้ง' : 'เปิดชั่วคราว'}</button><button className="remove-ref" onClick={() => deleteReference(item)}><Trash2 />ลบ reference</button></> : <><label>ตำแหน่ง/ชื่ออ้างอิง (ไม่ใส่เลขบัตรหรือรหัสผ่าน)<input maxLength={80} placeholder="เช่น ตู้เอกสาร A / แฟ้ม 02" value={draftReferences[item.id] ?? ''} onChange={(event) => setDraftReferences((current) => ({ ...current, [item.id]: event.target.value }))} /></label><button className="save-reference-button" onClick={() => saveReference(item)}><FileKey2 />เข้ารหัสและบันทึก</button></>}
            </div>
          </div>)}</div>
        </article>

        <aside className="legacy-side-stack">
          <article className="panel legacy-family-controls"><div className="panel-head compact"><div><span className="eyebrow">HOUSEHOLD HANDOFF</span><h2>ข้อมูลที่ต้องทบทวนเป็นรอบ</h2></div><ContactRound /></div><label className="emergency-check"><input type="checkbox" checked={config.emergencyContactReady} onChange={(event) => updateConfig('emergencyContactReady', event.target.checked)} /><span><strong>ยืนยันผู้ติดต่อฉุกเฉินแล้ว</strong><small>ตรวจว่าบุคคลนี้รู้ขั้นตอนและหาตำแหน่งเอกสารได้</small></span></label><label>วันที่ทบทวนผู้รับผลประโยชน์ล่าสุด<input type="date" value={config.beneficiaryReviewDate ?? ''} onChange={(event) => updateConfig('beneficiaryReviewDate', event.target.value || null)} /></label></article>
          <article className="panel vault-card"><KeyRound /><span className="eyebrow">REFERENCE VAULT</span><h2>Passphrase สำหรับ session นี้</h2><p>ใช้สร้าง/เปิด encrypted reference เท่านั้น ระบบไม่บันทึก passphrase และไม่สามารถกู้คืนให้ได้</p><label>Passphrase สำหรับเข้ารหัส reference<input type="password" autoComplete="new-password" minLength={8} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} placeholder="อย่างน้อย 8 ตัวอักษร" /></label><small>เข้ารหัสด้วย PBKDF2-SHA-256 + AES-GCM</small><div aria-live="polite">{vaultMessage}</div></article>
          <article className="panel legacy-actions"><span className="eyebrow">NEXT HANDOFF ACTIONS</span>{readiness.nextActions.length ? readiness.nextActions.map((action, index) => <div key={action}><span>0{index + 1}</span><p>{action}</p></div>) : <div><CheckCircle2 /><p>รายการหลักพร้อมแล้ว กำหนดวันทบทวนครั้งถัดไป</p></div>}</article>
        </aside>
      </div>

      <div className="legacy-warning"><AlertTriangle /><p><strong>ไม่ใช่ที่เก็บเอกสารหรือคำแนะนำกฎหมาย</strong><br />อย่าใส่รหัสผ่าน เลขบัตรประชาชน private key หรือเนื้อหาเอกสารจริง ตรวจความถูกต้องของพินัยกรรมและผู้รับผลประโยชน์กับผู้เชี่ยวชาญด้านกฎหมาย/มรดกในเขตอำนาจที่เกี่ยวข้อง</p></div>
    </section>
  )
}
