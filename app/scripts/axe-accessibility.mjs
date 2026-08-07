import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import axeCore from 'axe-core'

const appUrl = (process.env.FLOW_E2E_BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
const localBrowserPath = path.resolve('work', 'playwright-browsers')
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  try { await stat(localBrowserPath); process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowserPath } catch { /* use Playwright's normal cache */ }
}

const { chromium, webkit } = await import('playwright')
const requestedEngines = (process.argv[2] || 'chrome,webkit').split(',').map((item) => item.trim()).filter(Boolean)
const supportedEngines = new Set(['chrome', 'webkit'])
for (const engine of requestedEngines) if (!supportedEngines.has(engine)) throw new Error(`Unsupported accessibility engine: ${engine}`)

const routes = ['studio', 'wealth', 'life', 'portfolio', 'scenario', 'retirement', 'protection', 'tax', 'legacy', 'data', 'reviews', 'vault', 'more']
const routeSelectors = {
  studio: '.topbar', wealth: '#wealth-map', life: '#life-canvas', portfolio: '#portfolio', scenario: '#scenario-lab',
  retirement: '#retirement-studio', protection: '#protection-studio', tax: '#tax-studio', legacy: '#legacy-studio',
  data: '.data-studio', reviews: '.review-studio', vault: '.vault-studio', more: '.more-hub',
}
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
]
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const runId = new Date().toISOString().replaceAll(/[:.]/g, '-')
const artifactDir = path.resolve('work', 'accessibility', runId)
await mkdir(artifactDir, { recursive: true })

async function firstExisting(paths) {
  for (const candidate of paths) {
    try { await stat(candidate); return candidate } catch { /* try next known installation */ }
  }
  return null
}

async function launch(engine) {
  if (engine === 'webkit') return webkit.launch({ headless: true })
  const executablePath = process.env.FLOW_CHROME_PATH || await firstExisting(process.platform === 'win32'
    ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe']
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'])
  if (!executablePath) throw new Error('Chrome executable was not found; set FLOW_CHROME_PATH')
  return chromium.launch({ executablePath, headless: true, args: process.platform === 'win32' ? ['--no-sandbox', '--disable-gpu', '--disable-software-rasterizer'] : [] })
}

const summarize = (items) => items.map((item) => ({
  id: item.id,
  impact: item.impact,
  help: item.help,
  nodeCount: item.nodes.length,
  checkIds: [...new Set(item.nodes.flatMap((node) => [...node.any, ...node.all, ...node.none].map((check) => check.id)))],
  nodeSignatures: item.nodes.map((node) => ({
    tag: node.html.match(/^<([a-zA-Z0-9-]+)/)?.[1]?.toLowerCase() ?? 'unknown',
    classes: (node.html.match(/\sclass="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean).sort(),
    attributes: [...new Set([...node.html.matchAll(/\s([a-zA-Z_:][a-zA-Z0-9:._-]*)=/g)].map((match) => match[1].toLowerCase()))].sort(),
    contrast: item.id === 'color-contrast' ? [...node.any, ...node.all, ...node.none].map((check) => check.data).filter(Boolean).map((data) => ({
      contrastRatio: data.contrastRatio,
      expectedContrastRatio: data.expectedContrastRatio,
      fgColor: data.fgColor,
      bgColor: data.bgColor,
      fontSize: data.fontSize,
      fontWeight: data.fontWeight,
    })) : [],
  })),
}))

async function scanPage(page) {
  const savingStatus = page.locator('.save-status.saving')
  if (await savingStatus.count()) await savingStatus.waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => {})
  await page.waitForTimeout(60)
  return page.evaluate(async ({ tags }) => {
    if (!globalThis.axe) throw new Error('axe-core was not initialized')
    const axeResult = await globalThis.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations', 'incomplete', 'passes'] })
    const visible = (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
    const activeButtons = [...document.querySelectorAll('button.active')].filter((element) => visible(element))
    const missingState = activeButtons.filter((element) => element.closest('nav')
      ? element.getAttribute('aria-current') !== 'page'
      : element.getAttribute('aria-pressed') !== 'true').length
    const visibleCurrentPages = [...document.querySelectorAll('nav [aria-current="page"]')].filter((element) => visible(element)).length
    return { axeResult, stateSemantics: { visibleCurrentPages, activeButtons: activeButtons.length, missingState } }
  }, { tags: axeTags })
}

function appendRouteReport(routeReports, route, result) {
  routeReports.push({ route, violations: summarize(result.axeResult.violations), incomplete: summarize(result.axeResult.incomplete), passes: result.axeResult.passes.length, stateSemantics: result.stateSemantics })
}

async function auditEngine(engine) {
  const browser = await launch(engine)
  const engineReport = { engine, browserVersion: browser.version(), viewports: [], launchError: null }
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce' })
      await context.addInitScript({ content: axeCore.source })
      const page = await context.newPage()
      const runtimeIssues = []
      const consoleIssues = []
      const networkOrigins = new Set()
      page.on('pageerror', (error) => runtimeIssues.push(error.name))
      page.on('console', (message) => { if (['warning', 'error'].includes(message.type())) consoleIssues.push(message.type()) })
      page.on('request', (request) => {
        try {
          const url = new URL(request.url())
          if (['http:', 'https:'].includes(url.protocol)) networkOrigins.add(url.origin)
        } catch { /* browser-internal URL */ }
      })
      const routeReports = []
      for (const route of routes) {
        await page.goto(`${appUrl}/#/${route}`, { waitUntil: 'domcontentloaded' })
        await page.locator('main').waitFor({ state: 'visible' })
        await page.waitForFunction(() => document.title.includes('Flow Wealth Studio'))
        await page.locator(routeSelectors[route]).waitFor({ state: 'visible' })
        appendRouteReport(routeReports, route, await scanPage(page))
        if (route === 'protection') {
          await page.locator('.protection-gate button').click()
          await page.locator('.protection-studio.enabled').waitFor({ state: 'visible' })
          appendRouteReport(routeReports, 'protection:estimate', await scanPage(page))
        }
        if (route === 'tax') {
          await page.locator('.tax-gate button').click()
          await page.locator('.tax-results:not(.locked)').waitFor({ state: 'visible' })
          appendRouteReport(routeReports, 'tax:estimate', await scanPage(page))
        }
      }
      const externalOrigins = [...networkOrigins].filter((origin) => origin !== appUrl)
      engineReport.viewports.push({ viewport, routes: routeReports, runtimeIssues, consoleIssues, pageNetworkOrigins: [...networkOrigins], externalOrigins })
      await context.close()
    }
  } finally {
    await browser.close()
  }
  return engineReport
}

const report = { runId, axeVersion: axeCore.version, tags: axeTags, engines: [], failures: [] }
for (const engine of requestedEngines) {
  try {
    const engineReport = await auditEngine(engine)
    report.engines.push(engineReport)
    for (const viewport of engineReport.viewports) {
      for (const route of viewport.routes) {
        if (route.violations.length) report.failures.push({ engine, viewport: viewport.viewport.name, route: route.route, type: 'wcag-violation', issues: route.violations })
        if (route.stateSemantics.missingState > 0) report.failures.push({ engine, viewport: viewport.viewport.name, route: route.route, type: 'state-semantics', details: route.stateSemantics })
      }
      if (viewport.runtimeIssues.length) report.failures.push({ engine, viewport: viewport.viewport.name, type: 'runtime', count: viewport.runtimeIssues.length })
      if (viewport.consoleIssues.length) report.failures.push({ engine, viewport: viewport.viewport.name, type: 'console', count: viewport.consoleIssues.length })
      if (viewport.externalOrigins.length) report.failures.push({ engine, viewport: viewport.viewport.name, type: 'external-origin', count: viewport.externalOrigins.length })
    }
  } catch (error) {
    report.failures.push({ engine, type: 'launch-or-audit', message: error instanceof Error ? error.message.slice(0, 500) : 'Unknown accessibility audit error' })
  }
}

await writeFile(path.join(artifactDir, 'report.json'), JSON.stringify(report, null, 2))
await writeFile(path.resolve('work', 'accessibility', 'latest-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ axeVersion: report.axeVersion, engines: report.engines.map((item) => item.engine), failures: report.failures, artifactDir }, null, 2))
if (report.failures.length) process.exitCode = 1
