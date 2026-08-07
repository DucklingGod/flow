import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const appUrl = (process.env.FLOW_E2E_BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
const localBrowserPath = path.resolve('work', 'playwright-browsers')
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  try { await stat(localBrowserPath); process.env.PLAYWRIGHT_BROWSERS_PATH = localBrowserPath } catch { /* use Playwright's normal cache */ }
}

const { firefox, webkit } = await import('playwright')
const availableEngines = { firefox, webkit }
const requestedEngines = (process.argv[2] || 'firefox,webkit').split(',').map((item) => item.trim()).filter(Boolean)
for (const engine of requestedEngines) if (!(engine in availableEngines)) throw new Error(`Unsupported engine: ${engine}`)

const availableViewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
]
const requestedViewportNames = (process.argv[3] || 'desktop,mobile').split(',').map((item) => item.trim()).filter(Boolean)
const viewports = availableViewports.filter((viewport) => requestedViewportNames.includes(viewport.name))
for (const viewportName of requestedViewportNames) {
  if (!availableViewports.some((viewport) => viewport.name === viewportName)) throw new Error(`Unsupported viewport: ${viewportName}`)
}
const routes = ['studio', 'wealth', 'life', 'portfolio', 'scenario', 'retirement', 'protection', 'tax', 'legacy', 'data', 'reviews', 'vault', 'more']
const routeSelectors = {
  studio: '.topbar', wealth: '#wealth-map', life: '#life-canvas', portfolio: '#portfolio', scenario: '#scenario-lab',
  retirement: '#retirement-studio', protection: '#protection-studio', tax: '#tax-studio', legacy: '#legacy-studio',
  data: '.data-studio', reviews: '.review-studio', vault: '.vault-studio', more: '.more-hub',
}
const runId = new Date().toISOString().replaceAll(/[:.]/g, '-')
const rootArtifactDir = path.resolve('work', 'cross-browser', runId)
await mkdir(rootArtifactDir, { recursive: true })

function assert(condition, message, details) {
  if (!condition) throw new Error(`${message}${details === undefined ? '' : `: ${JSON.stringify(details)}`}`)
}

async function navigate(page, route) {
  await page.goto(`${appUrl}/#/${route}`, { waitUntil: 'domcontentloaded' })
  await page.locator('main').waitFor({ state: 'visible' })
  await page.waitForFunction(() => document.title.includes('Flow Wealth Studio'))
  await page.locator(routeSelectors[route]).waitFor({ state: 'visible' })
}

async function auditRoutes(page) {
  const audits = []
  for (const route of routes) {
    await navigate(page, route)
    const structure = await page.evaluate(() => {
      const visible = (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
      const controls = [...document.querySelectorAll('button,input,select,textarea,a[href],summary,[tabindex]')].filter((element) => visible(element) && !element.disabled && element.getAttribute('tabindex') !== '-1')
      const name = (element) => element.getAttribute('aria-label') || [...(element.labels || [])].map((label) => label.textContent).join(' ') || element.closest('label')?.textContent || element.getAttribute('title') || element.textContent || element.getAttribute('name') || ''
      return {
        heading: document.querySelector('main h1,main h2')?.textContent?.trim() || '',
        controls: controls.length,
        unnamedControls: controls.filter((element) => !String(name(element)).trim()).length,
        unnamedControlDetails: controls.filter((element) => !String(name(element)).trim()).map((element) => ({ tag: element.tagName, type: element.getAttribute('type'), role: element.getAttribute('role'), html: element.outerHTML.slice(0, 220) })),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        stateSemantics: (() => {
          const activeButtons = [...document.querySelectorAll('button.active')].filter((element) => visible(element))
          const missing = activeButtons.filter((element) => element.closest('nav')
            ? element.getAttribute('aria-current') !== 'page'
            : element.getAttribute('aria-pressed') !== 'true')
          return {
            visibleCurrentPages: [...document.querySelectorAll('nav [aria-current="page"]')].filter((element) => visible(element)).length,
            activeButtons: activeButtons.length,
            missingState: missing.length,
          }
        })(),
      }
    })
    const focusStops = []
    await page.evaluate(() => {
      document.body.setAttribute('tabindex', '-1')
      document.body.focus({ preventScroll: true })
      document.body.removeAttribute('tabindex')
    })
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press('Tab')
      const focus = await page.evaluate(() => {
        const element = document.activeElement
        if (!element || element === document.body) return null
        const label = element.getAttribute('aria-label') || [...(element.labels || [])].map((item) => item.textContent).join(' ') || element.closest('label')?.textContent || element.getAttribute('title') || element.textContent || element.getAttribute('name') || element.tagName
        const style = getComputedStyle(element)
        return { tag: element.tagName, label: String(label).trim().slice(0, 120), indicator: (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none' }
      })
      if (focus) focusStops.push(focus)
    }
    const uniqueStops = new Set(focusStops.map((item) => `${item.tag}:${item.label}`)).size
    const focusMisses = [...new Set(focusStops.filter((item) => !item.indicator).map((item) => `${item.tag}:${item.label}`))]
    const audit = { route, ...structure, focusStops: uniqueStops, focusIndicatorMisses: focusMisses }
    assert(audit.heading && audit.controls > 0 && audit.unnamedControls === 0 && !audit.overflow && uniqueStops >= 3 && focusMisses.length === 0 && audit.stateSemantics.missingState === 0, 'Route audit failed', audit)
    audits.push(audit)
  }
  return audits
}

async function auditHostileCsv(page) {
  await navigate(page, 'portfolio')
  const hostileCsv = [
    'id,account,symbol,type,date,quantity,price,amount,currency,fx',
    `${'X'.repeat(101)},portfolio-thai,K-SET50,buy,2026-02-31,not-a-number,1e309,1e309,THB,1e309`,
  ].join('\n')
  await page.locator('.import-card textarea').fill(hostileCsv)
  await page.locator('.import-card .portfolio-card-head button').filter({ hasText: 'ตรวจไฟล์' }).click()
  await page.locator('.import-card .validation-report').waitFor()
  const result = await page.evaluate(() => ({
    valid: document.querySelector('.import-card .validation-report .valid')?.textContent?.trim(),
    invalid: document.querySelector('.import-card .validation-report .invalid')?.textContent?.trim(),
    importDisabled: document.querySelector('.import-card .import-valid')?.disabled,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }))
  assert(result.valid === 'พร้อม 0' && result.invalid === 'ผิด 1' && result.importDisabled && !result.overflow, 'Hostile CSV did not fail closed', result)
  return result
}

async function auditSpecialistContextLock(page) {
  const consentButtons = page.locator('.consent-grid button')
  const taxConsent = consentButtons.filter({ hasText: 'Tax' })
  const protectionConsent = consentButtons.filter({ hasText: 'Protection' })
  if (!(await taxConsent.evaluate((element) => element.classList.contains('selected')))) await taxConsent.click()
  if (!(await protectionConsent.evaluate((element) => element.classList.contains('selected')))) await protectionConsent.click()
  await page.locator('.context-preview summary').click()
  const context = JSON.parse((await page.locator('.context-preview pre').textContent()) || '{}')
  const result = { fieldsShared: context.fieldsShared, tax: context.tax, protection: context.protection }
  assert(
    result.fieldsShared?.includes('tax')
      && result.fieldsShared?.includes('protection')
      && result.tax?.enabled === false
      && result.tax?.status === 'disabled'
      && result.tax?.taxableIncome === null
      && result.tax?.estimatedTax === null
      && result.tax?.taxPayable === null
      && result.protection?.enabled === false
      && result.protection?.emergencyReserveGap === null
      && result.protection?.lifeCoverageGap === null
      && result.protection?.healthAnnualGap === null
      && result.protection?.disabilityMonthlyGap === null,
    'Disabled specialist studios exposed calculated values in Copilot context',
    result,
  )
  return result
}

async function auditLlmConnectorControls(page) {
  const tabs = page.locator('.copilot-provider-tabs')
  await tabs.getByRole('button', { name: 'OpenRouter' }).click()
  const openRouter = page.locator('.llm-provider-config.openrouter')
  await openRouter.waitFor({ state: 'visible' })
  const credential = openRouter.locator('input[aria-label="LLM API credential"]')
  const model = openRouter.locator('input[aria-label="LLM model ID"]')
  const acknowledgement = openRouter.getByRole('checkbox')
  assert(await credential.inputValue() === '' && await model.inputValue() === 'openrouter/free' && !(await acknowledgement.isChecked()), 'OpenRouter did not start with safe session defaults')
  await credential.fill('not-a-real-session-credential')
  await acknowledgement.check()
  const contextText = (await page.locator('.context-preview pre').textContent()) || ''
  assert(!contextText.includes('not-a-real-session-credential'), 'Provider credential leaked into planning context')
  await tabs.getByRole('button', { name: 'LM Studio' }).click()
  const lmStudio = page.locator('.llm-provider-config.lmstudio')
  await lmStudio.waitFor({ state: 'visible' })
  assert(await lmStudio.locator('input[aria-label="LLM API credential"]').inputValue() === '', 'Credential survived provider switch')
  assert(await lmStudio.locator('input[aria-label="LM Studio base URL"]').inputValue() === 'http://127.0.0.1:1234/v1', 'LM Studio default endpoint mismatch')
  await tabs.getByRole('button', { name: 'Local rules' }).click()
  assert(await page.locator('.llm-provider-config').count() === 0 && await tabs.getByRole('button', { name: 'Local rules' }).getAttribute('aria-pressed') === 'true', 'Local fallback did not restore cleanly')
  return { openRouterDefaultModel: 'openrouter/free', lmStudioDefaultEndpoint: 'http://127.0.0.1:1234/v1', credentialSessionOnly: true, externalRequestMade: false }
}

async function runJourney(browser, engineName, viewport) {
  const label = `${engineName}-${viewport.name}`
  const artifactDir = path.join(rootArtifactDir, label)
  await mkdir(artifactDir, { recursive: true })
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, acceptDownloads: true })
  const page = await context.newPage()
  const runtimeIssues = []
  const consoleIssues = []
  const networkOrigins = new Set()
  page.on('pageerror', (error) => runtimeIssues.push(error.message))
  page.on('console', (message) => { if (['warning', 'error'].includes(message.type())) consoleIssues.push(`${message.type()}:${message.text()}`) })
  page.on('request', (request) => { try { const url = new URL(request.url()); if (['http:', 'https:'].includes(url.protocol)) networkOrigins.add(url.origin) } catch { /* browser-internal URL */ } })

  let phase = 'initial-navigation'
  try {
    await navigate(page, 'studio')
    phase = 'navigation-feedback'
    const navigation = viewport.name === 'mobile' ? page.locator('.mobile-bottom-nav') : page.locator('.sidebar nav')
    await navigation.getByRole('button', { name: viewport.name === 'mobile' ? 'Wealth' : 'Wealth Map', exact: true }).click()
    const navigationFeedback = page.locator('.navigation-feedback')
    await navigationFeedback.waitFor({ state: 'visible' })
    const navigationFeedbackLabel = (await navigationFeedback.textContent())?.trim() || ''
    assert(navigationFeedbackLabel.includes('Wealth Map') && page.url().endsWith('#/wealth'), 'Navigation feedback did not describe the destination', { navigationFeedbackLabel, url: page.url() })
    await navigationFeedback.waitFor({ state: 'hidden', timeout: 2_000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await navigate(page, 'studio')
    await navigation.getByRole('button', { name: viewport.name === 'mobile' ? 'Wealth' : 'Wealth Map', exact: true }).click()
    await navigationFeedback.waitFor({ state: 'attached' })
    const reducedMotionDisplay = await navigationFeedback.evaluate((element) => getComputedStyle(element).display)
    assert(reducedMotionDisplay === 'none', 'Reduced-motion navigation feedback should not animate', { reducedMotionDisplay })
    await navigationFeedback.waitFor({ state: 'detached', timeout: 2_000 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    phase = 'plan-edit'
    await navigate(page, 'studio')
    const monthly = page.getByRole('spinbutton', { name: /ลงทุนทุกเดือน/ })
    assert(await monthly.inputValue() === '15,000', 'Fresh monthly contribution mismatch')
    assert((await page.locator('.scenario-buttons .active span').textContent())?.trim() === 'Base', 'Fresh scenario mismatch')
    await monthly.click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('22000')
    await page.keyboard.press('Tab')
    assert(await monthly.inputValue() === '22,000', 'Monthly contribution did not commit through keyboard input')
    await page.locator('.scenario-buttons button').filter({ hasText: 'Bear' }).click()
    await page.waitForFunction(() => document.querySelector('.scenario-buttons .active span')?.textContent === 'Bear')
    const changedHero = (await page.locator('.hero-number').textContent())?.trim()
    await page.screenshot({ path: path.join(artifactDir, '01-plan.png'), fullPage: false })

    phase = 'review-state'
    await navigate(page, 'reviews')
    await page.locator('.ritual-card').first().getByRole('button', { name: 'ปิด review รอบนี้' }).click()
    await page.waitForFunction(() => document.querySelector('.ritual-card footer span')?.textContent?.includes('ล่าสุด'))

    phase = 'specialist-context-lock'
    const specialistContextLock = await auditSpecialistContextLock(page)
    phase = 'llm-connector-controls'
    const llmConnectorControls = await auditLlmConnectorControls(page)

    phase = 'encrypted-export'
    await navigate(page, 'vault')
    await page.locator('.vault-grid .vault-card:first-child input').fill('Cross-browser ก่อน export')
    await page.locator('.vault-grid .vault-card:first-child button').filter({ hasText: 'บันทึก snapshot' }).click()
    await page.getByText('บันทึก snapshot แล้ว', { exact: false }).waitFor()
    await page.locator('.vault-secret input').fill('flow-e2e-passphrase-2026')
    const downloadPromise = page.waitForEvent('download')
    await page.locator('.vault-buttons button').filter({ hasText: 'ส่งออกเข้ารหัส' }).click()
    const download = await downloadPromise
    const backupPath = await download.path()
    assert(backupPath, 'Encrypted backup path unavailable')
    const backupBytes = await readFile(backupPath)
    assert(backupBytes.length > 500, 'Encrypted backup unexpectedly small', backupBytes.length)
    const backupHash = createHash('sha256').update(backupBytes).digest('hex')

    phase = 'local-delete'
    await page.locator('.danger-zone input').fill('DELETE')
    await page.locator('.danger-zone button').filter({ hasText: 'ลบข้อมูล local ทั้งหมด' }).click()
    await page.getByText('ลบข้อมูลแผน, version history และ market cache', { exact: false }).waitFor()
    await navigate(page, 'studio')
    assert(await monthly.inputValue() === '15,000', 'Delete did not reset monthly contribution')
    assert((await page.locator('.scenario-buttons .active span').textContent())?.trim() === 'Base', 'Delete did not reset scenario')

    phase = 'encrypted-restore'
    await navigate(page, 'vault')
    await page.locator('.vault-secret input').fill('flow-e2e-passphrase-2026')
    await page.locator('input[type=file]').setInputFiles(backupPath)
    await page.locator('.conflict-restore').waitFor()
    const conflict = await page.evaluate(() => ({
      changed: document.querySelectorAll('.conflict-grid > article.changed').length,
      issues: document.querySelectorAll('.conflict-issues span').length,
      incomingSections: [...document.querySelectorAll('.conflict-grid > article')]
        .filter((item) => item.querySelector('[role="group"] button[aria-pressed="true"]')?.textContent?.includes('ใช้จากไฟล์'))
        .map((item) => item.querySelector('b')?.textContent?.trim()),
      incoming: [...document.querySelectorAll('.conflict-grid [role="group"] button[aria-pressed="true"]')].filter((item) => item.textContent?.includes('ใช้จากไฟล์')).length,
    }))
    assert(conflict.changed >= 2 && conflict.issues === 0 && conflict.incoming >= 2, 'Restore staging mismatch', conflict)
    await page.locator('.conflict-actions button').filter({ hasText: 'ยืนยันกู้คืนที่เลือก' }).click()
    await page.getByText('นำเข้า backup แล้ว และเก็บแผนก่อนหน้าไว้ใน history', { exact: false }).waitFor()

    phase = 'restored-state'
    await navigate(page, 'studio')
    const restored = { monthly: await monthly.inputValue(), scenario: (await page.locator('.scenario-buttons .active span').textContent())?.trim(), hero: (await page.locator('.hero-number').textContent())?.trim() }
    assert(restored.monthly === '22,000' && restored.scenario === 'Bear' && restored.hero === changedHero, 'Restored plan mismatch', restored)
    await navigate(page, 'reviews')
    const restoredReviewLabels = await page.locator('.ritual-card footer span').allTextContents()
    assert(restoredReviewLabels.some((label) => label.includes('ล่าสุด')), 'Review state was not restored', { restoredReviewLabels, incomingSections: conflict.incomingSections })

    phase = 'route-audits'
    const routeAudits = await auditRoutes(page)
    phase = 'hostile-csv'
    const csvImportFailClosed = await auditHostileCsv(page)
    const externalOrigins = [...networkOrigins].filter((origin) => origin !== appUrl)
    assert(runtimeIssues.length === 0 && consoleIssues.length === 0 && externalOrigins.length === 0, 'Runtime/network boundary failed', { runtimeIssues, consoleIssues, externalOrigins })

    return { engine: engineName, browserVersion: browser.version(), viewport, navigationFeedback: { label: navigationFeedbackLabel, durationBudgetMs: 420 }, specialistContextLock, llmConnectorControls, backup: { size: backupBytes.length, sha256: backupHash }, restored, routeAudits, csvImportFailClosed, pageNetworkOrigins: [...networkOrigins], runtimeIssues: 0, consoleIssues: 0, artifacts: artifactDir }
  } catch (error) {
    throw new Error(`[${phase}] ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await context.close()
  }
}

const reports = []
const failures = []
for (const engineName of requestedEngines) {
  let browser
  try { browser = await availableEngines[engineName].launch({ headless: true, timeout: 30_000 }) }
  catch (error) {
    failures.push({ engine: engineName, viewport: null, phase: 'browser-launch', error: error instanceof Error ? error.message : String(error) })
    continue
  }
  try {
    for (const viewport of viewports) {
      try { reports.push(await runJourney(browser, engineName, viewport)) }
      catch (error) { failures.push({ engine: engineName, viewport, error: error instanceof Error ? error.message : String(error) }) }
    }
  } finally { await browser.close() }
}

const result = { runId, reports, failures }
await writeFile(path.join(rootArtifactDir, 'report.json'), JSON.stringify(result, null, 2))
await writeFile(path.resolve('work', 'cross-browser', 'latest-report.json'), JSON.stringify(result, null, 2))
console.log(JSON.stringify(result, null, 2))
if (failures.length) process.exitCode = 1
