import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const appUrl = (process.env.FLOW_E2E_BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
const localBrowserPath = path.resolve('work', 'playwright-browsers')
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  try { await stat(localBrowserPath); process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowserPath } catch { /* use normal cache */ }
}
const { webkit } = await import('playwright')
const runId = new Date().toISOString().replaceAll(/[:.]/g, '-')
const artifactDir = path.resolve('work', 'acceptance-snapshot', runId)
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
    const networkOrigins = new Set()
    page.on('pageerror', (error) => runtimeIssues.push(error.message))
    page.on('console', (message) => { if (['warning', 'error'].includes(message.type())) consoleIssues.push(`${message.type()}:${message.text()}`) })
    page.on('request', (request) => { try { const url = new URL(request.url()); if (['http:', 'https:'].includes(url.protocol)) networkOrigins.add(url.origin) } catch { /* browser-internal */ } })
    try {
      await page.goto(`${appUrl}/#/reviews`, { waitUntil: 'domcontentloaded' })
      await page.locator('.acceptance-studio').waitFor()
      const cards = page.locator('.acceptance-question')
      assert(await cards.count() === 4, 'Acceptance snapshot does not contain four questions')
      const questionText = await cards.locator('header small').allTextContents()
      assert(questionText.join('|').includes('ตอนนี้อยู่ตรงไหน') && questionText.join('|').includes('จะถึงเป้าหมายหรือไม่') && questionText.join('|').includes('ความเสี่ยงคืออะไร') && questionText.join('|').includes('เดือนนี้ควรทำอะไรต่อ'), 'Four-question labels are incomplete', questionText)
      assert((await page.locator('.acceptance-heading-actions .source-chip').textContent())?.includes('pending'), 'Product-owner decision was not kept pending')
      assert(await page.locator('.acceptance-actions li').count() > 0, 'No pending-user monthly action was rendered')
      assert((await page.locator('.acceptance-limitations').textContent())?.includes('G6/G7/G9'), 'External gate limitations are missing')
      const actionCountBefore = await page.locator('.action-board article').count()
      const popupPromise = page.waitForEvent('popup')
      await page.getByRole('button', { name: 'พิมพ์ / Save PDF' }).click()
      const reportPage = await popupPromise
      await reportPage.waitForLoadState('domcontentloaded')
      const reportText = await reportPage.locator('body').textContent()
      assert(reportText?.includes('Four-question acceptance snapshot') && reportText.includes('Product-owner decision: pending'), 'Printable packet is missing pending acceptance evidence')
      assert(reportText?.includes('G6/G7/G9 and Final Gate remain pending'), 'Printable packet appears to self-approve a gate')
      assert(await reportPage.locator('script').count() === 0, 'Printable packet contains executable script')
      await reportPage.close()
      assert(await page.locator('.action-board article').count() === actionCountBefore, 'Opening acceptance packet mutated plan actions')
      const viewport = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }))
      assert(viewport.scrollWidth <= viewport.clientWidth + 1, 'Acceptance snapshot causes horizontal overflow', viewport)
      assert(runtimeIssues.length === 0 && consoleIssues.length === 0, 'Runtime issue in acceptance snapshot', { runtimeIssues, consoleIssues })
      assert([...networkOrigins].every((origin) => origin === new URL(appUrl).origin), 'Acceptance snapshot contacted an external origin', [...networkOrigins])
      const screenshot = path.join(artifactDir, `${profile.name}.png`)
      await page.locator('.acceptance-studio').screenshot({ path: screenshot })
      reports.push({ profile, questions: 4, monthlyActions: await page.locator('.acceptance-actions li').count(), decision: 'pending', printablePacket: true, planMutation: false, overflow: false, networkOrigins: [...networkOrigins], screenshot })
    } catch (error) { failures.push({ profile, error: error instanceof Error ? error.message : String(error) }) }
    finally { await context.close() }
  }
} finally { await browser.close() }

const report = { runId, reports, failures }
await writeFile(path.join(artifactDir, 'report.json'), JSON.stringify(report, null, 2))
await writeFile(path.resolve('work', 'acceptance-snapshot', 'latest-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
if (failures.length) process.exitCode = 1
