import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const appUrl = (process.env.FLOW_E2E_BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
const localBrowserPath = path.resolve('work', 'playwright-browsers')
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  try { await stat(localBrowserPath); process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowserPath } catch { /* use Playwright's normal cache */ }
}

const { chromium, webkit } = await import('playwright')
const requestedEngines = (process.argv[2] || 'chrome,webkit').split(',').map((item) => item.trim()).filter(Boolean)
const supportedEngines = new Set(['chrome', 'webkit'])
for (const engine of requestedEngines) if (!supportedEngines.has(engine)) throw new Error(`Unsupported responsive accessibility engine: ${engine}`)

const routes = ['studio', 'wealth', 'life', 'portfolio', 'scenario', 'retirement', 'protection', 'tax', 'legacy', 'data', 'reviews', 'vault', 'more']
const routeSelectors = {
  studio: '.topbar', wealth: '#wealth-map', life: '#life-canvas', portfolio: '#portfolio', scenario: '#scenario-lab',
  retirement: '#retirement-studio', protection: '#protection-studio', tax: '#tax-studio', legacy: '#legacy-studio',
  data: '.data-studio', reviews: '.review-studio', vault: '.vault-studio', more: '.more-hub',
}
const profiles = [
  { name: 'reflow-400-equivalent', viewport: { width: 320, height: 800 }, reducedMotion: 'reduce', forcedColors: 'none' },
  { name: 'reflow-200-equivalent', viewport: { width: 640, height: 720 }, reducedMotion: 'reduce', forcedColors: 'none' },
  { name: 'mobile-landscape', viewport: { width: 844, height: 390 }, reducedMotion: 'reduce', forcedColors: 'none' },
  { name: 'forced-colors-mobile', viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', forcedColors: 'active' },
]
const requestedProfileNames = (process.argv[3] || profiles.map((item) => item.name).join(',')).split(',').map((item) => item.trim()).filter(Boolean)
const selectedProfiles = profiles.filter((profile) => requestedProfileNames.includes(profile.name))
for (const profileName of requestedProfileNames) {
  if (!profiles.some((profile) => profile.name === profileName)) throw new Error(`Unsupported responsive accessibility profile: ${profileName}`)
}
const runId = new Date().toISOString().replaceAll(/[:.]/g, '-')
const artifactDir = path.resolve('work', 'responsive-accessibility', runId)
await mkdir(artifactDir, { recursive: true })

async function firstExisting(paths) {
  for (const candidate of paths) {
    try { await stat(candidate); return candidate } catch { /* try the next known installation */ }
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

async function navigate(page, route) {
  await page.goto(`${appUrl}/#/${route}`, { waitUntil: 'domcontentloaded' })
  await page.locator('main').waitFor({ state: 'visible' })
  await page.waitForFunction(() => document.title.includes('Flow Wealth Studio'))
  await page.locator(routeSelectors[route]).waitFor({ state: 'visible' })
  const savingStatus = page.locator('.save-status.saving')
  if (await savingStatus.count()) await savingStatus.waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => {})
  await page.waitForTimeout(80)
}

async function auditRoute(page, route, profile) {
  await navigate(page, route)
  const layout = await page.evaluate(({ width, forcedColors, reducedMotion }) => {
    const visible = (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
    const signature = (element) => ({
      tag: element.tagName.toLowerCase(),
      classes: [...element.classList].sort(),
      role: element.getAttribute('role'),
      type: element.getAttribute('type'),
    })
    const targetElements = [...document.querySelectorAll('button:not(:disabled),summary,[role="button"],[role="switch"]')]
      .filter((element) => visible(element))
    const undersizedTargets = targetElements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { ...signature(element), width: Math.round(rect.width * 10) / 10, height: Math.round(rect.height * 10) / 10 }
    }).filter((item) => item.width < 24 || item.height < 24)
    const activeControls = [...document.querySelectorAll('button.active')].filter((element) => visible(element))
    const missingState = activeControls.filter((element) => element.closest('nav')
      ? element.getAttribute('aria-current') !== 'page'
      : element.getAttribute('aria-pressed') !== 'true').map(signature)
    const runningAnimations = document.getAnimations().filter((animation) => animation.playState === 'running').map((animation) => ({
      duration: Number(animation.effect?.getTiming().duration) || 0,
      iterations: Number(animation.effect?.getTiming().iterations) || 0,
    })).filter((animation) => animation.duration > 1 || animation.iterations > 1)
    const mobileNav = document.querySelector('.mobile-bottom-nav')
    const sidebar = document.querySelector('.sidebar')
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      undersizedTargets,
      missingState,
      runningAnimations,
      forcedColorsMatches: matchMedia('(forced-colors: active)').matches,
      reducedMotionMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
      mobileNavVisible: Boolean(mobileNav && visible(mobileNav)),
      sidebarVisible: Boolean(sidebar && visible(sidebar)),
      expectedMobileNavigation: width <= 760,
      expectedForcedColors: forcedColors === 'active',
      expectedReducedMotion: reducedMotion === 'reduce',
    }
  }, { width: profile.viewport.width, forcedColors: profile.forcedColors, reducedMotion: profile.reducedMotion })

  await page.evaluate(() => {
    document.body.setAttribute('tabindex', '-1')
    document.body.focus({ preventScroll: true })
    document.body.removeAttribute('tabindex')
  })
  const focusStops = []
  for (let index = 0; index < 16; index += 1) {
    await page.keyboard.press('Tab')
    // Forced-colors focus rings are resolved at paint time in both browser engines.
    if (profile.forcedColors === 'active') await page.waitForTimeout(16)
    const stop = await page.evaluate(() => {
      const element = document.activeElement
      if (!element || element === document.body) return null
      const style = getComputedStyle(element)
      const focusContainer = element.closest('label')
      const containerStyle = focusContainer ? getComputedStyle(focusContainer) : null
      const forcedColorBorder = style.forcedColorAdjust === 'none' && Number.parseFloat(style.borderTopWidth) >= 3
      const containerIndicator = Boolean(containerStyle && containerStyle.outlineStyle !== 'none' && containerStyle.outlineWidth !== '0px')
      return {
        tag: element.tagName.toLowerCase(),
        classes: [...element.classList].sort(),
        type: element.getAttribute('type'),
        parentClasses: [...(element.parentElement?.classList ?? [])].sort(),
        focused: element.matches(':focus'),
        focusVisible: element.matches(':focus-visible'),
        connected: element.isConnected,
        outlineWidth: style.outlineWidth,
        borderTopWidth: style.borderTopWidth,
        forcedColorAdjust: style.forcedColorAdjust,
        containerIndicator,
        indicator: (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none' || forcedColorBorder || containerIndicator,
      }
    })
    if (stop) focusStops.push(stop)
  }
  const uniqueFocusStops = new Set(focusStops.map((item) => `${item.tag}:${item.classes.join('.')}`)).size
  const focusIndicatorMisses = focusStops.filter((item) => !item.indicator)

  const failures = []
  if (layout.overflow) failures.push('horizontal-page-overflow')
  if (layout.undersizedTargets.length) failures.push('target-smaller-than-24-css-px')
  if (layout.missingState.length) failures.push('active-control-missing-state')
  if (layout.runningAnimations.length) failures.push('motion-running-under-reduced-motion')
  if (layout.forcedColorsMatches !== layout.expectedForcedColors) failures.push('forced-colors-media-mismatch')
  if (layout.reducedMotionMatches !== layout.expectedReducedMotion) failures.push('reduced-motion-media-mismatch')
  if (layout.mobileNavVisible !== layout.expectedMobileNavigation || layout.sidebarVisible === layout.expectedMobileNavigation) failures.push('navigation-breakpoint-mismatch')
  if (uniqueFocusStops < 3) failures.push('insufficient-keyboard-focus-stops')
  if (focusIndicatorMisses.length) failures.push('missing-focus-indicator')

  return { route, ...layout, uniqueFocusStops, focusIndicatorMisses, failures }
}

async function auditProfile(browser, engine, profile) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    reducedMotion: profile.reducedMotion,
    forcedColors: profile.forcedColors,
  })
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
  try {
    const routeReports = []
    for (const route of routes) routeReports.push(await auditRoute(page, route, profile))
    await navigate(page, 'studio')
    await page.screenshot({ path: path.join(artifactDir, `${engine}-${profile.name}.png`), fullPage: false })
    const externalOrigins = [...networkOrigins].filter((origin) => origin !== appUrl)
    const failures = routeReports.flatMap((route) => route.failures.map((type) => ({ route: route.route, type })))
    if (runtimeIssues.length) failures.push({ route: null, type: 'runtime-issue', count: runtimeIssues.length })
    if (consoleIssues.length) failures.push({ route: null, type: 'console-issue', count: consoleIssues.length })
    if (externalOrigins.length) failures.push({ route: null, type: 'external-origin', count: externalOrigins.length })
    return { engine, browserVersion: browser.version(), profile, routes: routeReports, runtimeIssues, consoleIssues, pageNetworkOrigins: [...networkOrigins], externalOrigins, failures }
  } finally {
    await context.close()
  }
}

async function auditProfileWithRetry(browser, engine, profile) {
  try {
    return await auditProfile(browser, engine, profile)
  } catch (firstError) {
    console.warn(`Responsive audit retry: ${engine}/${profile.name}: ${firstError instanceof Error ? firstError.message : 'unknown error'}`)
    return auditProfile(browser, engine, profile)
  }
}

const report = { runId, profiles: selectedProfiles, engines: [], failures: [] }
for (const engine of requestedEngines) {
  let browser
  try {
    browser = await launch(engine)
    for (const profile of selectedProfiles) {
      const result = await auditProfileWithRetry(browser, engine, profile)
      report.engines.push(result)
      report.failures.push(...result.failures.map((failure) => ({ engine, profile: profile.name, ...failure })))
    }
  } catch (error) {
    report.failures.push({ engine, profile: null, route: null, type: 'launch-or-audit', message: error instanceof Error ? error.message.slice(0, 500) : 'Unknown error' })
  } finally {
    if (browser) await browser.close()
  }
}

await writeFile(path.join(artifactDir, 'report.json'), JSON.stringify(report, null, 2))
await writeFile(path.resolve('work', 'responsive-accessibility', 'latest-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({
  engines: [...new Set(report.engines.map((item) => item.engine))],
  profiles: selectedProfiles.map((item) => item.name),
  routeAudits: report.engines.reduce((total, item) => total + item.routes.length, 0),
  failures: report.failures,
  artifactDir,
}, null, 2))
if (report.failures.length) {
  for (const failure of report.failures) {
    const location = [failure.engine, failure.profile, failure.route].filter(Boolean).join('/') || 'responsive-matrix'
    const detail = failure.message ? `${failure.type}: ${failure.message}` : failure.type
    console.error(`::error title=Responsive accessibility (${location})::${detail.replaceAll(/\r?\n/g, ' ')}`)
  }
  process.exitCode = 1
}
