import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [browserPath, browserName = 'browser', portText = '9331', profileOverride, widthText = '1440', heightText = '1000'] = process.argv.slice(2)
if (!browserPath) throw new Error('Usage: node critical-journey-e2e.mjs <browser-path> <browser-name> <debug-port>')

const port = Number(portText)
const viewportWidth = Number(widthText)
const viewportHeight = Number(heightText)
const connectOnly = browserPath === 'connect'
const runId = new Date().toISOString().replaceAll(/[:.]/g, '-')
const artifactDir = path.resolve('work', 'e2e', `${browserName}-${runId}`)
const downloadDir = path.join(artifactDir, 'downloads')
const profileDir = connectOnly ? 'isolated-browser-context' : profileOverride && profileOverride !== 'none' ? path.resolve(profileOverride) : path.join(artifactDir, 'profile')
const appUrl = (process.env.FLOW_E2E_BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '')
const passphrase = 'flow-e2e-passphrase-2026'
await mkdir(downloadDir, { recursive: true })
if (!connectOnly) await mkdir(profileDir, { recursive: true })

const launchArguments = [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`,
  '--remote-allow-origins=*',
  '--disable-gpu', '--disable-gpu-sandbox',
  '--no-first-run', '--no-default-browser-check', '--disable-sync', '--disable-background-networking',
  '--disable-component-update', '--disable-domain-reliability', '--disable-features=OptimizationHints,MediaRouter',
  `--window-size=${viewportWidth},${viewportHeight}`, `${appUrl}/#/studio`,
]
// Windows headless GPU child processes can be blocked by the managed desktop sandbox.
// The verifier is constrained to a disposable profile and rejects any non-localhost page origin.
if (process.platform === 'win32') launchArguments.splice(-1, 0, '--no-sandbox', '--disable-software-rasterizer')
const browser = connectOnly ? null : spawn(browserPath, launchArguments, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
const browserStderr = []
browser?.stderr.on('data', (chunk) => browserStderr.push(String(chunk).slice(0, 2_000)))

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
async function poll(task, timeout = 12_000, interval = 100) {
  const started = Date.now()
  let lastError
  while (Date.now() - started < timeout) {
    try {
      const result = await task()
      if (result) return result
    } catch (error) { lastError = error }
    await sleep(interval)
  }
  throw lastError ?? new Error(`Timed out after ${timeout} ms`)
}

let socket
let sessionId
let browserContextId
let phase = 'launch'
const pending = new Map()
let nextId = 0
const runtimeIssues = []
const consoleIssues = []
const networkOrigins = new Set()

function command(method, params = {}, targetSession = true) {
  const id = ++nextId
  const payload = { id, method, params }
  if (sessionId && targetSession) payload.sessionId = sessionId
  socket.send(JSON.stringify(payload))
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`DevTools command timed out: ${method}`)) }, 8_000)
    pending.set(id, { resolve, reject, timer })
  })
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}

async function waitForSelector(selector, timeout = 8_000) {
  return poll(() => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`), timeout)
}

async function waitForText(text, timeout = 8_000) {
  return poll(() => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`), timeout)
}

async function rectFor(selector, text = null) {
  const expression = `(() => {
    const candidates = [...document.querySelectorAll(${JSON.stringify(selector)})]
    const element = ${text === null ? 'candidates[0]' : `candidates.find((item) => item.textContent?.includes(${JSON.stringify(text)}))`}
    if (!element || element.disabled) return null
    const rect = element.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight }
  })()`
  let result = await evaluate(expression)
  if (!result) throw new Error(`Element not found or disabled: ${selector} ${text ?? ''}`)
  const bottomSafeArea = result.viewportWidth < 600 ? 120 : 30
  if (result.y < 30 || result.y > result.viewportHeight - bottomSafeArea) {
    await command('Input.dispatchMouseEvent', { type: 'mouseWheel', x: result.viewportWidth / 2, y: result.viewportHeight / 2, deltaX: 0, deltaY: result.y - result.viewportHeight / 2 })
    await sleep(350)
    result = await evaluate(expression)
    if (!result || result.y < 0 || result.y > result.viewportHeight - bottomSafeArea) throw new Error(`Element did not scroll into viewport: ${selector} ${text ?? ''}`)
  }
  return result
}

async function click(selector, text = null) {
  const rect = await rectFor(selector, text)
  await command('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x, y: rect.y })
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 })
}

async function replaceText(selector, text) {
  await click(selector)
  const focused = await evaluate(`document.activeElement === document.querySelector(${JSON.stringify(selector)})`)
  if (!focused) throw new Error(`Input did not receive focus: ${selector}`)
  await command('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65 })
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65 })
  await command('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 })
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 })
  await command('Input.insertText', { text })
  await sleep(80)
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 })
  await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 })
}

async function navigate(view) {
  await command('Page.navigate', { url: `${appUrl}/#/${view}` })
  await waitForSelector('main')
  await poll(() => evaluate(`document.title.includes('Flow Wealth Studio')`))
  await sleep(350)
}

async function screenshot(name) {
  const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  await writeFile(path.join(artifactDir, `${name}.png`), Buffer.from(result.data, 'base64'))
}

async function screenshotElement(name, selector) {
  const clip = await evaluate(`(() => {
    const element = document.querySelector(${JSON.stringify(selector)})
    if (!element) return null
    const rect = element.getBoundingClientRect()
    return { x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height: rect.height, scale: 1 }
  })()`)
  if (!clip || clip.width <= 0 || clip.height <= 0) throw new Error(`Screenshot element was not measurable: ${selector}`)
  const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true, clip })
  await writeFile(path.join(artifactDir, `${name}.png`), Buffer.from(result.data, 'base64'))
}

async function setFileInput(filePath) {
  const document = await command('DOM.getDocument', { depth: 2 })
  const node = await command('DOM.querySelector', { nodeId: document.root.nodeId, selector: 'input[type="file"]' })
  if (!node.nodeId) throw new Error('Backup file input was not found')
  await command('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [filePath] })
}

async function auditAccessibilityRoutes() {
  const routes = ['studio', 'wealth', 'life', 'portfolio', 'scenario', 'retirement', 'protection', 'tax', 'legacy', 'data', 'reviews', 'vault', 'more']
  const interactiveRoles = new Set(['button', 'checkbox', 'combobox', 'link', 'radio', 'slider', 'switch', 'textbox'])
  const audits = []
  for (const route of routes) {
    await navigate(route)
    const tree = await command('Accessibility.getFullAXTree')
    const interactive = tree.nodes.filter((node) => interactiveRoles.has(node.role?.value) && !node.ignored)
    const headings = tree.nodes.filter((node) => node.role?.value === 'heading' && !node.ignored)
    const unnamedInteractive = interactive.filter((node) => !String(node.name?.value ?? '').trim()).length
    const unnamedHeadings = headings.filter((node) => !String(node.name?.value ?? '').trim()).length
    const focusStops = []
    for (let index = 0; index < 12; index += 1) {
      await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 })
      await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 })
      const focus = await evaluate(`(() => {
        const element = document.activeElement
        if (!element || element === document.body) return null
        const label = element.closest('label')?.innerText || element.getAttribute('aria-label') || element.getAttribute('title') || element.innerText || element.getAttribute('name') || element.tagName
        const style = getComputedStyle(element)
        return { tag: element.tagName, label: String(label).trim().slice(0, 120), indicator: (style.outlineStyle !== 'none' && style.outlineWidth !== '0px') || style.boxShadow !== 'none' }
      })()`)
      if (focus) focusStops.push(focus)
    }
    const missedIndicators = [...new Map(focusStops.filter((item) => !item.indicator).map((item) => [`${item.tag}:${item.label}`, item])).values()]
    audits.push({ route, interactive: interactive.length, headings: headings.length, unnamedInteractive, unnamedHeadings, focusStops: new Set(focusStops.map((item) => `${item.tag}:${item.label}`)).size, focusIndicatorMisses: missedIndicators.length, focusIndicatorMissDetails: missedIndicators })
  }
  const failures = audits.filter((audit) => audit.unnamedInteractive || audit.unnamedHeadings || audit.focusStops < 3 || audit.focusIndicatorMisses)
  if (failures.length) throw new Error(`Accessibility route audit failed: ${JSON.stringify(failures)}`)
  return audits
}

async function auditReleaseControls() {
  await navigate('vault')
  await waitForSelector('.release-controls .feature-gates')
  const controls = await evaluate(`(() => {
    const panel = document.querySelector('.release-controls')
    const badges = [...document.querySelectorAll('.release-controls .feature-gates > span')]
    return {
      badgeCount: badges.length,
      localOn: badges.filter((item) => item.classList.contains('local-on')).length,
      remoteOff: badges.filter((item) => item.classList.contains('remote-off')).length,
      labels: badges.map((item) => item.firstChild?.textContent?.trim()).filter(Boolean),
      pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      panelOverflow: panel ? panel.scrollWidth > panel.clientWidth : true,
    }
  })()`)
  if (!controls || controls.badgeCount !== 14 || controls.localOn !== 4 || controls.remoteOff !== 10 || controls.pageOverflow || controls.panelOverflow) {
    throw new Error(`Release controls failed: ${JSON.stringify(controls)}`)
  }
  await screenshotElement('09-release-controls', '.release-controls')
  return controls
}

async function auditScenarioToolbarAlignment() {
  await navigate('scenario')
  await waitForSelector('.scenario-toolbar .rerun-seed-button')
  const alignment = await evaluate(`(() => {
    const box = (selector) => {
      const element = document.querySelector(selector)
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return { top: Number(rect.top.toFixed(2)), bottom: Number(rect.bottom.toFixed(2)), height: Number(rect.height.toFixed(2)) }
    }
    const preset = box('.scenario-toolbar label:nth-of-type(1) select')
    const seed = box('.scenario-toolbar label:nth-of-type(2) input')
    const paths = box('.scenario-toolbar label:nth-of-type(3) select')
    const rerun = box('.scenario-toolbar .rerun-seed-button')
    if (!preset || !seed || !paths || !rerun) return null
    const peer = innerWidth <= 760 ? paths : seed
    return {
      preset,
      seed,
      paths,
      rerun,
      comparedWith: innerWidth <= 760 ? 'paths' : 'seed',
      topDelta: Number(Math.abs(rerun.top - peer.top).toFixed(2)),
      bottomDelta: Number(Math.abs(rerun.bottom - peer.bottom).toFixed(2)),
      heightDelta: Number(Math.abs(rerun.height - peer.height).toFixed(2)),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })()`)
  if (!alignment || alignment.bottomDelta > 1 || alignment.heightDelta > 3 || alignment.overflow) {
    throw new Error(`Scenario toolbar alignment failed: ${JSON.stringify(alignment)}`)
  }
  await screenshot('05-scenario-toolbar')
  return alignment
}

async function auditPortfolioSectionSpacing() {
  await navigate('portfolio')
  await waitForSelector('.portfolio-data-register')
  const spacing = await evaluate(`(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect()
    const accounts = rect('.portfolio-accounts')
    const provenance = rect('.portfolio-data-register')
    const xray = rect('.xray-grid')
    if (!accounts || !provenance || !xray) return null
    return {
      accountsToProvenance: Number((provenance.top - accounts.bottom).toFixed(2)),
      provenanceToXray: Number((xray.top - provenance.bottom).toFixed(2)),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })()`)
  if (!spacing || Math.abs(spacing.accountsToProvenance - spacing.provenanceToXray) > 1 || spacing.accountsToProvenance < 8 || spacing.accountsToProvenance > 12 || spacing.overflow) {
    throw new Error(`Portfolio section spacing failed: ${JSON.stringify(spacing)}`)
  }
  await rectFor('.portfolio-data-register')
  await screenshot('06-portfolio-spacing')
  return spacing
}

async function auditCsvImportFailClosed() {
  await navigate('portfolio')
  await waitForSelector('.import-card textarea')
  const hostileCsv = [
    'id,account,symbol,type,date,quantity,price,amount,currency,fx',
    `${'X'.repeat(101)},portfolio-thai,K-SET50,buy,2026-02-31,not-a-number,1e309,1e309,THB,1e309`,
  ].join('\n')
  await replaceText('.import-card textarea', hostileCsv)
  await click('.import-card .portfolio-card-head button', 'ตรวจไฟล์')
  await waitForSelector('.import-card .validation-report')
  const result = await evaluate(`(() => ({
    valid: document.querySelector('.import-card .validation-report .valid')?.textContent?.trim(),
    invalid: document.querySelector('.import-card .validation-report .invalid')?.textContent?.trim(),
    issues: document.querySelector('.import-card .validation-report p.invalid span')?.textContent?.trim(),
    importDisabled: document.querySelector('.import-card .import-valid')?.disabled,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }))()`)
  if (result.valid !== 'พร้อม 0' || result.invalid !== 'ผิด 1' || !result.importDisabled || !result.issues?.includes('วันที่ไม่ถูกต้อง') || result.overflow) {
    throw new Error(`CSV fail-closed audit failed: ${JSON.stringify(result)}`)
  }
  await screenshot('08-csv-import-rejected')
  return result
}

async function auditLegacyActionAlignment() {
  await navigate('legacy')
  await waitForSelector('.legacy-row .save-reference-button')
  const alignment = await evaluate(`(() => {
    const firstRow = document.querySelector('.legacy-row')
    const box = (selector) => {
      const element = firstRow?.querySelector(selector)
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return { top: Number(rect.top.toFixed(2)), bottom: Number(rect.bottom.toFixed(2)), height: Number(rect.height.toFixed(2)) }
    }
    const title = box('.legacy-title input')
    const remove = box('.legacy-delete')
    const reference = box('.legacy-reference input')
    const save = box('.save-reference-button')
    if (!title || !remove || !reference || !save) return null
    const stacked = innerWidth <= 760
    return {
      title,
      remove,
      reference,
      save,
      stacked,
      deleteTopDelta: Number(Math.abs(remove.top - title.top).toFixed(2)),
      deleteBottomDelta: Number(Math.abs(remove.bottom - title.bottom).toFixed(2)),
      deleteHeightDelta: Number(Math.abs(remove.height - title.height).toFixed(2)),
      saveTopDelta: stacked ? null : Number(Math.abs(save.top - reference.top).toFixed(2)),
      saveBottomDelta: stacked ? null : Number(Math.abs(save.bottom - reference.bottom).toFixed(2)),
      saveHeightDelta: Number(Math.abs(save.height - reference.height).toFixed(2)),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })()`)
  const desktopMisaligned = alignment && !alignment.stacked && (alignment.saveTopDelta > 1 || alignment.saveBottomDelta > 1)
  if (!alignment || alignment.deleteTopDelta > 1 || alignment.deleteBottomDelta > 1 || alignment.deleteHeightDelta > 1 || desktopMisaligned || alignment.saveHeightDelta > 1 || alignment.overflow) {
    throw new Error(`Legacy action alignment failed: ${JSON.stringify(alignment)}`)
  }
  await rectFor('.legacy-row')
  await screenshot('07-legacy-actions')
  return alignment
}

async function journey() {
  phase = 'connect-version'
  const version = await poll(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`)
    return response.ok ? response.json() : null
  })
  const websocketUrl = connectOnly ? version.webSocketDebuggerUrl : await poll(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`)
    if (!response.ok) return null
    const targets = await response.json()
    return targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? null
  })
  socket = new WebSocket(websocketUrl)
  phase = 'open-devtools-socket'
  await Promise.race([
    new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true })
      socket.addEventListener('error', reject, { once: true })
      socket.addEventListener('close', () => reject(new Error('DevTools socket closed before opening')), { once: true })
    }),
    sleep(5_000).then(() => { throw new Error('Timed out opening DevTools socket') }),
  ])
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.method === 'Runtime.exceptionThrown') runtimeIssues.push(message.params.exceptionDetails.text ?? 'runtime exception')
    if (message.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(message.params.type)) consoleIssues.push(message.params.type)
    if (message.method === 'Network.requestWillBeSent') {
      try {
        const url = new URL(message.params.request.url)
        if (url.protocol === 'http:' || url.protocol === 'https:') networkOrigins.add(url.origin)
      } catch { /* browser-internal URL */ }
    }
    const resolver = pending.get(message.id)
    if (!resolver) return
    pending.delete(message.id)
    clearTimeout(resolver.timer)
    if (message.error) resolver.reject(new Error(message.error.message))
    else resolver.resolve(message.result)
  })
  socket.addEventListener('close', () => {
    for (const [id, resolver] of pending) {
      clearTimeout(resolver.timer)
      resolver.reject(new Error(`DevTools socket closed with command ${id} pending`))
    }
    pending.clear()
  })

  phase = 'create-target'
  if (connectOnly) {
    const context = await command('Target.createBrowserContext', { disposeOnDetach: true }, false)
    browserContextId = context.browserContextId
    const created = await command('Target.createTarget', { url: 'about:blank', browserContextId }, false)
    const attached = await command('Target.attachToTarget', { targetId: created.targetId, flatten: true }, false)
    sessionId = attached.sessionId
  }

  phase = 'enable-page-domain'
  await command('Page.enable')
  phase = 'enable-runtime-domain'
  await command('Runtime.enable')
  phase = 'enable-network-domain'
  await command('Network.enable')
  phase = 'enable-dom-domain'
  await command('DOM.enable')
  phase = 'enable-accessibility-domain'
  await command('Accessibility.enable')
  phase = 'configure-downloads'
  await command('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: true, ...(browserContextId ? { browserContextId } : {}) }, false)
  phase = 'configure-viewport'
  await command('Emulation.setDeviceMetricsOverride', { width: viewportWidth, height: viewportHeight, deviceScaleFactor: 1, mobile: viewportWidth < 600 })

  phase = 'fresh-studio'
  await navigate('studio')
  await waitForSelector('.projection-panel')
  const initial = await evaluate(`({ monthly: document.querySelector('.controls-panel label:nth-of-type(2) input')?.value, scenario: document.querySelector('.scenario-buttons .active span')?.textContent, modelNotice: Boolean(document.querySelector('[data-model-update]')) })`)
  if (initial.monthly !== '15,000' || initial.scenario !== 'Base') throw new Error(`Fresh profile did not start from defaults: ${JSON.stringify(initial)}`)

  phase = 'change-plan-and-scenario'
  const monthlySelector = '.controls-panel label:nth-of-type(2) input'
  phase = 'change-monthly-contribution'
  await replaceText(monthlySelector, '22000')
  const monthlyAfterInput = await evaluate(`document.querySelector(${JSON.stringify(monthlySelector)})?.value`)
  if (Number(String(monthlyAfterInput).replaceAll(',', '')) !== 22_000) throw new Error(`Monthly contribution input mismatch: ${JSON.stringify(monthlyAfterInput)}`)
  phase = 'change-scenario'
  await click('.scenario-buttons button', 'Bear')
  await poll(() => evaluate(`document.querySelector('.scenario-buttons .active span')?.textContent === 'Bear'`))
  const changedValue = await evaluate(`document.querySelector('.hero-number')?.textContent?.trim()`)
  await sleep(700)
  await screenshot('01-plan-and-scenario')

  phase = 'complete-review'
  await navigate('reviews')
  await waitForSelector('.review-studio')
  await click('.ritual-card button', 'ปิด review รอบนี้')
  await poll(() => evaluate(`document.querySelector('.ritual-card footer span')?.textContent?.includes('ล่าสุด')`))
  await screenshot('02-review-completed')
  await sleep(700)

  phase = 'snapshot-and-export'
  await navigate('vault')
  await waitForSelector('.vault-studio')
  await replaceText('.vault-grid .vault-card:first-child input', 'E2E ก่อน export')
  await click('.vault-grid .vault-card:first-child button', 'บันทึก snapshot')
  await waitForText('บันทึก snapshot แล้ว')
  await replaceText('.vault-secret input', passphrase)
  await click('.vault-buttons button', 'ส่งออกเข้ารหัส')
  await waitForText('ส่งออก backup ที่เข้ารหัสแล้ว')
  const backupName = await poll(async () => (await readdir(downloadDir)).find((name) => name.endsWith('.flowbackup')), 10_000)
  const backupPath = path.join(downloadDir, backupName)
  const backupStat = await stat(backupPath)
  const backupHash = createHash('sha256').update(await readFile(backupPath)).digest('hex')
  if (backupStat.size < 500) throw new Error('Encrypted backup is unexpectedly small')

  phase = 'delete-local-data'
  await replaceText('.danger-zone input', 'DELETE')
  await click('.danger-zone button', 'ลบข้อมูล local ทั้งหมด')
  await waitForText('ลบข้อมูลแผน, version history และ market cache')
  await navigate('studio')
  const afterDelete = await evaluate(`({ monthly: document.querySelector(${JSON.stringify(monthlySelector)})?.value, scenario: document.querySelector('.scenario-buttons .active span')?.textContent })`)
  if (afterDelete.monthly !== '15,000' || afterDelete.scenario !== 'Base') throw new Error(`Delete did not reset defaults: ${JSON.stringify(afterDelete)}`)

  phase = 'stage-restore'
  await navigate('vault')
  await replaceText('.vault-secret input', passphrase)
  await setFileInput(backupPath)
  await waitForSelector('.conflict-restore')
  const conflict = await evaluate(`({ changed: document.querySelectorAll('.conflict-grid > article.changed').length, issues: document.querySelectorAll('.conflict-issues span').length, incoming: [...document.querySelectorAll('.conflict-grid [role="group"] button[aria-pressed="true"]')].filter((item) => item.textContent?.includes('ใช้จากไฟล์')).length })`)
  if (conflict.changed < 2 || conflict.issues !== 0 || conflict.incoming < 2) throw new Error(`Unexpected restore staging: ${JSON.stringify(conflict)}`)
  await rectFor('.conflict-head')
  await screenshot('03-restore-staged')
  phase = 'confirm-restore'
  await click('.conflict-actions button', 'ยืนยันกู้คืนที่เลือก')
  await waitForText('นำเข้า backup แล้ว และเก็บแผนก่อนหน้าไว้ใน history')

  phase = 'verify-restored-studio'
  await navigate('studio')
  const restored = await evaluate(`({ monthly: document.querySelector(${JSON.stringify(monthlySelector)})?.value, scenario: document.querySelector('.scenario-buttons .active span')?.textContent, hero: document.querySelector('.hero-number')?.textContent?.trim(), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth })`)
  if (restored.monthly !== '22,000' || restored.scenario !== 'Bear' || restored.hero !== changedValue || restored.overflow) throw new Error(`Restore mismatch: ${JSON.stringify({ changedValue, restored })}`)
  await screenshot('04-restored-plan')

  phase = 'verify-restored-review'
  await navigate('reviews')
  const reviewRestored = await evaluate(`document.querySelector('.ritual-card footer span')?.textContent?.includes('ล่าสุด') ?? false`)
  if (!reviewRestored) throw new Error('Review state was not restored from backup')

  const axTree = await command('Accessibility.getFullAXTree')
  const namedButtons = axTree.nodes.filter((node) => node.role?.value === 'button' && node.name?.value).length
  phase = 'accessibility-route-audit'
  const accessibilityRoutes = await auditAccessibilityRoutes()
  phase = 'release-control-audit'
  const releaseControls = await auditReleaseControls()
  phase = 'scenario-toolbar-alignment'
  const scenarioToolbarAlignment = await auditScenarioToolbarAlignment()
  phase = 'portfolio-section-spacing'
  const portfolioSectionSpacing = await auditPortfolioSectionSpacing()
  phase = 'csv-import-fail-closed'
  const csvImportFailClosed = await auditCsvImportFailClosed()
  phase = 'legacy-action-alignment'
  const legacyActionAlignment = await auditLegacyActionAlignment()
  const externalOrigins = [...networkOrigins].filter((origin) => origin !== appUrl)
  if (runtimeIssues.length || consoleIssues.length || externalOrigins.length) throw new Error(`Runtime/network boundary failed: ${JSON.stringify({ runtimeIssues, consoleIssues, externalOrigins })}`)

  return {
    browser: browserName,
    browserProduct: version.Browser,
    viewport: { width: viewportWidth, height: viewportHeight },
    initial,
    changed: { monthly: '22,000', scenario: 'Bear', hero: changedValue },
    reviewCompletedAndRestored: reviewRestored,
    snapshotCreated: true,
    encryptedBackup: { size: backupStat.size, sha256: backupHash },
    deleteReset: afterDelete,
    restoreStaging: conflict,
    restored,
    namedAccessibilityButtons: namedButtons,
    accessibilityRoutes,
    releaseControls,
    scenarioToolbarAlignment,
    portfolioSectionSpacing,
    csvImportFailClosed,
    legacyActionAlignment,
    pageNetworkOrigins: [...networkOrigins],
    runtimeIssues: runtimeIssues.length,
    consoleIssues: consoleIssues.length,
    artifacts: artifactDir,
    disposableProfile: profileDir,
  }
}

let report
let exitCode = 0
try {
  report = await journey()
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  exitCode = 1
  report = { browser: browserName, phase, error: error instanceof Error ? error.message : String(error), runtimeIssues, consoleIssues, browserStderr: browserStderr.join('').slice(-4_000), artifacts: artifactDir, disposableProfile: profileDir }
  console.error(JSON.stringify(report, null, 2))
} finally {
  if (browserContextId && socket?.readyState === WebSocket.OPEN) {
    try { await command('Target.disposeBrowserContext', { browserContextId }, false) } catch { /* browser context already closed */ }
  }
  if (socket?.readyState === WebSocket.OPEN) socket.close()
  browser?.kill()
  await sleep(700)
  await writeFile(path.join(artifactDir, 'report.json'), JSON.stringify(report, null, 2))
  if (exitCode === 0) await writeFile(path.resolve('work', 'e2e', `latest-${browserName}-report.json`), JSON.stringify(report, null, 2))
}
process.exitCode = exitCode
