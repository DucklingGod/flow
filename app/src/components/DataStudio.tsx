import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock3, CloudCog, Database, Download, ExternalLink, FileJson, Fingerprint, KeyRound, RefreshCw, ServerCog, ShieldCheck, Upload, WifiOff } from 'lucide-react'
import { BOT_DATA_DESCRIPTOR, SEC_OPEN_DATA_DESCRIPTOR, createManualSnapshotAdapter, officialTaxAdapter } from '../dataPlatform/adapters'
import { browserMarketDataCache } from '../dataPlatform/cache'
import type { DataObservation, ProviderDescriptor, ProviderRun, SecurityIdentity } from '../dataPlatform/contracts'
import { freshnessLabel, selectLastKnownGood } from '../dataPlatform/freshness'
import { ProviderRegistry } from '../dataPlatform/providerRegistry'
import { applyObservationToPlan, observationTargetField } from '../dataPlatform/planIntegration'
import { assertFileSize, MAX_MARKET_SNAPSHOT_BYTES } from '../domain/importLimits'
import type { WealthPlan } from '../domain/schema'

type Notice = { tone: 'success' | 'warning'; message: string } | null

const kindLabels: Record<DataObservation['kind'], string> = {
  nav: 'NAV', price: 'ราคา', fx: 'FX', dividend: 'ปันผล', benchmark: 'ดัชนีอ้างอิง', factsheet: 'Factsheet', fee: 'ค่าธรรมเนียม', depositRate: 'ดอกเบี้ยเงินฝาก', taxRule: 'กฎภาษี',
}
const confidenceLabels: Record<DataObservation['confidence'], string> = { official: 'ทางการ', verified: 'ตรวจทานแล้ว', userProvided: 'ผู้ใช้นำเข้า', estimate: 'ค่าประมาณ' }
const licenseLabels: Record<DataObservation['licensingStatus'], string> = { open: 'Open data', userAuthorized: 'ผู้ใช้มีสิทธิ์', restricted: 'จำกัดสิทธิ์', unknown: 'ยังไม่ยืนยันสิทธิ์' }

const catalogue: ProviderDescriptor[] = [officialTaxAdapter.descriptor, SEC_OPEN_DATA_DESCRIPTOR, BOT_DATA_DESCRIPTOR]

function humanValue(observation: DataObservation) {
  if (observation.numericValue !== null) return `${new Intl.NumberFormat('th-TH', { maximumFractionDigits: 4 }).format(observation.numericValue)} ${observation.unit}`
  if (!observation.textValue) return '—'
  try {
    const parsed = JSON.parse(observation.textValue) as { datasetVersion?: string; taxYear?: number }
    return parsed.datasetVersion ? `${parsed.datasetVersion}${parsed.taxYear ? ` · ปี ${parsed.taxYear}` : ''}` : observation.textValue
  } catch { return observation.textValue }
}

function providerStatus(descriptor: ProviderDescriptor, observations: DataObservation[]) {
  if (observations.some((item) => item.providerId === descriptor.id)) return { tone: 'ready', label: 'มี snapshot ในเครื่อง' }
  if (descriptor.authMode === 'sessionKey') return { tone: 'auth', label: 'ต้องสมัครและใส่ key ใน session' }
  return { tone: 'empty', label: 'ยังไม่มี snapshot' }
}

function downloadTemplate() {
  const now = new Date().toISOString()
  const template = {
    providerId: 'manual-user-snapshot', fetchedAt: now,
    securities: [{ id: 'example-fund', name: 'ชื่อกองทุน', ticker: null, exchange: null, isin: null, thaiFundCode: 'M0000_0000', shareClass: 'A', currency: 'THB', distributionMode: 'accumulating', fxHedgedPercent: null, aliases: [], updatedAt: now }],
    observations: [{ id: `manual-nav-${Date.now()}`, kind: 'nav', identityId: 'example-fund', field: 'nav', numericValue: 10, textValue: null, unit: 'THB/unit', currency: 'THB', observedAt: now, fetchedAt: now, providerId: 'manual-user-snapshot', sourceUrl: 'https://example.com/direct-source', sourceAsOf: now.slice(0, 10), staleAfterHours: 48, licensingStatus: 'userAuthorized', licenseNotes: 'ยืนยันสิทธิ์ก่อนนำเข้า', confidence: 'userProvided', validationStatus: 'valid', checksum: 'replace-with-source-checksum' }],
    warnings: ['ตัวอย่างเท่านั้น กรุณาแทนที่ URL วันที่ และค่าให้ตรงกับหลักฐานจริง'],
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'flow-market-snapshot-template.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

export function DataStudio({ plan, setPlan }: { plan: WealthPlan; setPlan: React.Dispatch<React.SetStateAction<WealthPlan>> }) {
  const [observations, setObservations] = useState<DataObservation[]>([])
  const [securities, setSecurities] = useState<SecurityIdentity[]>([])
  const [runs, setRuns] = useState<ProviderRun[]>([])
  const [loading, setLoading] = useState(true)
  const [staleDrill, setStaleDrill] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [targetHoldings, setTargetHoldings] = useState<Record<string, string>>({})
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    const [nextObservations, nextSecurities, nextRuns] = await Promise.all([
      browserMarketDataCache.listObservations(), browserMarketDataCache.listSecurities(), browserMarketDataCache.listRuns(),
    ])
    setObservations(nextObservations)
    setSecurities(nextSecurities)
    setRuns(nextRuns)
  }

  const loadOfficialTax = async (silent = false) => {
    const registry = new ProviderRegistry().register(officialTaxAdapter)
    const execution = await registry.execute('thai-official-tax', { kinds: ['taxRule'] }, undefined, { maxAttempts: 1 })
    await browserMarketDataCache.saveRun(execution.run)
    if (execution.batch) await browserMarketDataCache.saveBatch(execution.batch)
    await refresh()
    if (!silent) setNotice({ tone: execution.batch ? 'success' : 'warning', message: execution.batch ? 'บันทึก snapshot กฎภาษีแบบ versioned แล้ว' : execution.run.message })
  }

  useEffect(() => {
    let active = true
    const initialize = async () => {
      const existing = await browserMarketDataCache.listObservations({ kind: 'taxRule' })
      if (existing.length === 0) await loadOfficialTax(true)
      else await refresh()
      if (active) setLoading(false)
    }
    void initialize()
    return () => { active = false }
  }, [])

  const selected = useMemo(() => {
    const groups = new Map<string, DataObservation[]>()
    observations.forEach((item) => {
      const key = `${item.identityId ?? 'global'}:${item.kind}:${item.field}`
      groups.set(key, [...(groups.get(key) ?? []), item])
    })
    const now = staleDrill ? new Date(Date.now() + 800 * 24 * 3_600_000) : new Date()
    return [...groups.values()].map((group) => selectLastKnownGood(group, now)).filter((item) => item.observation !== null)
  }, [observations, staleDrill])

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    try {
      assertFileSize(file.size, MAX_MARKET_SNAPSHOT_BYTES, 'ไฟล์ใหญ่เกิน 10 MB')
      const adapter = createManualSnapshotAdapter(JSON.parse(await file.text()))
      const registry = new ProviderRegistry().register(adapter)
      const execution = await registry.execute(adapter.descriptor.id, { kinds: adapter.descriptor.kinds }, undefined, { maxAttempts: 1 })
      await browserMarketDataCache.saveRun(execution.run)
      if (!execution.batch) throw new Error(execution.run.message)
      await browserMarketDataCache.saveBatch(execution.batch)
      await refresh()
      setNotice({ tone: 'success', message: `นำเข้า ${execution.batch.observations.length} observation และ ${execution.batch.securities.length} security แล้ว` })
    } catch (error) {
      setNotice({ tone: 'warning', message: error instanceof Error ? `ไฟล์ไม่ผ่าน data contract: ${error.message}` : 'ไฟล์ไม่ผ่าน data contract' })
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const applyObservation = (observation: DataObservation) => {
    const field = observationTargetField(observation)
    const holdingId = targetHoldings[observation.id]
    if (!field || !holdingId) return
    const result = applyObservationToPlan(plan, observation, holdingId)
    if (result.status === 'rejected') {
      const messages = { 'unsupported-field': 'ชนิดข้อมูลนี้ยังไม่รองรับการใช้กับพอร์ต', 'missing-value': 'observation ไม่มีค่าตัวเลข', 'holding-not-found': 'ไม่พบ holding ที่เลือก', 'not-current': 'ข้อมูล stale หรือไม่ผ่านสถานะ current', 'currency-mismatch': 'สกุลเงินของ observation ไม่ตรงกับ holding' }
      setNotice({ tone: 'warning', message: `${messages[result.reason]} จึงไม่มีการเปลี่ยนแผน` })
      return
    }
    setPlan(result.plan)
    setNotice({ tone: 'success', message: `ใช้ ${kindLabels[observation.kind]} กับ ${result.holdingSymbol} แล้ว และคืนสถานะแผนเป็น draft เพื่อให้ตรวจใหม่` })
  }

  return <section className="data-studio">
    <div className="data-hero panel">
      <div><span className="eyebrow">AUDITABLE DATA PLATFORM · P7</span><h1>รู้ว่าตัวเลขมาจากไหน<br /><em>และเก่าแค่ไหน</em></h1><p>ข้อมูลทุกแถวต้องมีแหล่งที่มา วันที่ สิทธิ์ใช้งาน และสถานะตรวจสอบ หาก provider ผิดปกติ Flow จะคง last-known-good ไว้พร้อมป้าย stale โดยไม่สร้างค่าประมาณแทน</p></div>
      <div className="data-hero-stats"><span><strong>{selected.length}</strong>ชุดข้อมูลที่ใช้ได้</span><span><strong>{securities.length}</strong>หลักทรัพย์ใน master</span><span><strong>{runs.length}</strong>retrieval runs</span></div>
    </div>

    {notice && <div className={`data-notice ${notice.tone}`} role="status">{notice.tone === 'success' ? <CheckCircle2 /> : <AlertTriangle />}<span>{notice.message}</span><button onClick={() => setNotice(null)}>ปิด</button></div>}

    <div className="section-heading data-section-heading"><div><span className="eyebrow">PROVIDER CATALOGUE</span><h2>แหล่งข้อมูลที่รองรับ</h2><p>การเชื่อมต่อ live ต้องมีสิทธิ์และ contract mapping ที่ผ่าน G7 ก่อน</p></div><div className="data-actions"><button onClick={() => void loadOfficialTax()}><RefreshCw />รีเฟรชกฎ static</button><button onClick={downloadTemplate}><Download />ไฟล์ตัวอย่าง</button><button className="primary-data-action" onClick={() => fileInput.current?.click()}><Upload />นำเข้า snapshot</button><input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={(event) => void handleImport(event.target.files?.[0])} /></div></div>

    <div className="provider-grid">
      {catalogue.map((provider) => { const status = providerStatus(provider, observations); return <article className="panel provider-card" key={provider.id}>
        <div className="provider-card-head"><span>{provider.id === 'thai-official-tax' ? <Database /> : provider.id === 'sec-open-data' ? <Fingerprint /> : <CloudCog />}</span><i className={status.tone}>{status.label}</i></div>
        <h3>{provider.name}</h3><p>{provider.notes}</p>
        <div className="provider-kinds">{provider.kinds.map((kind) => <span key={kind}>{kindLabels[kind]}</span>)}</div>
        <dl><div><dt>Auth</dt><dd>{provider.authMode === 'sessionKey' ? <><KeyRound />Session only</> : 'ไม่ใช้ key'}</dd></div><div><dt>Schedule</dt><dd>{provider.scheduledIngestion === 'backendOnly' ? <><ServerCog />Backend only</> : 'ปิด'}</dd></div></dl>
        <a href={provider.sourceUrl} target="_blank" rel="noreferrer">ดูหน้าแหล่งข้อมูลทางการ<ExternalLink /></a>
      </article> })}
      <article className="panel provider-card manual-card"><div className="provider-card-head"><span><FileJson /></span><i className="ready">พร้อมใช้งาน</i></div><h3>Verified manual snapshot</h3><p>นำเข้า JSON ที่ผ่าน contract เมื่อยังไม่มี API หรือขณะ offline โดยต้องระบุ URL, as-of, license และ checksum เอง</p><div className="provider-kinds"><span>ทุก data kind</span><span>Local-only</span></div><button onClick={() => fileInput.current?.click()}><Upload />เลือกไฟล์ JSON</button></article>
    </div>

    <div className="data-observation-head section-heading"><div><span className="eyebrow">LAST-KNOWN-GOOD REGISTER</span><h2>ข้อมูลที่พร้อมอ้างอิง</h2><p>แสดงเฉพาะแถวล่าสุดที่ผ่าน validation และมีสิทธิ์ใช้ โดย provenance ยังเปิดดูได้ทุกแถว</p></div><label className="stale-drill"><input type="checkbox" checked={staleDrill} onChange={(event) => setStaleDrill(event.target.checked)} /><span><WifiOff /><b>Stale-data drill</b><small>จำลองเวลา +800 วัน</small></span></label></div>

    {loading ? <div className="data-empty panel"><RefreshCw className="spinning" /><p>กำลังเปิด cache ในเครื่อง…</p></div> : selected.length === 0 ? <div className="data-empty panel"><Database /><h3>ยังไม่มี observation ที่ใช้ได้</h3><p>นำเข้า snapshot ที่มี provenance ครบ ระบบจะไม่สร้างข้อมูลประมาณให้เอง</p></div> : <div className="observation-list">
      {selected.map(({ observation, freshness, usedLastKnownGood }) => observation && <details className="panel observation-row" key={observation.id}>
        <summary><span className={`freshness-dot ${freshness.status}`}></span><span className="observation-name"><small>{kindLabels[observation.kind]} · {observation.providerId}</small><strong>{observation.field}</strong></span><b>{humanValue(observation)}</b><span className={`freshness-badge ${freshness.status}`}>{freshnessLabel(freshness, observation.sourceAsOf)}</span></summary>
        <div className="observation-detail"><div><Clock3 /><span><small>Observed / fetched</small><b>{observation.observedAt} / {observation.fetchedAt}</b></span></div><div><ShieldCheck /><span><small>License / confidence</small><b>{licenseLabels[observation.licensingStatus]} · {confidenceLabels[observation.confidence]}</b></span></div><div><Fingerprint /><span><small>Checksum / validation</small><b>{observation.checksum} · {observation.validationStatus}</b></span></div><div><ExternalLink /><span><small>Direct source</small><a href={observation.sourceUrl} target="_blank" rel="noreferrer">{observation.sourceUrl}</a></span></div>{observationTargetField(observation) && observation.numericValue !== null && <div className="observation-apply"><ShieldCheck /><span><small>Human-approved plan update</small><span><select aria-label={`เลือก holding สำหรับ ${observation.field}`} value={targetHoldings[observation.id] ?? ''} onChange={(event) => setTargetHoldings((current) => ({ ...current, [observation.id]: event.target.value }))}><option value="">เลือก holding…</option>{plan.holdings.map((holding) => <option key={holding.id} value={holding.id}>{holding.symbol} · {holding.name}</option>)}</select><button disabled={!targetHoldings[observation.id] || freshness.status !== 'current'} onClick={() => applyObservation(observation)}>ใช้ snapshot นี้</button></span></span></div>}{usedLastKnownGood && <p className="fallback-warning"><AlertTriangle />ค่าที่ใหม่กว่าถูก quarantine ระบบจึง freeze observation นี้เป็น last-known-good</p>}</div>
      </details>)}
    </div>}

    <div className="data-footnote"><AlertTriangle /><p><strong>ขอบเขต Release 0.8 RC</strong> SEC/BOT adapters มี auth, origin allowlist, retry และ rate-limit contract แล้ว แต่ยังไม่เรียก live จนกว่า response mapping, reconciliation samples และ licensing review ใน G7 จะผ่าน API key จะต้องอยู่ใน memory ของ session เท่านั้น</p></div>
  </section>
}
