import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const appUrl = (process.env.FLOW_E2E_BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
const localBrowserPath = path.resolve('work', 'playwright-browsers')
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  try { await stat(localBrowserPath); process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowserPath } catch { /* use normal Playwright cache */ }
}
const { webkit } = await import('playwright')
const runId = new Date().toISOString().replaceAll(/[:.]/g, '-')
const artifactDir = path.resolve('work', 'llm-connectors', runId)
await mkdir(artifactDir, { recursive: true })
const profiles = [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]
const reports = []
const failures = []

function assert(condition, message, detail) {
  if (!condition) throw new Error(`${message}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`)
}

const browser = await webkit.launch({ headless: true })
try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height } })
    const page = await context.newPage()
    const runtimeIssues = []
    const consoleIssues = []
    let interceptedBody = null
    page.on('pageerror', (error) => runtimeIssues.push(error.message))
    page.on('console', (message) => { if (['warning', 'error'].includes(message.type())) consoleIssues.push(`${message.type()}:${message.text()}`) })
    await page.route('https://openrouter.ai/api/v1/chat/completions', async (route) => {
      interceptedBody = JSON.parse(route.request().postData() || '{}')
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        model: { provider_model: 'unfamiliar-optional-shape' },
        choices: [{ finish_reason: { native: 'stop' }, message: {
          content: [{ type: 'output_text', text: { value: 'ภาพรวมจากข้อมูลที่อนุญาต 1. **เงินสำรอง** - ตรวจจำนวนเดือนที่รองรับค่าใช้จ่าย - ทบทวนอีกครั้งเมื่อรายจ่ายเปลี่ยน 2. **เป้าหมาย** - เปรียบเทียบ funding gap โดยไม่สั่งซื้อขาย <script>window.__unsafe=true</script>' } }],
          reasoning: [{ type: 'encrypted', data: 'must-not-render' }],
          refusal: { reason: 'not-a-string' },
        } }],
        usage: { prompt_tokens: '100', completion_tokens: -1, total_tokens: 160 },
      }) })
    })
    try {
      await page.goto(`${appUrl}/#/reviews`, { waitUntil: 'domcontentloaded' })
      await page.locator('.review-studio').waitFor()
      await page.locator('.copilot-switch').click()
      await page.locator('.copilot-provider-tabs').getByRole('button', { name: 'OpenRouter' }).click()
      const config = page.locator('.llm-provider-config.openrouter')
      await config.locator('input[aria-label="LLM API credential"]').fill('browser-test-session-key')
      await config.getByRole('checkbox').check()
      await page.locator('.copilot-question textarea').fill('ควรทบทวนอะไรต่อ')
      await page.locator('.copilot-question button').click()
      const answer = page.locator('.copilot-answer')
      await answer.waitFor()
      const textareaBox = await page.locator('.copilot-question textarea').boundingBox()
      const buttonBox = await page.locator('.copilot-question button').boundingBox()
      const layout = { textareaBox, buttonBox }
      if (profile.name === 'desktop') assert(textareaBox && buttonBox && Math.abs(textareaBox.y - buttonBox.y) < 1 && Math.abs(textareaBox.height - buttonBox.height) < 1, 'Desktop ask button is not aligned with the textarea', layout)
      else assert(textareaBox && buttonBox && buttonBox.y > textareaBox.y + textareaBox.height && Math.abs(buttonBox.width - textareaBox.width) < 1, 'Mobile ask button is not a full-width row below the textarea', layout)
      assert(await answer.locator('ol > li').count() === 2, 'Numbered provider answer was not structured into a readable list')
      assert(await answer.locator('strong').count() >= 2, 'Provider emphasis was not rendered')
      assert(!(await answer.textContent()).includes('**'), 'Raw Markdown markers remain visible')
      assert(await answer.locator('script').count() === 0 && await page.evaluate(() => window.__unsafe) === undefined, 'Provider HTML executed instead of rendering as text')
      assert(interceptedBody?.provider?.zdr === true && interceptedBody?.tools === undefined, 'OpenRouter request boundary mismatch', interceptedBody)
      assert((await page.locator('.copilot-brief .source-chip').textContent())?.includes('OpenRouter · no tools'), 'Provider provenance chip mismatch')
      assert((await page.locator('.llm-provider-actions .llm-status').textContent())?.includes('OpenRouter · openrouter/free · 160 tokens'), 'Fallback model or best-effort usage provenance mismatch')
      const screenshot = path.join(artifactDir, `${profile.name}.png`)
      await page.screenshot({ path: screenshot, fullPage: true })
      await page.locator('.copilot-provider-tabs').getByRole('button', { name: 'LM Studio' }).click()
      assert(await page.locator('.llm-provider-config.lmstudio input[aria-label="LLM API credential"]').inputValue() === '', 'Credential survived provider switch')
      assert(runtimeIssues.length === 0 && consoleIssues.length === 0, 'Runtime issue in connector UI', { runtimeIssues, consoleIssues })
      reports.push({ profile, layout, structuredItems: 2, provider: 'openrouter/free', usage: 160, tolerantOptionalMetadata: true, zdr: true, tools: false, htmlExecuted: false, credentialSessionOnly: true, actualExternalRequest: false, screenshot })
    } catch (error) { failures.push({ profile, error: error instanceof Error ? error.message : String(error) }) }
    finally { await context.close() }
  }
} finally { await browser.close() }

const report = { runId, reports, failures }
await writeFile(path.join(artifactDir, 'report.json'), JSON.stringify(report, null, 2))
await writeFile(path.resolve('work', 'llm-connectors', 'latest-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (failures.length) process.exitCode = 1
