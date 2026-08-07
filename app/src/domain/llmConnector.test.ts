import { describe, expect, it, vi } from 'vitest'
import { buildPlanningContext } from './copilot'
import { getLlmConnectionHint, requestLlmAnswer, testLlmConnection } from './llmConnector'
import { defaultPlan } from './schema'

const context = buildPlanningContext(defaultPlan, { netWorth: true, goals: false, portfolio: false, retirement: false, protection: false, tax: false }, new Date('2026-08-07T00:00:00.000Z'))

describe('LLM connector boundary', () => {
  it('lists LM Studio models through its OpenAI-compatible endpoint', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: [{ id: 'qwen-local' }, { id: 'llama-local' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch
    const result = await testLlmConnection({ provider: 'lmstudio', baseUrl: 'http://127.0.0.1:1234/v1/', model: '', apiKey: '' }, fetcher)
    expect(result).toEqual({ models: ['qwen-local', 'llama-local'], endpoint: 'http://127.0.0.1:1234/v1/models' })
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:1234/v1/models', expect.objectContaining({ method: 'GET' }))
  })

  it('explains why a loopback LM Studio URL cannot work from an ngrok or phone page', () => {
    const config = { provider: 'lmstudio' as const, baseUrl: 'http://127.0.0.1:1234/v1', model: 'local', apiKey: '' }
    expect(getLlmConnectionHint(config, 'https://wealth-demo.ngrok-free.dev/#/reviews')).toContain('ชี้กลับไปยังอุปกรณ์ที่เปิดหน้านี้')
    expect(getLlmConnectionHint(config, 'http://127.0.0.1:5173/#/reviews')).toBeNull()
    expect(getLlmConnectionHint({ ...config, provider: 'openrouter' }, 'https://wealth-demo.ngrok-free.dev')).toBeNull()
  })

  it('sends only the consented context to OpenRouter with ZDR and no tools', async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer session-key' })
      expect(body.provider).toEqual({ zdr: true })
      expect(body.reasoning).toEqual({ effort: 'minimal', exclude: true })
      expect(body.max_tokens).toBe(1800)
      expect(body.tools).toBeUndefined()
      expect(body.messages[1].content).toContain('"fieldsShared":["netWorth"]')
      expect(body.messages[1].content).not.toContain('portfolio-thai')
      return new Response(JSON.stringify({ model: 'openrouter/free', choices: [{ message: { content: 'ควรตรวจเงินสำรองก่อน' } }], usage: { prompt_tokens: 120, completion_tokens: 20, total_tokens: 140 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as unknown as typeof fetch
    const answer = await requestLlmAnswer({ provider: 'openrouter', baseUrl: 'https://evil.invalid', model: 'openrouter/free', apiKey: 'session-key' }, 'ควรดูอะไร', context, fetcher)
    expect(fetcher).toHaveBeenCalledWith('https://openrouter.ai/api/v1/chat/completions', expect.objectContaining({ method: 'POST' }))
    expect(answer).toEqual({ text: 'ควรตรวจเงินสำรองก่อน', model: 'openrouter/free', provider: 'openrouter', usage: { promptTokens: 120, completionTokens: 20, totalTokens: 140 } })
  })

  it('fails closed for missing credentials, unsafe URLs, and malformed provider output', async () => {
    await expect(requestLlmAnswer({ provider: 'openrouter', baseUrl: '', model: 'openrouter/free', apiKey: '' }, 'คำถาม', context)).rejects.toMatchObject({ code: 'authentication' })
    await expect(testLlmConnection({ provider: 'lmstudio', baseUrl: 'file:///tmp/model', model: 'local', apiKey: '' })).rejects.toMatchObject({ code: 'invalid-config' })
    const malformed = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: { unsafe: true } } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch
    await expect(requestLlmAnswer({ provider: 'lmstudio', baseUrl: 'http://127.0.0.1:1234/v1', model: 'local', apiKey: '' }, 'คำถาม', context, malformed)).rejects.toMatchObject({ code: 'invalid-response' })
  })

  it('maps provider authentication and rate-limit failures to stable error codes', async () => {
    const unauthorized = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'bad token' } }), { status: 401, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch
    await expect(testLlmConnection({ provider: 'lmstudio', baseUrl: 'http://127.0.0.1:1234/v1', model: 'local', apiKey: 'bad' }, unauthorized)).rejects.toMatchObject({ code: 'authentication', status: 401 })
    const limited = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'slow down' } }), { status: 429, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch
    await expect(requestLlmAnswer({ provider: 'openrouter', baseUrl: '', model: 'openrouter/free', apiKey: 'key' }, 'คำถาม', context, limited)).rejects.toMatchObject({ code: 'rate-limit', status: 429 })
  })

  it('accepts bounded text-part responses and explains 200-status provider errors', async () => {
    const parts = vi.fn(async () => new Response(JSON.stringify({ model: 'parts-model', choices: [{ message: { content: [{ type: 'text', text: 'ส่วนแรก' }, { type: 'output_text', text: 'ส่วนที่สอง' }, { type: 'image', text: 'ต้องไม่รวม' }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch
    await expect(requestLlmAnswer({ provider: 'lmstudio', baseUrl: 'http://127.0.0.1:1234/v1', model: 'parts-model', apiKey: '' }, 'คำถาม', context, parts)).resolves.toMatchObject({ text: 'ส่วนแรก\nส่วนที่สอง' })
    const providerError = vi.fn(async () => new Response(JSON.stringify({ error: { code: 429, message: 'Provider busy', metadata: { error_type: 'rate_limit_exceeded' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch
    await expect(requestLlmAnswer({ provider: 'openrouter', baseUrl: '', model: 'openrouter/free', apiKey: 'key' }, 'คำถาม', context, providerError)).rejects.toMatchObject({ code: 'rate-limit', status: 429 })
  })

  it('keeps a safe final answer when optional provider metadata has unfamiliar shapes', async () => {
    const compatibleVariation = vi.fn(async () => new Response(JSON.stringify({
      model: { provider_model: 'unexpected-but-irrelevant' },
      choices: [{
        finish_reason: { native: 'stop' },
        message: {
          content: [{ type: 'output_text', text: { value: 'คำตอบที่อ่านได้' } }],
          reasoning: [{ type: 'encrypted', data: 'must-not-render' }],
          refusal: { reason: 'not-a-string' },
        },
      }],
      usage: { prompt_tokens: '120', completion_tokens: -1, total_tokens: 140 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch

    await expect(requestLlmAnswer({ provider: 'openrouter', baseUrl: '', model: 'openrouter/free', apiKey: 'key' }, 'คำถาม', context, compatibleVariation)).resolves.toEqual({
      text: 'คำตอบที่อ่านได้',
      model: 'openrouter/free',
      provider: 'openrouter',
      usage: { promptTokens: null, completionTokens: null, totalTokens: 140 },
    })
  })

  it('returns actionable messages for empty, missing, and streaming-shaped answers', async () => {
    const emptyChoices = vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch
    await expect(requestLlmAnswer({ provider: 'openrouter', baseUrl: '', model: 'openrouter/free', apiKey: 'key' }, 'คำถาม', context, emptyChoices)).rejects.toMatchObject({ code: 'unavailable', message: expect.stringContaining('choices ว่าง') })

    const missingChoices = vi.fn(async () => new Response(JSON.stringify({ model: 'openrouter/free', usage: null }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch
    await expect(requestLlmAnswer({ provider: 'openrouter', baseUrl: '', model: 'openrouter/free', apiKey: 'key' }, 'คำถาม', context, missingChoices)).rejects.toMatchObject({ code: 'invalid-response', message: expect.stringContaining('ไม่ส่งรายการคำตอบ') })

    const streamChunk = vi.fn(async () => new Response(JSON.stringify({ choices: [{ delta: { content: 'partial' }, finish_reason: null }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch
    await expect(requestLlmAnswer({ provider: 'openrouter', baseUrl: '', model: 'openrouter/free', apiKey: 'key' }, 'คำถาม', context, streamChunk)).rejects.toMatchObject({ code: 'invalid-response', message: expect.stringContaining('streaming') })
  })

  it('maps stable OpenRouter availability and token-limit error types', async () => {
    const unavailable = vi.fn(async () => new Response(JSON.stringify({ error: { code: 502, message: 'empty upstream response', metadata: { error_type: 'provider_unavailable' } }, choices: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch
    await expect(requestLlmAnswer({ provider: 'openrouter', baseUrl: '', model: 'openrouter/free', apiKey: 'key' }, 'คำถาม', context, unavailable)).rejects.toMatchObject({ code: 'unavailable', message: expect.stringContaining('คำตอบว่างหรือไม่สมบูรณ์') })

    const tooLong = vi.fn(async () => new Response(JSON.stringify({ error: { code: 400, message: 'maximum context', metadata: { error_type: 'context_length_exceeded' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch
    await expect(requestLlmAnswer({ provider: 'openrouter', baseUrl: '', model: 'openrouter/free', apiKey: 'key' }, 'คำถาม', context, tooLong)).rejects.toMatchObject({ code: 'invalid-response', message: expect.stringContaining('context ยาวเกิน') })
  })

  it('does not expose reasoning as an answer when the model omits final content', async () => {
    const reasoningOnly = vi.fn(async () => new Response(JSON.stringify({ model: 'reasoner', choices: [{ message: { content: null, reasoning: 'private reasoning trace' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch
    await expect(requestLlmAnswer({ provider: 'openrouter', baseUrl: '', model: 'openrouter/free', apiKey: 'key' }, 'คำถาม', context, reasoningOnly)).rejects.toMatchObject({ code: 'invalid-response', message: expect.stringContaining('ไม่มี final answer') })
  })
})
