import { z } from 'zod'
import type { PlanningContext } from './copilot'

export type LlmProvider = 'lmstudio' | 'openrouter'

export interface LlmConnectorConfig {
  provider: LlmProvider
  baseUrl: string
  model: string
  apiKey: string
}

export interface LlmAnswer {
  text: string
  model: string
  provider: LlmProvider
  usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null }
}

export interface LlmConnectionResult {
  models: string[]
  endpoint: string
}

export type LlmConnectorErrorCode = 'invalid-config' | 'authentication' | 'rate-limit' | 'unavailable' | 'timeout' | 'invalid-response' | 'network'

export class LlmConnectorError extends Error {
  readonly code: LlmConnectorErrorCode
  readonly status: number | null

  constructor(code: LlmConnectorErrorCode, message: string, status: number | null = null) {
    super(message)
    this.name = 'LlmConnectorError'
    this.code = code
    this.status = status
  }
}

const modelsResponseSchema = z.object({
  data: z.array(z.object({ id: z.string().min(1).max(300) }).passthrough()).max(10_000),
}).passthrough()

// Chat providers add optional fields at different speeds. Validate the small
// envelope we rely on, then parse answer text and usage independently so an
// unfamiliar optional field cannot discard an otherwise safe final answer.
const chatEnvelopeSchema = z.object({
  model: z.unknown().optional(),
  choices: z.unknown().optional(),
  usage: z.unknown().optional(),
}).passthrough()

const chatChoiceSchema = z.object({
  finish_reason: z.unknown().optional(),
  error: z.unknown().optional(),
  message: z.unknown().optional(),
  delta: z.unknown().optional(),
  text: z.unknown().optional(),
}).passthrough()

const chatMessageSchema = z.object({
  content: z.unknown().optional(),
  reasoning: z.unknown().optional(),
  refusal: z.unknown().optional(),
}).passthrough()

interface ProviderPayloadError {
  code?: number | string
  message: string
  errorType: string
}

const providerDefaults: Record<LlmProvider, string> = {
  lmstudio: 'http://127.0.0.1:1234/v1',
  openrouter: 'https://openrouter.ai/api/v1',
}

function isLoopbackHost(hostname: string) {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1'
}

function currentPageHref() {
  try { return globalThis.location?.href ?? '' } catch { return '' }
}

function endpointConnectionHint(targetUrl: string, pageHref: string) {
  if (!pageHref) return null
  let target: URL
  let page: URL
  try { target = new URL(targetUrl); page = new URL(pageHref) } catch { return null }
  if (isLoopbackHost(target.hostname) && !isLoopbackHost(page.hostname)) {
    return 'หน้านี้ไม่ได้เปิดจาก localhost แต่ Base URL เป็น 127.0.0.1/localhost ซึ่งจะชี้กลับไปยังอุปกรณ์ที่เปิดหน้านี้ หาก LM Studio อยู่บนคอม ให้เปิด Flow ที่ http://127.0.0.1:5173 บนคอมเครื่องนั้น'
  }
  if (page.protocol === 'https:' && target.protocol === 'http:') {
    return 'หน้านี้เป็น HTTPS แต่ LM Studio เป็น HTTP และ browser อาจบล็อก mixed content/local-network access ให้เปิด Flow ผ่าน http://127.0.0.1:5173 บนคอมเครื่องเดียวกับ LM Studio'
  }
  return null
}

export function getLlmConnectionHint(config: LlmConnectorConfig, pageHref = currentPageHref()) {
  if (config.provider !== 'lmstudio') return null
  const baseUrl = (config.baseUrl || providerDefaults.lmstudio).trim().replace(/\/$/, '')
  return endpointConnectionHint(baseUrl, pageHref)
}

function normalizeConfig(config: LlmConnectorConfig, requireModel = true) {
  const baseUrl = (config.provider === 'openrouter' ? providerDefaults.openrouter : config.baseUrl || providerDefaults.lmstudio).trim().replace(/\/$/, '')
  let url: URL
  try { url = new URL(baseUrl) } catch { throw new LlmConnectorError('invalid-config', 'Endpoint ต้องเป็น URL แบบ http หรือ https') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || baseUrl.length > 2_048) throw new LlmConnectorError('invalid-config', 'Endpoint ไม่ปลอดภัยหรือยาวเกินกำหนด')
  const model = config.model.trim()
  if ((requireModel && !model) || model.length > 300) throw new LlmConnectorError('invalid-config', 'กรุณาระบุ model ID ที่ถูกต้อง')
  if (config.provider === 'openrouter' && !config.apiKey.trim()) throw new LlmConnectorError('authentication', 'กรุณาใส่ OpenRouter API key สำหรับ session นี้')
  return { ...config, baseUrl, model, apiKey: config.apiKey.trim() }
}

function headers(config: ReturnType<typeof normalizeConfig>) {
  const values: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) values.Authorization = `Bearer ${config.apiKey}`
  return values
}

function endpoint(config: ReturnType<typeof normalizeConfig>, route: 'models' | 'chat/completions') {
  return `${config.baseUrl}/${route}`
}

function mapHttpError(status: number, message: string) {
  if (status === 401 || status === 403) return new LlmConnectorError('authentication', 'การยืนยันตัวตนไม่ผ่าน กรุณาตรวจ API key/token และสิทธิ์ของโมเดล', status)
  if (status === 429) return new LlmConnectorError('rate-limit', 'ถึงขีดจำกัดการเรียกใช้ กรุณารอสักครู่ก่อนลองใหม่', status)
  if ([402, 408, 502, 503, 504].includes(status)) return new LlmConnectorError('unavailable', `ผู้ให้บริการยังตอบไม่ได้ (${status})${message ? `: ${message.slice(0, 180)}` : ''}`, status)
  return new LlmConnectorError('unavailable', `เรียกผู้ให้บริการไม่สำเร็จ (${status})${message ? `: ${message.slice(0, 180)}` : ''}`, status)
}

function mapProviderPayloadError(error: ProviderPayloadError) {
  const typed = error.errorType
  const numericCode = typeof error.code === 'number' ? error.code : Number(error.code)
  const status = Number.isFinite(numericCode) ? numericCode : null
  if (typed === 'authentication' || typed === 'permission_denied') return new LlmConnectorError('authentication', 'Provider ปฏิเสธ API key หรือสิทธิ์ของโมเดล', status)
  if (typed === 'rate_limit_exceeded') return new LlmConnectorError('rate-limit', 'Provider จำกัดจำนวนคำขอ กรุณารอแล้วกดถามใหม่เอง', status)
  if (typed === 'timeout') return new LlmConnectorError('timeout', 'Provider หมดเวลาก่อนสร้างคำตอบเสร็จ', status)
  if (typed === 'provider_overloaded') return new LlmConnectorError('unavailable', 'Provider กำลังมีคำขอหนาแน่น กรุณารอสักครู่หรือเลือกโมเดลอื่น', status)
  if (typed === 'provider_unavailable') return new LlmConnectorError('unavailable', 'Provider ส่งคำตอบว่างหรือไม่สมบูรณ์ กรุณากดถามใหม่หรือเลือกโมเดลอื่น', status)
  if (typed === 'context_length_exceeded' || typed === 'max_tokens_exceeded' || typed === 'token_limit_exceeded') return new LlmConnectorError('invalid-response', 'คำถามและ context ยาวเกินขีดจำกัดของโมเดล ลองลดหมวดข้อมูลที่แชร์หรือใช้โมเดลที่รองรับ context มากขึ้น', status)
  if (typed === 'content_policy_violation' || typed === 'refusal') return new LlmConnectorError('invalid-response', 'Provider หรือโมเดลปฏิเสธคำขอนี้ตามนโยบายเนื้อหา', status)
  if (status !== null) return mapHttpError(status, error.message)
  return new LlmConnectorError('unavailable', `Provider สร้างคำตอบไม่สำเร็จ: ${error.message.slice(0, 180)}`)
}

async function readProviderJson(response: Response) {
  try { return await response.json() as unknown }
  catch { throw new LlmConnectorError('invalid-response', 'Provider ตอบกลับมาเป็นข้อมูลที่ไม่ใช่ JSON') }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeProviderError(value: unknown): ProviderPayloadError | null {
  if (!isRecord(value)) return null
  const code = typeof value.code === 'number' || typeof value.code === 'string' ? value.code : undefined
  const metadata = isRecord(value.metadata) ? value.metadata : null
  const errorType = typeof metadata?.error_type === 'string' ? metadata.error_type.slice(0, 120) : ''
  const message = typeof value.message === 'string' && value.message.trim() ? value.message.trim().slice(0, 2_000) : 'Provider ไม่ได้ระบุรายละเอียดของข้อผิดพลาด'
  return { code, message, errorType }
}

function throwPayloadError(payload: unknown) {
  if (!isRecord(payload)) return
  const topLevel = normalizeProviderError(payload.error)
  if (topLevel) throw mapProviderPayloadError(topLevel)
  if (!Array.isArray(payload.choices)) return
  for (const rawChoice of payload.choices.slice(0, 20)) {
    if (!isRecord(rawChoice)) continue
    const choiceError = normalizeProviderError(rawChoice.error)
    if (choiceError) throw mapProviderPayloadError(choiceError)
  }
}

function boundedText(value: unknown, limit = 20_000) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : ''
}

function extractTextParts(content: unknown) {
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const rawPart of content.slice(0, 100)) {
    if (typeof rawPart === 'string') {
      const text = boundedText(rawPart)
      if (text) parts.push(text)
      continue
    }
    if (!isRecord(rawPart)) continue
    const type = typeof rawPart.type === 'string' ? rawPart.type : ''
    if (type && !['text', 'output_text', 'text_delta'].includes(type)) continue
    const directText = boundedText(rawPart.text)
    if (directText) {
      parts.push(directText)
      continue
    }
    // A few OpenAI-compatible servers wrap text as { text: { value } }.
    const nestedText = isRecord(rawPart.text) ? boundedText(rawPart.text.value) : ''
    if (nestedText) parts.push(nestedText)
  }
  return parts.join('\n').slice(0, 20_000)
}

function extractAnswerContent(rawMessage: unknown, legacyText: unknown) {
  const parsedMessage = chatMessageSchema.safeParse(rawMessage)
  if (parsedMessage.success) {
    const direct = boundedText(parsedMessage.data.content)
    if (direct) return direct
    const parts = extractTextParts(parsedMessage.data.content)
    if (parts) return parts
    const refusal = boundedText(parsedMessage.data.refusal)
    if (refusal) return refusal
    if (boundedText(parsedMessage.data.reasoning)) throw new LlmConnectorError('invalid-response', 'โมเดลใช้ token ไปกับ reasoning แต่ไม่มี final answer กรุณากดถามใหม่หรือเลือกโมเดลอื่น')
    if (Array.isArray(parsedMessage.data.content)) throw new LlmConnectorError('invalid-response', 'Provider ส่ง content parts มาแต่ไม่มีส่วนข้อความที่แสดงได้ กรุณาเลือกโมเดลแบบ text')
    if (isRecord(parsedMessage.data.content)) throw new LlmConnectorError('invalid-response', 'Provider ส่งคำตอบเป็น object ที่ไม่ใช่ข้อความ จึงไม่นำมาแสดง')
  }
  const legacy = boundedText(legacyText)
  if (legacy) return legacy
  throw new LlmConnectorError('invalid-response', 'Provider ตอบสำเร็จแต่ไม่มีข้อความ final answer กรุณากดถามใหม่หรือเลือกโมเดลอื่น')
}

function tokenCount(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && Number.isSafeInteger(value) ? value : null
}

function parseUsage(value: unknown) {
  if (!isRecord(value)) return { promptTokens: null, completionTokens: null, totalTokens: null }
  return {
    promptTokens: tokenCount(value.prompt_tokens),
    completionTokens: tokenCount(value.completion_tokens),
    totalTokens: tokenCount(value.total_tokens),
  }
}

function parseChatAnswer(payload: unknown, fallbackModel: string) {
  const envelope = chatEnvelopeSchema.safeParse(payload)
  if (!envelope.success) throw new LlmConnectorError('invalid-response', 'Provider ตอบเป็น JSON แต่โครงสร้างหลักไม่ใช่ chat completion')
  if (!Array.isArray(envelope.data.choices)) throw new LlmConnectorError('invalid-response', 'Provider ไม่ส่งรายการคำตอบ (choices) กลับมา')
  if (envelope.data.choices.length === 0) throw new LlmConnectorError('unavailable', 'OpenRouter ยังไม่ได้สร้างคำตอบ (choices ว่าง) กรุณากดถามใหม่หรือเลือกโมเดลอื่น')
  const choice = chatChoiceSchema.safeParse(envelope.data.choices[0])
  if (!choice.success) throw new LlmConnectorError('invalid-response', 'คำตอบรายการแรกจาก Provider มีโครงสร้างที่อ่านไม่ได้')
  const finishReason = typeof choice.data.finish_reason === 'string' ? choice.data.finish_reason : ''
  const choiceError = normalizeProviderError(choice.data.error)
  if (choiceError) throw mapProviderPayloadError(choiceError)
  if (finishReason === 'error') throw new LlmConnectorError('unavailable', 'Provider หยุดสร้างคำตอบด้วยสถานะ error กรุณากดถามใหม่หรือเลือกโมเดลอื่น')
  if (choice.data.message === undefined && choice.data.delta !== undefined) throw new LlmConnectorError('invalid-response', 'Provider ส่ง response แบบ streaming กลับมาไม่ครบ ทั้งที่แอปขอคำตอบแบบปกติ กรุณากดถามใหม่')
  const text = extractAnswerContent(choice.data.message, choice.data.text)
  const model = boundedText(envelope.data.model, 300) || fallbackModel
  return { text, model, usage: parseUsage(envelope.data.usage) }
}

async function fetchWithTimeout(url: string, init: RequestInit, fetcher: typeof fetch, timeoutMs = 30_000) {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetcher(url, { ...init, signal: controller.signal })
    if (!response.ok) {
      let message = ''
      try { message = String((await response.json() as { error?: { message?: unknown } }).error?.message ?? '') } catch { /* keep generic error */ }
      throw mapHttpError(response.status, message)
    }
    return response
  } catch (error) {
    if (error instanceof LlmConnectorError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') throw new LlmConnectorError('timeout', 'หมดเวลารอคำตอบหลัง 30 วินาที')
    const contextHint = endpointConnectionHint(url, currentPageHref())
    throw new LlmConnectorError('network', contextHint ?? 'เชื่อมต่อไม่ได้ ให้เปิด LM Studio Server Settings แล้วตรวจ Enable CORS, URL/port และ API token')
  } finally { globalThis.clearTimeout(timer) }
}

export async function testLlmConnection(config: LlmConnectorConfig, fetcher: typeof fetch = fetch): Promise<LlmConnectionResult> {
  const normalized = normalizeConfig(config, false)
  const target = endpoint(normalized, 'models')
  const response = await fetchWithTimeout(target, { method: 'GET', headers: headers(normalized) }, fetcher, 12_000)
  const payload = await readProviderJson(response)
  throwPayloadError(payload)
  const parsed = modelsResponseSchema.safeParse(payload)
  if (!parsed.success) throw new LlmConnectorError('invalid-response', 'รูปแบบรายการโมเดลจากผู้ให้บริการไม่ถูกต้อง')
  return { models: parsed.data.data.map((item) => item.id).slice(0, 100), endpoint: target }
}

function systemPrompt() {
  return [
    'คุณคือ Flow Wealth Copilot ผู้ช่วยอธิบายแผนการเงินภาษาไทย',
    'ใช้เฉพาะ planning context ที่แนบมา ห้ามแต่งยอดเงิน ผลตอบแทน แหล่งข้อมูล หรือกฎภาษีเพิ่มเอง',
    'ตัวเลขสำคัญต้องมาจาก context เท่านั้น หากไม่มีให้บอกว่าหลักฐานไม่พอ',
    'ห้ามสั่งซื้อขาย โอนเงิน ยื่นภาษี เรียก tool หรืออ้างว่าได้ดำเนินการแทนผู้ใช้',
    'ตอบเป็นข้อสังเกต ทางเลือก trade-off และคำถามที่ผู้ใช้ควรตรวจต่อ โดยย้ำว่าผู้ใช้เป็นผู้ตัดสินใจ',
  ].join('\n')
}

export async function requestLlmAnswer(config: LlmConnectorConfig, question: string, context: PlanningContext, fetcher: typeof fetch = fetch): Promise<LlmAnswer> {
  const normalized = normalizeConfig(config)
  const cleanQuestion = question.trim()
  if (!cleanQuestion || cleanQuestion.length > 2_000) throw new LlmConnectorError('invalid-config', 'คำถามต้องมี 1–2,000 ตัวอักษร')
  const contextText = JSON.stringify(context)
  if (contextText.length > 100_000) throw new LlmConnectorError('invalid-config', 'Planning context ใหญ่เกิน 100 KB')
  const body: Record<string, unknown> = {
    model: normalized.model,
    messages: [
      { role: 'system', content: systemPrompt() },
      { role: 'user', content: `คำถาม: ${cleanQuestion}\n\nPlanning context ที่ผู้ใช้อนุญาต:\n${contextText}` },
    ],
    temperature: 0.2,
    max_tokens: 900,
    stream: false,
  }
  if (normalized.provider === 'openrouter') {
    body.provider = { zdr: true }
    body.reasoning = { effort: 'minimal', exclude: true }
    body.max_tokens = 1_800
  }
  const response = await fetchWithTimeout(endpoint(normalized, 'chat/completions'), { method: 'POST', headers: headers(normalized), body: JSON.stringify(body) }, fetcher)
  const payload = await readProviderJson(response)
  throwPayloadError(payload)
  const parsed = parseChatAnswer(payload, normalized.model)
  return {
    text: parsed.text,
    model: parsed.model,
    provider: normalized.provider,
    usage: parsed.usage,
  }
}

export const llmProviderDefaults = Object.freeze(providerDefaults)
