// Audits the surfaces that only exist once an identity provider is configured.
//
// The unkeyed suites cannot reach these: with no publishable key the auth pages
// render an "unconfigured" card, `AccountBadge` returns null, and every gated
// studio renders its real content instead of the upgrade gate. Three separate
// layout defects shipped through that blind spot before this existed.
//
// Scope is the signed-out state, which is everything CI can reach without
// storing real user credentials. The signed-in account row — avatar, display
// name, plan label — is still unverified here; see docs/KNOWN_LIMITATIONS.md.
//
// Reports carry rule ids, safe node signatures and contrast numbers only: no
// text, selectors, form values, or plan values.

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
for (const engine of requestedEngines) if (!supportedEngines.has(engine)) throw new Error(`Unsupported engine: ${engine}`)

/** Marketing paths, which no other suite visits at all. */
const marketingSurfaces = [
  { id: 'landing', url: '/', expect: '.marketing' },
  { id: 'pricing', url: '/pricing', expect: '.marketing' },
  { id: 'signIn', url: '/sign-in', expect: '.auth-page' },
  { id: 'signUp', url: '/sign-up', expect: '.auth-page' },
]
/** Planner routes, split by whether a signed-out (free) visitor should be gated. */
const gatedRoutes = ['portfolio', 'scenario', 'retirement', 'protection', 'tax', 'legacy', 'data']
const openRoutes = ['studio', 'wealth', 'life', 'vault', 'reviews']

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  // 1000px is below the 1100px breakpoint where the sidebar becomes an icon rail.
  { name: 'rail', width: 1000, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]
const axeTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const runId = new Date().toISOString().replaceAll(/[:.]/g, '-')
const artifactDir = path.resolve('work', 'keyed-surfaces', runId)
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

const summarizeViolations = (items) => items.map((item) => ({
  id: item.id,
  impact: item.impact,
  nodeCount: item.nodes.length,
  nodeSignatures: item.nodes.slice(0, 8).map((node) => ({
    tag: node.html.match(/^<([a-zA-Z0-9-]+)/)?.[1]?.toLowerCase() ?? 'unknown',
    classes: (node.html.match(/\sclass="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean).sort(),
    contrast: item.id === 'color-contrast'
      ? [...node.any, ...node.all, ...node.none].map((check) => check.data).filter(Boolean).map((data) => ({
        contrastRatio: data.contrastRatio, expectedContrastRatio: data.expectedContrastRatio,
        fgColor: data.fgColor, bgColor: data.bgColor, fontSize: data.fontSize, fontWeight: data.fontWeight,
      }))
      : undefined,
  })),
}))

/** Origins a keyed build legitimately contacts. Anything else is a boundary regression. */
const allowedOriginPattern = /^(https?:\/\/127\.0\.0\.1(:\d+)?|https?:\/\/localhost(:\d+)?|https:\/\/[a-z0-9-]+\.clerk\.accounts\.dev|https:\/\/([a-z0-9-]+\.)?clerk\.com|https:\/\/img\.clerk\.com)$/

async function auditPage(page, { label, url, expect, checks }) {
  const runtimeIssues = []
  const consoleIssues = []
  const origins = new Set()
  const onConsole = (message) => {
    const type = message.type()
    if (type !== 'error' && type !== 'warning') return
    // Clerk announces a development instance on every load. It is emitted by
    // the SDK itself, carries no defect, and disappears on a production key.
    if (/Clerk has been loaded with development keys/i.test(message.text())) return
    consoleIssues.push(type)
  }
  const onPageError = () => runtimeIssues.push('pageerror')
  const onRequest = (request) => { try { origins.add(new URL(request.url()).origin) } catch { /* ignore opaque urls */ } }
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  page.on('request', onRequest)

  await page.goto(`${appUrl}${url}`, { waitUntil: 'networkidle' })
  await page.waitForSelector(expect, { timeout: 30_000 })
  // Clerk mounts asynchronously and the marketing page reveals on scroll; settle both.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(1_800)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(700)

  const layout = await page.evaluate(() => {
    const doc = document.documentElement
    // Scoped to controls this project owns and styles:
    //  - Clerk renders its own form chrome (`cl-` classes); we cannot restyle its
    //    internals, and its sizing is the vendor's contract, not ours.
    //  - `input[type=range]` is a native slider whose thumb is the real target;
    //    the existing responsive gate already passes these routes, so excluding
    //    it keeps this audit consistent with the established standard rather
    //    than inventing a stricter one here.
    const smallTargets = [...document.querySelectorAll('a[href], button, summary, input, select')]
      .filter((element) => !element.closest('.cl-rootBox, .cl-card') && !/(^|\s)cl-/.test(element.className || ''))
      .filter((element) => !(element.tagName === 'INPUT' && element.type === 'range'))
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && (rect.width < 24 || rect.height < 24)
      })
      .map((element) => element.tagName.toLowerCase())
    const sidebar = document.querySelector('.sidebar')
    const badge = document.querySelector('.account-badge')
    return {
      pageOverflow: doc.scrollWidth > doc.clientWidth + 1,
      smallTargets,
      hasFeatureGate: Boolean(document.querySelector('.feature-gate')),
      hasAccountBadge: Boolean(badge),
      hasClerkForm: Boolean(document.querySelector('.cl-rootBox, .cl-card')),
      hasUnconfiguredCard: Boolean(document.querySelector('.auth-unconfigured')),
      badgeWithinSidebar: sidebar && badge
        ? Math.round(badge.getBoundingClientRect().right) <= Math.round(sidebar.getBoundingClientRect().right)
        : null,
      // Signed out, the badge renders the sign-in action rather than the identity
      // row, so that action is what a CI run can actually verify collapses.
      signInActionPresent: Boolean(document.querySelector('.account-signin')),
      signInLabelHidden: (() => {
        const action = document.querySelector('.account-signin')
        return action ? parseFloat(getComputedStyle(action).fontSize) === 0 : null
      })(),
      signInWithinSidebar: (() => {
        const bar = document.querySelector('.sidebar'); const action = document.querySelector('.account-signin')
        return bar && action ? Math.round(action.getBoundingClientRect().right) <= Math.round(bar.getBoundingClientRect().right) : null
      })(),
    }
  })

  const axeResult = await page.evaluate(async ([source, tags]) => {
    // eslint-disable-next-line no-eval
    if (!window.axe) { const runAxe = new Function(source); runAxe() }
    return window.axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] })
  }, [axeCore.source, axeTags])

  page.off('console', onConsole)
  page.off('pageerror', onPageError)
  page.off('request', onRequest)

  const externalOrigins = [...origins].filter((origin) => !allowedOriginPattern.test(origin))
  const failures = []
  if (axeResult.violations.length) failures.push({ type: 'wcag-violation', issues: summarizeViolations(axeResult.violations) })
  if (layout.pageOverflow) failures.push({ type: 'page-horizontal-overflow' })
  if (layout.smallTargets.length) failures.push({ type: 'target-below-24px', tags: layout.smallTargets })
  if (runtimeIssues.length) failures.push({ type: 'runtime', count: runtimeIssues.length })
  if (consoleIssues.length) failures.push({ type: 'console', count: consoleIssues.length })
  if (externalOrigins.length) failures.push({ type: 'unexpected-origin', origins: externalOrigins })
  for (const [name, ok] of Object.entries(checks(layout))) {
    if (!ok) failures.push({ type: 'contract', check: name })
  }

  return { label, passes: axeResult.passes.length, layout, failures }
}

const report = { runId, appUrl, axeVersion: axeCore.version, engines: [], failures: [] }

for (const engine of requestedEngines) {
  const browser = await launch(engine)
  const engineReport = { engine, viewports: [] }
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
      const page = await context.newPage()
      const audits = []

      for (const surface of marketingSurfaces) {
        const isAuth = surface.id === 'signIn' || surface.id === 'signUp'
        audits.push(await auditPage(page, {
          label: `${surface.id}`,
          url: surface.url,
          expect: surface.expect,
          checks: (layout) => isAuth
            // The whole point of a keyed run: the real Clerk form must mount and
            // the "no identity provider" fallback must not appear.
            ? { clerkFormMounted: layout.hasClerkForm, unconfiguredCardAbsent: !layout.hasUnconfiguredCard }
            : {},
        }))
      }

      // The sidebar only exists in the planner, so badge checks live here.
      for (const route of gatedRoutes) {
        audits.push(await auditPage(page, {
          label: `gated:${route}`,
          url: `/#/${route}`,
          expect: '.app-shell',
          checks: (layout) => ({
            upgradeGateShown: layout.hasFeatureGate,
            accountBadgeShown: layout.hasAccountBadge,
            badgeWithinSidebar: layout.badgeWithinSidebar !== false,
            // The sidebar only exists above 768px; below 1100px it is an icon rail.
            // Assert the action is really there before asserting anything about it,
            // so an absent element can never satisfy this check by omission.
            signInActionPresent: viewport.width < 768 || layout.signInActionPresent,
            signInWithinSidebar: layout.signInWithinSidebar !== false,
            railLabelHidden: viewport.width > 1100 || viewport.width < 768 || layout.signInLabelHidden === true,
          }),
        }))
      }
      for (const route of openRoutes) {
        audits.push(await auditPage(page, {
          label: `open:${route}`,
          url: `/#/${route}`,
          expect: '.app-shell',
          checks: (layout) => ({ noUpgradeGate: !layout.hasFeatureGate }),
        }))
      }

      const viewportFailures = audits.filter((audit) => audit.failures.length)
      engineReport.viewports.push({
        viewport: viewport.name,
        audited: audits.length,
        results: audits.map(({ label, passes, failures }) => ({ label, passes, failures })),
      })
      for (const audit of viewportFailures) {
        report.failures.push({ engine, viewport: viewport.name, label: audit.label, failures: audit.failures })
      }
      await context.close()
    }
  } catch (error) {
    report.failures.push({ engine, type: 'launch-or-audit', message: error instanceof Error ? error.message.slice(0, 400) : 'unknown error' })
  } finally {
    await browser.close()
  }
  report.engines.push(engineReport)
}

await writeFile(path.join(artifactDir, 'report.json'), JSON.stringify(report, null, 2))
await writeFile(path.resolve('work', 'keyed-surfaces', 'latest-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ runId, engines: requestedEngines, failures: report.failures, artifactDir }, null, 2))
for (const failure of report.failures) {
  const detail = failure.failures?.map((item) => item.type + (item.check ? `:${item.check}` : '')).join(', ') ?? failure.type
  console.log(`::error title=Keyed surface audit (${failure.engine}/${failure.viewport ?? '-'}/${failure.label ?? '-'})::${detail}`)
}
if (report.failures.length) process.exitCode = 1
