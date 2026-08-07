import {
  ProviderBatchSchema,
  ProviderRunSchema,
  type DataProviderAdapter,
  type ProviderBatch,
  type ProviderDescriptor,
  type ProviderRequest,
  type ProviderRun,
  type RuntimeCredentials,
} from './contracts'

export interface ProviderExecution {
  run: ProviderRun
  batch: ProviderBatch | null
}

export interface ExecutionOptions {
  maxAttempts?: number
  scheduled?: boolean
  backendContext?: boolean
  now?: () => Date
  delay?: (milliseconds: number) => Promise<void>
}

const defaultDelay = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))

function resultRun(descriptor: ProviderDescriptor, startedAt: string, completedAt: string, status: ProviderRun['status'], attempts: number, batch: ProviderBatch | null, errorCode: string | null, message: string) {
  return ProviderRunSchema.parse({
    id: `${descriptor.id}:${startedAt}:${crypto.randomUUID()}`,
    providerId: descriptor.id,
    startedAt,
    completedAt,
    status,
    attemptCount: Math.max(1, attempts),
    receivedCount: batch?.observations.length ?? 0,
    acceptedCount: batch?.observations.filter((item) => item.validationStatus === 'valid').length ?? 0,
    quarantinedCount: batch?.observations.filter((item) => item.validationStatus !== 'valid').length ?? 0,
    errorCode,
    message,
  })
}

function validateBatch(adapter: DataProviderAdapter, request: ProviderRequest, raw: unknown) {
  const parsed = ProviderBatchSchema.safeParse(raw)
  if (!parsed.success) throw new Error('provider-contract-invalid')
  const batch = parsed.data
  if (batch.providerId !== adapter.descriptor.id) throw new Error('provider-id-mismatch')
  if (batch.observations.some((item) => !request.kinds.includes(item.kind))) throw new Error('unexpected-data-kind')
  const knownIds = new Set(batch.securities.map((item) => item.id))
  if (batch.observations.some((item) => item.identityId && !knownIds.has(item.identityId))) throw new Error('unknown-security-reference')
  if (new Set(batch.observations.map((item) => item.id)).size !== batch.observations.length) throw new Error('duplicate-observation-id')
  return batch
}

export class ProviderRegistry {
  private readonly adapters = new Map<string, DataProviderAdapter>()
  private readonly calls = new Map<string, number[]>()

  register(adapter: DataProviderAdapter) {
    if (this.adapters.has(adapter.descriptor.id)) throw new Error('provider-already-registered')
    this.adapters.set(adapter.descriptor.id, adapter)
    return this
  }

  descriptors() {
    return [...this.adapters.values()].map((adapter) => adapter.descriptor)
  }

  async execute(providerId: string, request: ProviderRequest, credentials?: RuntimeCredentials, options: ExecutionOptions = {}): Promise<ProviderExecution> {
    const adapter = this.adapters.get(providerId)
    if (!adapter) throw new Error('provider-not-registered')
    const now = options.now ?? (() => new Date())
    const startedAt = now().toISOString()
    const complete = (status: ProviderRun['status'], attempts: number, batch: ProviderBatch | null, errorCode: string | null, message: string): ProviderExecution => ({
      run: resultRun(adapter.descriptor, startedAt, now().toISOString(), status, attempts, batch, errorCode, message), batch,
    })
    if (adapter.descriptor.authMode === 'sessionKey' && !credentials?.apiKey?.trim()) {
      return complete('authorizationRequired', 1, null, 'session-key-required', 'ต้องใส่ API key สำหรับ session นี้ก่อนเชื่อมต่อ')
    }
    if (request.kinds.some((kind) => !adapter.descriptor.kinds.includes(kind))) {
      return complete('failed', 1, null, 'unsupported-data-kind', 'provider นี้ไม่รองรับชนิดข้อมูลที่ร้องขอ')
    }
    if (options.scheduled && (adapter.descriptor.scheduledIngestion !== 'backendOnly' || !options.backendContext)) {
      return complete('failed', 1, null, 'scheduled-backend-required', 'scheduled ingestion ทำได้เฉพาะ backend ที่ได้รับอนุญาต')
    }
    const limit = adapter.descriptor.rateLimitPerHour
    const cutoff = now().getTime() - 3_600_000
    const recent = (this.calls.get(providerId) ?? []).filter((timestamp) => timestamp >= cutoff)
    if (limit !== null && recent.length >= limit) return complete('rateLimited', 1, null, 'local-rate-limit', 'ถึงเพดานการเรียก provider ในชั่วโมงนี้')
    this.calls.set(providerId, recent)

    const maxAttempts = Math.max(1, Math.min(5, options.maxAttempts ?? 3))
    const delay = options.delay ?? defaultDelay
    let lastError = 'provider-failed'
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        recent.push(now().getTime())
        this.calls.set(providerId, recent)
        const batch = validateBatch(adapter, request, await adapter.fetch(request, credentials))
        return complete(batch.warnings.length > 0 ? 'partial' : 'success', attempt, batch, null, batch.warnings.join(' · ') || 'retrieval-complete')
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'provider-failed'
        if (lastError.includes('contract') || lastError.includes('mismatch') || lastError.includes('unexpected') || lastError.includes('duplicate') || lastError.includes('unknown-security')) break
        if (attempt < maxAttempts) await delay(250 * 2 ** (attempt - 1))
      }
    }
    return complete('failed', Math.min(maxAttempts, Math.max(1, recent.length)), null, lastError, 'ใช้ข้อมูลล่าสุดที่ผ่านการตรวจสอบใน cache ต่อไป โดยไม่สร้างค่าทดแทน')
  }
}
