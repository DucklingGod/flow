import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Activity, ArchiveRestore, CheckCircle2, Clock3, Download, FileKey2, FileSpreadsheet, GitCompareArrows, HardDrive, History, KeyRound, LockKeyhole, Plus, Printer, ShieldAlert, ShieldCheck, Trash2, TriangleAlert, Upload } from 'lucide-react'
import { browserMarketDataCache } from '../dataPlatform/cache'
import { clearLocalPlanningData, createPlanSnapshot, deletePlanSnapshot, exportBackup, importBackup, importBackupSnapshots, listPlanSnapshots, restorePlanSnapshot, type PlanSnapshot } from '../data/planRepository'
import { decryptBackup, encryptBackup, isEncryptedBackup } from '../domain/backupVault'
import { assertFileSize, MAX_PLAN_IMPORT_BYTES } from '../domain/importLimits'
import { buildCsvReport, buildPrintableReport } from '../domain/reporting'
import { diffPlanSections, resolvePlanSections, type PlanSectionChoice, type PlanSectionId } from '../domain/planConflict'
import { defaultPlan, type WealthPlan } from '../domain/schema'
import { browserUsageMetrics, type UsageAction, type UsageMetricsStatus } from '../data/usageMetrics'
import { enabledRemoteCapabilities, releaseFlags, remoteCapabilities, unapprovedRemoteCapabilities } from '../config/releaseFlags'

const dateTime = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
const reasonLabel: Record<PlanSnapshot['reason'], string> = { manual: 'บันทึกเอง', import: 'ก่อนนำเข้า', beforeRestore: 'ก่อนย้อนเวอร์ชัน', beforeModelUpdate: 'ก่อนเปลี่ยนรุ่นสูตร' }

function downloadText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function PlanVault({ plan, setPlan }: { plan: WealthPlan; setPlan: React.Dispatch<React.SetStateAction<WealthPlan>> }) {
  const [snapshots, setSnapshots] = useState<PlanSnapshot[]>([])
  const [label, setLabel] = useState('ก่อนปรับแผนครั้งถัดไป')
  const [passphrase, setPassphrase] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [staged, setStaged] = useState<{ plan: WealthPlan; snapshots: PlanSnapshot[]; filename: string } | null>(null)
  const [sectionChoices, setSectionChoices] = useState<Record<PlanSectionId, PlanSectionChoice> | null>(null)
  const [deletePhrase, setDeletePhrase] = useState('')
  const [metricsStatus, setMetricsStatus] = useState<UsageMetricsStatus>({ consent: false, updatedAt: new Date(0).toISOString(), retentionDays: 30 })
  const [metricCount, setMetricCount] = useState(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const stagedDiffs = useMemo(() => staged ? diffPlanSections(plan, staged.plan) : [], [plan, staged])
  const resolvedImport = useMemo(() => staged && sectionChoices ? resolvePlanSections(plan, staged.plan, sectionChoices) : null, [plan, sectionChoices, staged])

  const refresh = async () => setSnapshots(await listPlanSnapshots())
  const refreshMetrics = async () => { setMetricsStatus(await browserUsageMetrics.status()); setMetricCount((await browserUsageMetrics.list()).length) }
  const recordMetric = async (action: UsageAction) => { await browserUsageMetrics.record('vault', action); await refreshMetrics() }
  useEffect(() => { void refresh(); void refreshMetrics() }, [])

  const capture = async () => {
    setBusy(true)
    try { await createPlanSnapshot(plan, label, 'manual'); await refresh(); await recordMetric('snapshotCreated'); setStatus('บันทึก snapshot แล้ว') }
    finally { setBusy(false) }
  }

  const exportEncrypted = async () => {
    if (passphrase.length < 12) { setStatus('ตั้งรหัสผ่านอย่างน้อย 12 ตัวอักษรก่อนส่งออก'); return }
    setBusy(true)
    try {
      const encrypted = await encryptBackup(exportBackup(plan, snapshots), passphrase)
      downloadText(encrypted, `flow-wealth-backup-${new Date().toISOString().slice(0, 10)}.flowbackup`)
      await recordMetric('backupExported')
      setStatus('ส่งออก backup ที่เข้ารหัสแล้ว — โปรดเก็บรหัสผ่านแยกจากไฟล์')
    } catch { setStatus('สร้าง backup ไม่สำเร็จ') }
    finally { setBusy(false) }
  }

  const stageImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try { assertFileSize(file.size, MAX_PLAN_IMPORT_BYTES, 'ไฟล์ใหญ่เกิน 10 MB') }
    catch (error) { setStatus(error instanceof Error ? error.message : 'ไฟล์ใหญ่เกิน 10 MB'); return }
    setBusy(true)
    try {
      const raw = await file.text()
      const plaintext = isEncryptedBackup(raw) ? await decryptBackup(raw, passphrase) : raw
      const parsed = importBackup(plaintext)
      setStaged({ ...parsed, filename: file.name })
      const diffs = diffPlanSections(plan, parsed.plan)
      setSectionChoices(Object.fromEntries(diffs.map((item) => [item.id, item.changed ? 'incoming' : 'current'])) as Record<PlanSectionId, PlanSectionChoice>)
      setStatus('ตรวจไฟล์ผ่านแล้ว ยังไม่ได้เขียนทับแผน')
    } catch (error) {
      setStaged(null)
      setSectionChoices(null)
      setStatus(error instanceof Error && error.message === 'decrypt-failed' ? 'รหัสผ่านไม่ถูกต้องหรือไฟล์เสียหาย' : error instanceof Error ? error.message : 'อ่าน backup ไม่สำเร็จ')
    } finally { setBusy(false) }
  }

  const confirmImport = async () => {
    if (!staged || !resolvedImport || resolvedImport.issues.length) return
    setBusy(true)
    try {
      await createPlanSnapshot(plan, `ก่อนนำเข้า ${staged.filename}`, 'import')
      await importBackupSnapshots(staged.snapshots)
      setPlan(resolvedImport.plan)
      setStaged(null)
      setSectionChoices(null)
      await refresh()
      await recordMetric('backupRestored')
      setStatus('นำเข้า backup แล้ว และเก็บแผนก่อนหน้าไว้ใน history')
    } finally { setBusy(false) }
  }

  const restore = async (snapshot: PlanSnapshot) => {
    setBusy(true)
    try {
      await createPlanSnapshot(plan, `ก่อนย้อนกลับไป ${snapshot.label}`, 'beforeRestore')
      setPlan(await restorePlanSnapshot(snapshot.id))
      await refresh()
      setStatus(`ย้อนกลับไป “${snapshot.label}” แล้ว`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'ย้อนเวอร์ชันไม่สำเร็จ') }
    finally { setBusy(false) }
  }

  const removeSnapshot = async (id: string) => { await deletePlanSnapshot(id); await refresh(); setStatus('ลบ snapshot แล้ว') }

  const eraseAll = async () => {
    if (deletePhrase !== 'DELETE') return
    setBusy(true)
    try {
      await Promise.all([clearLocalPlanningData(), browserMarketDataCache.clearAll(), browserUsageMetrics.clearAll()])
      setSnapshots([])
      setStaged(null)
      setSectionChoices(null)
      setDeletePhrase('')
      setMetricsStatus({ consent: false, updatedAt: new Date(0).toISOString(), retentionDays: 30 })
      setMetricCount(0)
      setPlan({ ...defaultPlan, updatedAt: new Date().toISOString() })
      setStatus('ลบข้อมูลแผน, version history และ market cache ใน browser นี้แล้ว')
    } finally { setBusy(false) }
  }

  const exportCsv = async () => {
    downloadText(buildCsvReport(plan), `flow-wealth-report-${new Date().toISOString().slice(0, 10)}.csv`)
    await recordMetric('csvExported')
    setStatus('ส่งออกรายงาน CSV แล้ว — ตรวจข้อมูลก่อนเปิดใน spreadsheet')
  }

  const printReport = async () => {
    const reportWindow = window.open('', '_blank')
    if (!reportWindow) { setStatus('browser บล็อกหน้าต่างรายงาน โปรดอนุญาต pop-up แล้วลองใหม่'); return }
    reportWindow.opener = null
    reportWindow.document.open()
    reportWindow.document.write(buildPrintableReport(plan))
    reportWindow.document.close()
    reportWindow.focus()
    window.setTimeout(() => reportWindow.print(), 250)
    await recordMetric('printOpened')
    setStatus('เปิดรายงานแล้ว — เลือก Save as PDF ในหน้าต่างพิมพ์')
  }

  const toggleMetrics = async () => {
    const next = await browserUsageMetrics.setConsent(!metricsStatus.consent)
    setMetricsStatus(next)
    setMetricCount((await browserUsageMetrics.list()).length)
    setStatus(next.consent ? 'เปิด local usability metrics แล้ว — ไม่มีค่าการเงินและไม่มีการส่งออก' : 'ถอน consent และลบ local usability metrics แล้ว')
  }

  const clearMetrics = async () => {
    await browserUsageMetrics.setConsent(false)
    await refreshMetrics()
    setStatus('ลบ metrics และถอน consent แล้ว')
  }

  return <section className="content-section vault-studio">
    <div className="vault-hero panel"><div><span className="eyebrow">LOCAL PLAN VAULT</span><h1>สำรอง ย้อนเวอร์ชัน และควบคุมข้อมูลของคุณ</h1><p>ทุกอย่างยังอยู่ใน browser นี้ ไม่มีบัญชี ไม่มี cloud sync และไม่มีลิงก์แชร์ในรุ่นนี้</p></div><div><HardDrive /><strong>Local-first</strong><span>schema v{plan.version}</span></div></div>

    {status && <p className="vault-status" role="status"><CheckCircle2 />{status}</p>}

    <div className="vault-grid">
      <article className="panel vault-card"><div className="vault-card-head"><History /><div><span className="eyebrow">VERSION HISTORY</span><h2>จุดย้อนกลับของแผน</h2></div></div><p>สร้าง snapshot ก่อนเปลี่ยนสมมติฐานใหญ่ ระบบเก็บสูงสุด 50 เวอร์ชันในเครื่องนี้</p><label>ชื่อ snapshot<input maxLength={80} value={label} onChange={(event) => setLabel(event.target.value)} /></label><button className="primary-button" disabled={busy} onClick={capture}><Plus />บันทึก snapshot</button></article>

      <article className="panel vault-card"><div className="vault-card-head"><FileKey2 /><div><span className="eyebrow">ENCRYPTED BACKUP</span><h2>ไฟล์สำรองที่เปิดด้วยรหัสผ่าน</h2></div></div><p>AES-GCM + PBKDF2-SHA-256 ไฟล์ไม่มีรหัสผ่านอยู่ข้างใน หากลืมรหัสจะกู้คืนไม่ได้</p><label>รหัสผ่านอย่างน้อย 12 ตัวอักษร<div className="vault-secret"><KeyRound /><input type="password" autoComplete="new-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} /></div></label><div className="vault-buttons"><button disabled={busy || passphrase.length < 12} onClick={exportEncrypted}><Download />ส่งออกเข้ารหัส</button><input ref={fileInput} type="file" accept=".flowbackup,.json,application/json,text/plain" onChange={stageImport} /><button disabled={busy} onClick={() => fileInput.current?.click()}><Upload />เลือกไฟล์กู้คืน</button></div></article>
      <article className="panel vault-card report-card"><div className="vault-card-head"><FileSpreadsheet /><div><span className="eyebrow">LOCAL REPORTS</span><h2>ส่งออก snapshot สำหรับตรวจและแชร์</h2></div></div><p>CSV ใช้ UTF-8 และป้องกัน formula injection ส่วน PDF สร้างผ่านหน้าต่างพิมพ์ใน browser โดยไม่อัปโหลดข้อมูล</p><div className="vault-buttons"><button onClick={exportCsv}><FileSpreadsheet />ดาวน์โหลด CSV</button><button onClick={printReport}><Printer />พิมพ์ / Save as PDF</button></div></article>
    </div>

    {staged && sectionChoices && <article className="panel staged-backup conflict-restore"><div className="conflict-head"><GitCompareArrows /><span><b>ตรวจไฟล์ผ่านแล้ว: {staged.filename}</b><small>schema v{staged.plan.version} · history {staged.snapshots.length} รายการ · ต่างกัน {stagedDiffs.filter((item) => item.changed).length} หมวด</small></span></div><p>เลือกแหล่งข้อมูลทีละหมวดก่อนยืนยัน ระบบไม่ merge ค่าการเงินหรือ array เงียบ ๆ และจะสร้าง safety snapshot ของแผนปัจจุบันก่อนเสมอ</p><div className="conflict-grid">{stagedDiffs.map((item) => <article className={item.changed ? 'changed' : 'same'} key={item.id}><div><span>{item.changed ? 'ต่างกัน' : 'เหมือนกัน'}</span><b>{item.label}</b><small>เครื่องนี้: {item.currentSummary}</small><small>ไฟล์: {item.incomingSummary}</small></div><div role="group" aria-label={`เลือกข้อมูล ${item.label}`}><button className={sectionChoices[item.id] === 'current' ? 'active' : ''} aria-pressed={sectionChoices[item.id] === 'current'} onClick={() => setSectionChoices((current) => current ? { ...current, [item.id]: 'current' } : current)}>เก็บเครื่องนี้</button><button className={sectionChoices[item.id] === 'incoming' ? 'active' : ''} aria-pressed={sectionChoices[item.id] === 'incoming'} disabled={!item.changed} onClick={() => setSectionChoices((current) => current ? { ...current, [item.id]: 'incoming' } : current)}>ใช้จากไฟล์</button></div></article>)}</div>{resolvedImport?.issues.length ? <div className="conflict-issues" role="alert"><TriangleAlert /><div><b>ยังยืนยันไม่ได้</b>{resolvedImport.issues.map((issue) => <span key={issue}>{issue}</span>)}</div></div> : <div className="conflict-safe"><CheckCircle2 />ชุดข้อมูลที่เลือกผ่าน schema และ reference checks</div>}<div className="conflict-actions"><button onClick={() => { setStaged(null); setSectionChoices(null) }}>ยกเลิก</button><button className="primary-button" disabled={busy || Boolean(resolvedImport?.issues.length)} onClick={confirmImport}><ArchiveRestore />ยืนยันกู้คืนที่เลือก</button></div></article>}

    <article className="panel snapshot-register"><div className="vault-card-head"><Clock3 /><div><span className="eyebrow">RESTORE POINTS</span><h2>Version history ({snapshots.length})</h2></div></div>{snapshots.length === 0 ? <p className="vault-empty">ยังไม่มี snapshot — แผนปัจจุบันยังบันทึกอัตโนมัติตามปกติ</p> : <div>{snapshots.map((snapshot) => <article key={snapshot.id}><div><b>{snapshot.label}</b><span>{dateTime.format(new Date(snapshot.createdAt))} · {reasonLabel[snapshot.reason]} · schema v{snapshot.planVersion}</span></div><button disabled={busy} onClick={() => restore(snapshot)}><ArchiveRestore />ย้อนเวอร์ชัน</button><button className="danger-icon" disabled={busy} aria-label={`ลบ ${snapshot.label}`} onClick={() => removeSnapshot(snapshot.id)}><Trash2 /></button></article>)}</div>}</article>

    <article className="panel release-controls"><div className="vault-card-head"><ShieldCheck /><div><span className="eyebrow">STAGED RELEASE CONTROLS</span><h2>Privacy-safe metrics และ feature gates</h2></div></div><div className="metrics-consent"><Activity /><div><b>เก็บ usability metrics เฉพาะในเครื่อง</b><p>allowlist มีเพียง route, action, timestamp และ random event ID · อายุข้อมูลสูงสุด 30 วัน · ไม่มียอดเงิน ชื่อ note หรือ error message</p><small>{metricsStatus.consent ? `เปิดอยู่ · ${metricCount} events` : 'ปิดเป็นค่าเริ่มต้น · 0 events เมื่อถอน consent'}</small></div><button role="switch" aria-checked={metricsStatus.consent} className={metricsStatus.consent ? 'on' : ''} onClick={toggleMetrics}><span />{metricsStatus.consent ? 'เปิดอยู่' : 'ปิดอยู่'}</button>{metricsStatus.consent && <button className="clear-metrics" onClick={clearMetrics}><Trash2 />ถอน consent และลบ</button>}</div><div className="feature-gates"><div><b>Remote capability gate</b><span>{unapprovedRemoteCapabilities().length > 0 ? 'พบ remote capability ที่ยังไม่อนุมัติ' : enabledRemoteCapabilities().length === 0 ? 'ปิดครบทุก remote capability' : `remote ที่เปิด: ${enabledRemoteCapabilities().join(', ')}`}</span></div>{Object.entries(releaseFlags).map(([key, enabled]) => {
      // An enabled remote capability must never be labelled "local on": this
      // panel is what a user reads to learn whether anything leaves the device.
      const isRemote = (remoteCapabilities as readonly string[]).includes(key)
      const state = !enabled ? 'remote-off' : isRemote ? 'remote-on' : 'local-on'
      const label = !enabled ? 'off' : isRemote ? 'remote on' : 'local on'
      return <span className={state} key={key}>{key}<b>{label}</b></span>
    })}</div></article>

    <article className="panel privacy-boundary"><LockKeyhole /><div><b>ขอบเขตการแชร์ข้อมูล</b><p>ngrok แชร์เฉพาะหน้าเว็บ แต่ IndexedDB ของแต่ละเครื่องแยกกัน การ sync/household/advisor sharing จะเปิดได้หลังมี authentication, authorization tests, encryption key ownership, revoke/delete และ privacy review เท่านั้น</p></div></article>

    <article className="panel danger-zone"><div><ShieldAlert /><span><span className="eyebrow">DANGER ZONE</span><h2>ลบข้อมูลใน browser นี้</h2><p>ลบแผน, version history และ market-data cache แล้วกลับสู่แผนตัวอย่าง ไม่กระทบไฟล์ backup ที่คุณดาวน์โหลดไว้</p></span></div><label>พิมพ์ DELETE เพื่อยืนยัน<input value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} /></label><button disabled={busy || deletePhrase !== 'DELETE'} onClick={eraseAll}><Trash2 />ลบข้อมูล local ทั้งหมด</button></article>
  </section>
}
