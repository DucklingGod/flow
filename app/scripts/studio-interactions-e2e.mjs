import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium, webkit } from 'playwright'

const baseUrl = process.env.FLOW_E2E_URL || 'http://127.0.0.1:5173'
const runId = new Date().toISOString().replaceAll(/[:.]/g, '-')
const outputDir = path.resolve('work', 'studio-interactions', runId)
await mkdir(outputDir, { recursive: true })

const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 1000 }, pointer: 'mouse' },
  { name: 'mobile', viewport: { width: 390, height: 844 }, pointer: 'touch' },
]
const routes = ['studio', 'wealth', 'life', 'portfolio', 'scenario', 'retirement', 'protection', 'tax', 'legacy', 'data', 'reviews', 'vault', 'more']
const reports = []
const failures = []
const requestedEngine = process.argv[2] || 'chrome'

async function firstExisting(paths) {
  for (const candidate of paths) {
    try { await stat(candidate); return candidate } catch { /* try the next known installation */ }
  }
  return null
}

async function launchBrowser() {
  if (requestedEngine === 'webkit') return webkit.launch({ headless: true })
  if (requestedEngine !== 'chrome') throw new Error(`Unsupported browser engine: ${requestedEngine}`)
  const executablePath = process.env.FLOW_CHROME_PATH || await firstExisting(process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ]
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'])
  if (!executablePath) throw new Error('Chrome or Edge executable was not found; set FLOW_CHROME_PATH')
  return chromium.launch({ executablePath, headless: true, args: process.platform === 'win32' ? ['--no-sandbox', '--disable-gpu', '--disable-software-rasterizer'] : [] })
}

function assert(condition, message, detail = {}) {
  if (!condition) throw new Error(`${message}: ${JSON.stringify(detail)}`)
}

const browser = await launchBrowser()
try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: profile.viewport, hasTouch: profile.pointer === 'touch' })
    const page = await context.newPage()
    const runtimeIssues = []
    const consoleIssues = []
    const networkOrigins = new Set()
    page.on('pageerror', (error) => runtimeIssues.push(error.name))
    page.on('console', (message) => { if (message.type() === 'error') consoleIssues.push(message.text().slice(0, 200)) })
    page.on('request', (request) => { try { networkOrigins.add(new URL(request.url()).origin) } catch { /* non-URL request */ } })

    try {
      await page.goto(`${baseUrl}/#/studio`, { waitUntil: 'networkidle' })
      const monthly = page.getByRole('spinbutton', { name: /ลงทุนทุกเดือน/ })
      await monthly.waitFor()
      assert(await monthly.inputValue() === '15,000', 'Default monthly input is not grouped', { value: await monthly.inputValue() })
      await monthly.fill('1234567')
      assert(await monthly.inputValue() === '1,234,567', 'Seven-digit input was not grouped immediately', { value: await monthly.inputValue() })
      await monthly.press('ControlOrMeta+A')
      await monthly.pressSequentially('22000')
      await monthly.press('Tab')
      assert(await monthly.inputValue() === '22,000', 'Keyboard entry did not retain grouped committed value', { value: await monthly.inputValue() })

      const chart = page.getByRole('slider', { name: 'สำรวจกราฟประมาณการตามปี' })
      await chart.press('Home')
      assert(await chart.getAttribute('aria-valuenow') === '0', 'Chart Home key did not select first year')
      await chart.press('ArrowRight')
      assert(await chart.getAttribute('aria-valuenow') === '1', 'Chart arrow key did not advance one year')
      const chartBounds = await chart.boundingBox()
      assert(Boolean(chartBounds), 'Interactive chart has no bounding box')
      if (chartBounds && profile.pointer === 'mouse') await page.mouse.move(chartBounds.x + chartBounds.width * .5, chartBounds.y + chartBounds.height * .55)
      else if (chartBounds) await chart.dispatchEvent('pointerdown', { clientX: chartBounds.x + chartBounds.width * .5, clientY: chartBounds.y + chartBounds.height * .5, pointerType: 'touch', isPrimary: true })
      const pointerYear = Number(await chart.getAttribute('aria-valuenow'))
      const maxYear = Number(await chart.getAttribute('aria-valuemax'))
      assert(pointerYear >= Math.floor(maxYear / 2) - 1 && pointerYear <= Math.ceil(maxYear / 2) + 1, 'Pointer did not select nearest middle year', { pointerYear, maxYear })

      const nominalLegend = page.getByRole('button', { name: 'มูลค่าพอร์ตหลังภาษี' })
      await nominalLegend.click()
      assert(await nominalLegend.getAttribute('aria-pressed') === 'false' && await page.locator('[data-series="nominal"]').count() === 0, 'Legend did not hide nominal series')
      await nominalLegend.click()
      assert(await nominalLegend.getAttribute('aria-pressed') === 'true' && await page.locator('[data-series="nominal"]').count() === 1, 'Legend did not restore nominal series')

      const routeAudits = []
      for (const route of routes) {
        await page.goto(`${baseUrl}/#/${route}`, { waitUntil: 'networkidle' })
        await page.locator('main').waitFor()
        const audit = await page.evaluate(() => ({
          nativeNumberInputs: document.querySelectorAll('input[type="number"]').length,
          formattedNumberInputs: document.querySelectorAll('input[data-formatted-number="true"]').length,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        }))
        assert(audit.nativeNumberInputs === 0, `Route ${route} still renders a native numeric input`, audit)
        assert(!audit.overflow, `Route ${route} overflows horizontally`, audit)
        routeAudits.push({ route, ...audit })
      }
      await page.goto(`${baseUrl}/#/studio`, { waitUntil: 'networkidle' })
      const screenshot = path.join(outputDir, `${profile.name}.png`)
      await page.locator('.projection-panel').screenshot({ path: screenshot })
      assert(runtimeIssues.length === 0 && consoleIssues.length === 0, 'Runtime or console issues detected', { runtimeIssues, consoleIssues })
      assert([...networkOrigins].every((origin) => /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)), 'Unexpected external page request', { networkOrigins: [...networkOrigins] })
      reports.push({ profile, chart: { keyboardYear: 1, pointerYear, maxYear, legendToggle: true }, numericInput: { default: '15,000', sevenDigits: '1,234,567', committed: '22,000' }, routeAudits, runtimeIssues, consoleIssues, networkOrigins: [...networkOrigins], screenshot })
    } catch (error) {
      failures.push({ profile: profile.name, message: error instanceof Error ? error.message : String(error) })
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}

const report = { runId, engine: requestedEngine, reports, failures }
await writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2))
await writeFile(path.resolve('work', 'studio-interactions', 'latest-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ runId, outputDir, reports: reports.length, routeAudits: reports.reduce((sum, item) => sum + item.routeAudits.length, 0), failures }, null, 2))
if (failures.length || reports.length !== profiles.length) process.exitCode = 1
