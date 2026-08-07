import { useMemo, useState } from 'react'
import { AlertTriangle, Bot, CalendarCheck, Check, ChevronRight, CircleCheck, ClipboardCheck, Cloud, Eye, FileClock, LoaderCircle, LockKeyhole, Plus, Printer, Send, Server, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import { buildProductAcceptanceHtml, buildProductAcceptanceSnapshot } from '../domain/acceptanceSnapshot'
import { buildPlanningContext, decideRecommendation, generateCopilotBrief, recordBlockedInput, recordProviderRequest, saveGeneratedBrief, screenCopilotInput } from '../domain/copilot'
import { getLlmConnectionHint, LlmConnectorError, llmProviderDefaults, requestLlmAnswer, testLlmConnection, type LlmProvider } from '../domain/llmConnector'
import { completeReviewRitual, reviewRitualStatus, type ReviewRitual } from '../domain/reviews'
import type { CopilotConsent, DecisionJournalEntry, ReviewAction, WealthPlan } from '../domain/schema'

const consentLabels: Record<keyof CopilotConsent, { label: string; detail: string }> = {
  netWorth: { label: 'Wealth Map', detail: 'ยอดรวมและอัตราส่วน ไม่ส่งชื่อบัญชี' },
  goals: { label: 'Life Goals', detail: 'ประเภท เป้าหมาย วันที่ และ funding gap' },
  portfolio: { label: 'Portfolio', detail: 'ยอดรวม ความเสี่ยง และ provenance status' },
  retirement: { label: 'Retirement', detail: 'ช่องว่างและ cash-flow summary' },
  protection: { label: 'Protection', detail: 'เฉพาะ gap summary และ expert status' },
  tax: { label: 'Tax', detail: 'ยอดรวม ปีภาษี และ dataset version' },
}

const ritualCopy: Record<ReviewRitual, { eyebrow: string; title: string; detail: string }> = {
  monthly: { eyebrow: 'MONTHLY MONEY REVIEW', title: 'เงินสด หนี้ และ action เดือนนี้', detail: 'เช็กกระแสเงินสด รายการผิดปกติ เงินสำรอง และงานที่ค้าง' },
  quarterly: { eyebrow: 'QUARTERLY PORTFOLIO REVIEW', title: 'พอร์ต เป้าหมาย และสมมติฐาน', detail: 'เช็ก provenance, drift, fee, goal collisions และ stress scenario' },
  annual: { eyebrow: 'ANNUAL LIFE REVIEW', title: 'ชีวิต ครอบครัว และทิศทางปีใหม่', detail: 'ทบทวนเป้าหมาย เกษียณ ความคุ้มครอง ภาษี และ legacy' },
}

const reasonLabels = { empty: 'กรุณาพิมพ์คำถามก่อน', 'too-long': 'คำถามยาวเกิน 2,000 ตัวอักษร', 'prompt-injection': 'ตรวจพบข้อความที่พยายามเปลี่ยนกติกา Copilot', 'transaction-attempt': 'Copilot ไม่มีสิทธิ์ซื้อขายหรือโอนเงิน', 'sensitive-data': 'อย่าใส่รหัสผ่าน เลขบัตร หรือข้อมูลลับ' }
const confidenceLabels = { low: 'หลักฐานจำกัด', medium: 'ปานกลาง', high: 'สูง' }

function inlineAnswer(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => part.startsWith('**') && part.endsWith('**') ? <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong> : <span key={`${index}-${part}`}>{part}</span>)
}

function CopilotAnswer({ text }: { text: string }) {
  const normalized = text.replace(/\s+(?=\d+\.\s+(?:\*\*|[A-Za-zก-๙]))/g, '\n').trim()
  const blocks = normalized.split(/\n+/).map((value) => value.trim()).filter(Boolean)
  const introduction = blocks.filter((value) => !/^\d+\.\s+/.test(value))
  const numbered = blocks.flatMap((value) => {
    const match = value.match(/^\d+\.\s+(.+)$/)
    if (!match) return []
    const segments = match[1].split(/\s+-\s+/).map((item) => item.trim()).filter(Boolean)
    return [{ lead: segments[0], details: segments.slice(1) }]
  })
  return <div className="copilot-answer-content">
    {introduction.map((value) => <p key={value}>{inlineAnswer(value)}</p>)}
    {numbered.length > 0 && <ol>{numbered.map((item, index) => <li key={`${index}-${item.lead}`}><p>{inlineAnswer(item.lead)}</p>{item.details.length > 0 && <ul>{item.details.map((detail) => <li key={detail}>{inlineAnswer(detail)}</li>)}</ul>}</li>)}</ol>}
  </div>
}

export function WealthReviewStudio({ plan, setPlan }: { plan: WealthPlan; setPlan: React.Dispatch<React.SetStateAction<WealthPlan>> }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [dismissReasons, setDismissReasons] = useState<Record<string, string>>({})
  const [copilotMode, setCopilotMode] = useState<'local' | LlmProvider>('local')
  const [lmStudioUrl, setLmStudioUrl] = useState(llmProviderDefaults.lmstudio)
  const [llmModel, setLlmModel] = useState('openrouter/free')
  const [apiKey, setApiKey] = useState('')
  const [shareAcknowledged, setShareAcknowledged] = useState(false)
  const [providerBusy, setProviderBusy] = useState(false)
  const [providerStatus, setProviderStatus] = useState('')
  const [providerModels, setProviderModels] = useState<string[]>([])
  const brief = useMemo(() => generateCopilotBrief(plan), [plan])
  const rituals = useMemo(() => reviewRitualStatus(plan), [plan])
  const contextPreview = useMemo(() => buildPlanningContext(plan), [plan])
  const acceptanceSnapshot = useMemo(() => buildProductAcceptanceSnapshot(plan), [plan])
  const pending = plan.copilotConfig.recommendations.filter((item) => item.status === 'pending')
  const completedMilestones = plan.goals.filter((goal) => goal.status === 'completed').length + plan.wealthReviewConfig.actions.filter((item) => item.status === 'done').length

  const toggleConsent = (key: keyof CopilotConsent) => setPlan((current) => ({ ...current, copilotConfig: { ...current.copilotConfig, consent: { ...current.copilotConfig.consent, [key]: !current.copilotConfig.consent[key] } } }))
  const generate = () => {
    if (!plan.copilotConfig.enabled) return
    setPlan((current) => saveGeneratedBrief(current, generateCopilotBrief(current)))
  }
  const providerConfig = copilotMode === 'local' ? null : { provider: copilotMode, baseUrl: copilotMode === 'openrouter' ? llmProviderDefaults.openrouter : lmStudioUrl, model: llmModel, apiKey }
  const providerConnectionHint = providerConfig ? getLlmConnectionHint(providerConfig) : null
  const switchMode = (mode: 'local' | LlmProvider) => {
    setCopilotMode(mode)
    setLlmModel(mode === 'openrouter' ? 'openrouter/free' : mode === 'lmstudio' ? '' : llmModel)
    setApiKey('')
    setShareAcknowledged(false)
    setProviderModels([])
    setProviderStatus('')
    setAnswer('')
  }
  const testProvider = async () => {
    if (!providerConfig) return
    setProviderBusy(true); setProviderStatus('กำลังทดสอบการเชื่อมต่อ…')
    try {
      const result = await testLlmConnection(providerConfig)
      setProviderModels(result.models)
      if (!llmModel && result.models[0]) setLlmModel(result.models[0])
      setProviderStatus(result.models.length ? `เชื่อมต่อแล้ว · พบ ${result.models.length} โมเดล` : 'เชื่อมต่อแล้ว แต่ยังไม่พบโมเดลที่พร้อมใช้')
    } catch (error) { setProviderStatus(error instanceof Error ? error.message : 'เชื่อมต่อไม่สำเร็จ') }
    finally { setProviderBusy(false) }
  }
  const ask = async () => {
    const screened = screenCopilotInput(question)
    if (!screened.allowed) {
      setAnswer(reasonLabels[screened.reason])
      setPlan((current) => recordBlockedInput(current, screened.reason))
      return
    }
    if (!plan.copilotConfig.enabled || contextPreview.fieldsShared.length === 0) {
      setAnswer('หลักฐานไม่พอ: เปิด Copilot และอนุญาตอย่างน้อยหนึ่งหมวดข้อมูลก่อน ระบบจะไม่เดาคำตอบแทน')
      return
    }
    if (!providerConfig) {
      const first = brief.recommendations[0]
      setAnswer(first ? `${brief.headline} — สิ่งที่ควรเปิดดูต่อ: ${first.title}. ${first.rationale}` : `${brief.headline} — ยังไม่มี action ใหม่จากหลักฐานที่อนุญาต`)
      return
    }
    if (!shareAcknowledged) { setAnswer('กรุณาตรวจ context และยืนยันการส่งข้อมูลไปยัง provider ก่อนทุก session'); return }
    setProviderBusy(true); setAnswer('')
    try {
      const result = await requestLlmAnswer(providerConfig, question, contextPreview)
      setAnswer(result.text)
      setProviderStatus(`${result.provider === 'openrouter' ? 'OpenRouter' : 'LM Studio'} · ${result.model}${result.usage.totalTokens === null ? '' : ` · ${result.usage.totalTokens.toLocaleString('th-TH')} tokens`}`)
      setPlan((current) => recordProviderRequest(current, result.provider, true, contextPreview.fieldsShared))
    } catch (error) {
      setAnswer(error instanceof LlmConnectorError ? error.message : 'โมเดลตอบกลับไม่สำเร็จ')
      setPlan((current) => recordProviderRequest(current, providerConfig.provider, false, contextPreview.fieldsShared))
    } finally { setProviderBusy(false) }
  }
  const decide = (id: string, decision: 'approved' | 'dismissed') => {
    const reason = decision === 'dismissed' ? dismissReasons[id]?.trim() || 'ผู้ใช้ยังไม่เลือกทำ' : 'ผู้ใช้ตรวจแล้วและเพิ่มเป็น action'
    setPlan((current) => decideRecommendation(current, id, decision, reason))
  }
  const completeRitual = (ritual: ReviewRitual) => setPlan((current) => completeReviewRitual(current, ritual))
  const patchAction = (id: string, patch: Partial<ReviewAction>) => setPlan((current) => ({ ...current, wealthReviewConfig: { ...current.wealthReviewConfig, actions: current.wealthReviewConfig.actions.map((item) => item.id === id ? { ...item, ...patch } : item) } }))
  const addAction = () => setPlan((current) => ({ ...current, wealthReviewConfig: { ...current.wealthReviewConfig, actions: [...current.wealthReviewConfig.actions, { id: crypto.randomUUID(), title: 'Action ใหม่', status: 'todo', dueDate: new Date().toISOString().slice(0, 10), sourceRecommendationId: null }] } }))
  const patchJournal = (id: string, patch: Partial<DecisionJournalEntry>) => setPlan((current) => ({ ...current, wealthReviewConfig: { ...current.wealthReviewConfig, journal: current.wealthReviewConfig.journal.map((item) => item.id === id ? { ...item, ...patch } : item) } }))
  const addJournal = () => { const date = new Date(); const review = new Date(date); review.setMonth(review.getMonth() + 3); setPlan((current) => ({ ...current, wealthReviewConfig: { ...current.wealthReviewConfig, journal: [...current.wealthReviewConfig.journal, { id: crypto.randomUUID(), date: date.toISOString().slice(0, 10), title: 'การตัดสินใจใหม่', decision: 'สิ่งที่เลือกทำหรือไม่ทำ', rationale: '', reviewDate: review.toISOString().slice(0, 10), status: 'planned' }] } })) }
  const printAcceptanceSnapshot = () => {
    const reportWindow = window.open('', '_blank')
    if (!reportWindow) { setAnswer('Browser บล็อกหน้าต่างรายงาน โปรดอนุญาต pop-up แล้วลองใหม่'); return }
    reportWindow.opener = null
    reportWindow.document.open()
    reportWindow.document.write(buildProductAcceptanceHtml(acceptanceSnapshot))
    reportWindow.document.close()
    reportWindow.focus()
    window.setTimeout(() => reportWindow.print(), 250)
  }

  return <section className="review-studio">
    <div className="review-hero panel">
      <div><span className="eyebrow">WEALTH REVIEW RITUAL</span><h1>ตัดสินใจจากหลักฐาน<br /><em>แล้วกลับมาทบทวน</em></h1><p>Copilot ช่วยอ่าน calculation output และจัด next best actions แต่สิทธิ์ตัดสินใจยังอยู่กับคุณ ไม่มีการซื้อขาย โอนเงิน หรือส่งข้อมูลออกในรุ่นนี้</p></div>
      <div className="review-hero-metrics"><span><strong>{Object.values(rituals).filter((item) => item.due).length}</strong>review ถึงกำหนด</span><span><strong>{pending.length}</strong>คำแนะนำรอตัดสินใจ</span><span><strong>{completedMilestones}</strong>milestones</span></div>
    </div>

    {completedMilestones > 0 && <div className="milestone-toast"><Sparkles /><span><strong>มีความคืบหน้าที่ควรฉลอง</strong>คุณทำเป้าหมายหรือ action สำเร็จแล้ว {completedMilestones} รายการ</span></div>}

    <div className="review-ritual-grid">{(Object.keys(ritualCopy) as ReviewRitual[]).map((ritual) => <article className={`panel ritual-card ${rituals[ritual].due ? 'due' : 'done'}`} key={ritual}><div><span className="eyebrow">{ritualCopy[ritual].eyebrow}</span><h2>{ritualCopy[ritual].title}</h2><p>{ritualCopy[ritual].detail}</p></div><footer><span>{rituals[ritual].lastCompletedAt ? `ล่าสุด ${rituals[ritual].lastCompletedAt.slice(0, 10)}` : 'ยังไม่เคยปิดรอบ'}</span><button onClick={() => completeRitual(ritual)}>{rituals[ritual].due ? <><CalendarCheck />ปิด review รอบนี้</> : <><CircleCheck />ทบทวนแล้ว</>}</button></footer></article>)}</div>

    <div className="copilot-grid">
      <article className={`panel copilot-control ${plan.copilotConfig.enabled ? 'enabled' : 'locked'}`}>
        <div className="copilot-title"><span><Bot /></span><div><span className="eyebrow">LOCAL WEALTH COPILOT</span><h2>สรุปจากผลคำนวณ ไม่แต่งตัวเลขเอง</h2></div><button className="copilot-switch" role="switch" aria-label="เปิดหรือปิด Local Wealth Copilot" aria-checked={plan.copilotConfig.enabled} onClick={() => setPlan((current) => ({ ...current, copilotConfig: { ...current.copilotConfig, enabled: !current.copilotConfig.enabled } }))}><i /></button></div>
        <div className="copilot-provider-tabs" role="group" aria-label="เลือกกลไก Wealth Copilot">
          <button className={copilotMode === 'local' ? 'active' : ''} aria-pressed={copilotMode === 'local'} onClick={() => switchMode('local')}><Bot />Local rules</button>
          <button className={copilotMode === 'lmstudio' ? 'active' : ''} aria-pressed={copilotMode === 'lmstudio'} onClick={() => switchMode('lmstudio')}><Server />LM Studio</button>
          <button className={copilotMode === 'openrouter' ? 'active' : ''} aria-pressed={copilotMode === 'openrouter'} onClick={() => switchMode('openrouter')}><Cloud />OpenRouter</button>
        </div>
        {providerConfig && <div className={`llm-provider-config ${providerConfig.provider}`}>
          <div className="llm-provider-heading"><span>{providerConfig.provider === 'openrouter' ? <Cloud /> : <Server />}</span><div><b>{providerConfig.provider === 'openrouter' ? 'OpenRouter · remote' : 'LM Studio · local server'}</b><small>{providerConfig.provider === 'openrouter' ? 'ส่งเฉพาะ context ที่เลือกออกอินเทอร์เน็ต และบังคับ ZDR routing' : 'เรียก OpenAI-compatible API โดยตรงจาก browser; ต้องเปิด CORS ใน LM Studio'}</small></div></div>
          {providerConfig.provider === 'lmstudio' && <label>Base URL<input aria-label="LM Studio base URL" value={lmStudioUrl} onChange={(event) => setLmStudioUrl(event.target.value)} placeholder="http://127.0.0.1:1234/v1" /></label>}
          <label>Model ID<input aria-label="LLM model ID" list="flow-llm-models" value={llmModel} onChange={(event) => setLlmModel(event.target.value)} placeholder={providerConfig.provider === 'openrouter' ? 'openrouter/free' : 'เลือกหรือพิมพ์ model ID'} /></label>
          <datalist id="flow-llm-models">{providerModels.map((model) => <option value={model} key={model} />)}</datalist>
          <label>{providerConfig.provider === 'openrouter' ? 'OpenRouter API key' : 'LM Studio API token (ถ้าเปิด auth)'}<input aria-label="LLM API credential" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="เก็บใน memory ของ tab นี้เท่านั้น" /></label>
          {providerConnectionHint && <div className="llm-connection-hint" role="note"><AlertTriangle /><span>{providerConnectionHint}</span></div>}
          <div className="llm-provider-actions"><button disabled={providerBusy} onClick={testProvider}>{providerBusy ? <LoaderCircle className="spin" /> : <Server />}ทดสอบและดูโมเดล</button><span className="llm-status" role="status">{providerStatus}</span></div>
          <label className="llm-share-ack"><input type="checkbox" checked={shareAcknowledged} onChange={(event) => setShareAcknowledged(event.target.checked)} /><span><b>ฉันตรวจ context แล้วและยินยอมส่งใน session นี้</b><small>ไม่บันทึก API key, prompt หรือคำตอบลงแผน/backup; เปลี่ยน provider แล้วต้องยืนยันใหม่</small></span></label>
        </div>}
        <div className="consent-grid">{(Object.keys(consentLabels) as Array<keyof CopilotConsent>).map((key) => <button className={plan.copilotConfig.consent[key] ? 'selected' : ''} key={key} onClick={() => toggleConsent(key)}><span>{plan.copilotConfig.consent[key] ? <Check /> : <X />}</span><b>{consentLabels[key].label}</b><small>{consentLabels[key].detail}</small></button>)}</div>
        <details className="context-preview"><summary><Eye />ดู context ที่อนุญาตส่ง <span>{contextPreview.fieldsShared.length} หมวด</span></summary><pre>{JSON.stringify(contextPreview, null, 2)}</pre></details>
        <button className="generate-brief" disabled={!plan.copilotConfig.enabled || contextPreview.fieldsShared.length === 0} onClick={generate}><Sparkles />สร้าง Wealth Brief ใหม่</button>
        {!plan.copilotConfig.enabled && <div className="copilot-lock"><LockKeyhole /><span><strong>Copilot ปิดอยู่</strong>ทุก calculation และ review ritual ยังใช้งานได้ตามปกติ</span></div>}
      </article>

      <article className="panel copilot-brief">
        <div className="panel-head"><div><span className="eyebrow">CURRENT BRIEF</span><h2>{brief.headline}</h2></div><span className="source-chip">{copilotMode === 'local' ? 'local · read-only' : `${copilotMode === 'openrouter' ? 'OpenRouter' : 'LM Studio'} · no tools`}</span></div>
        <div className="brief-status">{brief.status.map((item) => <div key={item.label} className={item.tone}><small>{item.label}</small><strong>{item.value}</strong><span>{item.source} · {item.asOf}</span></div>)}</div>
        <div className="copilot-question"><label>ถามจาก context ที่อนุญาต<textarea maxLength={2000} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="เช่น เดือนนี้ควรทบทวนอะไรก่อน" /></label><button disabled={providerBusy} onClick={ask}>{providerBusy ? <LoaderCircle className="spin" /> : <Send />}{copilotMode === 'local' ? 'ถามแบบ local' : `ถาม ${copilotMode === 'openrouter' ? 'OpenRouter' : 'LM Studio'}`}</button></div>
        {answer && <div className="copilot-answer" role="status"><Bot /><CopilotAnswer text={answer} /></div>}
        <div className="brief-warnings">{brief.warnings.map((warning) => <p key={warning}><ShieldCheck />{warning}</p>)}</div>
      </article>
    </div>

    <section className="review-section acceptance-studio" aria-labelledby="acceptance-title">
      <div className="section-heading"><div><span className="eyebrow">FINAL GATE READINESS</span><h2 id="acceptance-title">Product Acceptance Snapshot</h2><p>คำตอบ deterministic 4 ข้อพร้อม as-of, model version, สมมติฐาน และข้อจำกัด — การตัดสินใจยังเป็นของ Product Owner</p></div><div className="acceptance-heading-actions"><span className="source-chip">decision · pending</span><button onClick={printAcceptanceSnapshot}><Printer />พิมพ์ / Save PDF</button></div></div>
      <div className="acceptance-grid">{acceptanceSnapshot.questions.map((item, index) => <article className={`panel acceptance-question ${item.tone}`} key={item.id}><header><span>{index + 1}</span><div><small>{item.question}</small><strong>{item.answer}</strong></div></header><details><summary><Eye />ดูหลักฐาน {item.evidence.length} รายการ</summary><div>{item.evidence.map((row) => <p key={`${row.label}-${row.source}`}><b>{row.label}</b><span>{row.value}</span><small>{row.source} · as of {row.asOf} · {row.modelVersion}</small></p>)}</div></details></article>)}</div>
      <div className="acceptance-detail-grid">
        <article className="panel acceptance-actions"><div className="portfolio-card-head"><div><ClipboardCheck /><span><b>Monthly actions รอตัดสินใจ</b><small>อ่านอย่างเดียว · ใช้ Recommendation Inbox เพื่อ approve/dismiss</small></span></div><span className="source-chip">{acceptanceSnapshot.actions.length} pending user</span></div><ol>{acceptanceSnapshot.actions.map((item) => <li key={item.priority}><span>{item.priority}</span><div><b>{item.title}</b><p>{item.rationale}</p><small>{item.evidence} · {item.reversibility}</small></div></li>)}</ol></article>
        <article className="panel acceptance-limitations"><div className="portfolio-card-head"><div><AlertTriangle /><span><b>Assumptions & limitations</b><small>G6/G7/G9 และ Final Gate ยังไม่ถูกอนุมัติ</small></span></div></div><details open><summary>สมมติฐาน {acceptanceSnapshot.assumptions.length} ข้อ</summary>{acceptanceSnapshot.assumptions.map((item) => <p key={item}>{item}</p>)}</details><details><summary>ข้อจำกัดที่ยังเปิดอยู่ {acceptanceSnapshot.knownLimitations.length} ข้อ</summary>{acceptanceSnapshot.knownLimitations.map((item) => <p key={item}>{item}</p>)}</details><footer>{acceptanceSnapshot.rollbackPath}</footer></article>
      </div>
    </section>

    <section className="review-section" id="recommendation-inbox"><div className="section-heading"><div><span className="eyebrow">RECOMMENDATION INBOX</span><h2>ตรวจ trade-off ก่อน approve</h2><p>Approve เพิ่ม action ลงแผนเท่านั้น ไม่มี execution endpoint</p></div><span className="source-chip">{pending.length} pending</span></div><div className="recommendation-inbox">{plan.copilotConfig.recommendations.length === 0 ? <div className="panel review-empty"><Sparkles /><h3>ยังไม่มี Wealth Brief ที่บันทึก</h3><p>เปิด Copilot เลือก consent แล้วกดสร้าง Brief</p></div> : plan.copilotConfig.recommendations.toReversed().map((item) => <details className={`panel recommendation-card ${item.status}`} key={item.id}><summary><span className={`rec-kind ${item.kind}`}><Sparkles /></span><span><small>{item.kind} · confidence {confidenceLabels[item.confidence]}</small><strong>{item.title}</strong></span><i>{item.status}</i><ChevronRight /></summary><div className="recommendation-body"><p className="rec-rationale">{item.rationale}</p><div className="rec-contract"><div><b>Trade-offs</b>{item.tradeoffs.map((value) => <p key={value}>{value}</p>)}</div><div><b>Assumptions</b>{item.assumptions.map((value) => <p key={value}>{value}</p>)}</div><div><b>Impact</b><p>{item.impact}</p></div><div><b>Reversibility</b><p>{item.reversibility}</p></div></div><div className="rec-evidence"><b>Evidence</b>{item.evidence.map((value) => <span key={`${value.label}-${value.asOf}`}>{value.label} · {value.source} · as of {value.asOf}</span>)}</div>{item.status === 'pending' ? <div className="rec-actions"><input aria-label={`เหตุผล dismiss ${item.title}`} placeholder="เหตุผลถ้ายังไม่ทำ" value={dismissReasons[item.id] ?? ''} onChange={(event) => setDismissReasons((current) => ({ ...current, [item.id]: event.target.value }))} /><button className="dismiss" onClick={() => decide(item.id, 'dismissed')}><X />Dismiss</button><button className="approve" onClick={() => decide(item.id, 'approved')}><Check />Approve เป็น action</button></div> : <p className="rec-decision"><FileClock />{item.dispositionReason || 'บันทึกการตัดสินใจแล้ว'}</p>}</div></details>)}</div></section>

    <div className="review-work-grid">
      <section className="panel action-board"><div className="portfolio-card-head"><div><CircleCheck /><span><b>Action checklist</b><small>งานที่อนุมัติและงานที่คุณเพิ่มเอง</small></span></div><button onClick={addAction}><Plus />เพิ่ม action</button></div><div>{plan.wealthReviewConfig.actions.map((item) => <article key={item.id}><select aria-label={`สถานะ ${item.title}`} value={item.status} onChange={(event) => patchAction(item.id, { status: event.target.value as ReviewAction['status'] })}><option value="todo">To do</option><option value="done">Done</option><option value="dismissed">Dismissed</option></select><input aria-label="ชื่อ action" value={item.title} onChange={(event) => patchAction(item.id, { title: event.target.value })} /><input aria-label="วันครบกำหนด" type="date" value={item.dueDate} onChange={(event) => patchAction(item.id, { dueDate: event.target.value })} /><button aria-label={`ลบ ${item.title}`} onClick={() => setPlan((current) => ({ ...current, wealthReviewConfig: { ...current.wealthReviewConfig, actions: current.wealthReviewConfig.actions.filter((value) => value.id !== item.id) } }))}><Trash2 /></button></article>)}</div></section>

      <section className="panel decision-journal"><div className="portfolio-card-head"><div><FileClock /><span><b>Decision journal</b><small>บันทึกเหตุผลและวันกลับมาประเมิน</small></span></div><button onClick={addJournal}><Plus />เพิ่มบันทึก</button></div><div>{plan.wealthReviewConfig.journal.length === 0 ? <p className="journal-empty">ยังไม่มีบันทึกการตัดสินใจ</p> : plan.wealthReviewConfig.journal.toReversed().map((item) => <details key={item.id}><summary><span><b>{item.title}</b><small>{item.date} · review {item.reviewDate}</small></span><i>{item.status}</i></summary><div><label>หัวข้อ<input value={item.title} onChange={(event) => patchJournal(item.id, { title: event.target.value })} /></label><label>สิ่งที่ตัดสินใจ<textarea value={item.decision} onChange={(event) => patchJournal(item.id, { decision: event.target.value })} /></label><label>เหตุผล<textarea value={item.rationale} onChange={(event) => patchJournal(item.id, { rationale: event.target.value })} /></label><label>ทบทวนวันที่<input type="date" value={item.reviewDate} onChange={(event) => patchJournal(item.id, { reviewDate: event.target.value })} /></label><label>สถานะ<select value={item.status} onChange={(event) => patchJournal(item.id, { status: event.target.value as DecisionJournalEntry['status'] })}><option value="planned">Planned</option><option value="active">Active</option><option value="completed">Completed</option><option value="reversed">Reversed</option></select></label><button onClick={() => setPlan((current) => ({ ...current, wealthReviewConfig: { ...current.wealthReviewConfig, journal: current.wealthReviewConfig.journal.filter((value) => value.id !== item.id) } }))}><Trash2 />ลบบันทึก</button></div></details>)}</div></section>
    </div>

    <details className="panel copilot-audit"><summary><ShieldCheck /><span><b>Copilot audit log</b><small>{plan.copilotConfig.auditLog.length} events · ไม่บันทึกข้อความคำถามหรือข้อมูลลับ</small></span></summary><div>{plan.copilotConfig.auditLog.toReversed().slice(0, 50).map((item) => <p key={item.id}><span>{item.at} · {item.action}</span><b>{item.reason}</b><small>{item.fieldsShared.length ? `context: ${item.fieldsShared.join(', ')}` : 'no context shared'}</small></p>)}</div></details>

    <div className="review-boundary"><AlertTriangle /><p><strong>Human approval boundary</strong> Copilot ไม่มี tool สำหรับซื้อขาย โอนเงิน เชื่อมธนาคาร ยื่นภาษี หรือแก้พอร์ตภายนอก การ approve คือการเพิ่ม local action และบันทึก audit เท่านั้น เมื่อเลือก OpenRouter ข้อมูล context ที่ยินยอมจะออกจากเครื่องไปยัง OpenRouter และ model provider ที่ถูก route</p></div>
  </section>
}
