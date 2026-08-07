import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

const appRoot = process.cwd()
const repoRoot = path.resolve(appRoot, '..')
const allowedExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.yml', '.yaml'])
const excludedDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage', 'work'])
const thisFile = path.resolve(appRoot, 'scripts', 'release-boundary-scan.mjs')

async function collectFiles(target) {
  const entries = await readdir(target, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue
    const resolved = path.join(target, entry.name)
    if (entry.isDirectory()) files.push(...await collectFiles(resolved))
    else if (allowedExtensions.has(path.extname(entry.name)) && resolved !== thisFile) files.push(resolved)
  }
  return files
}

const scanRoots = [
  path.join(repoRoot, 'docs'),
  path.join(repoRoot, '.github'),
  path.join(appRoot, 'src'),
]
const standaloneFiles = [path.join(repoRoot, 'README.md'), path.join(repoRoot, 'PLAN.md'), path.join(appRoot, 'package.json')]
const files = [...standaloneFiles]
for (const root of scanRoots) files.push(...await collectFiles(root))

const secretPatterns = [
  ['OpenAI-style key', /\bsk-(?:live-|test-)?[A-Za-z0-9_-]{20,}\b/],
  ['GitHub token', /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}\b/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
]
const prohibitedNetworkCall = /(?:fetch\s*\(|axios\.(?:get|post|put|patch)\s*\(|new\s+WebSocket\s*\()[^\n]*(?:trade|order|broker|payment|transfer|tax[-_/]?fil)/i
const persistedSecret = /(?:localStorage|sessionStorage)\.(?:setItem|getItem)\s*\([^\n]*(?:api.?key|token|secret|password|passphrase|private.?key)/i
const findings = []

for (const file of files) {
  const content = await readFile(file, 'utf8')
  const relative = path.relative(repoRoot, file).replaceAll('\\', '/')
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    for (const [label, pattern] of secretPatterns) {
      if (pattern.test(line)) findings.push({ type: label, file: relative, line: index + 1 })
    }
    if (file.includes(`${path.sep}src${path.sep}`) && prohibitedNetworkCall.test(line)) findings.push({ type: 'prohibited transaction network call', file: relative, line: index + 1 })
    if (file.includes(`${path.sep}src${path.sep}`) && persistedSecret.test(line)) findings.push({ type: 'persisted secret-like value', file: relative, line: index + 1 })
  }
}

const flagsPath = path.join(appRoot, 'src', 'config', 'releaseFlags.ts')
const flags = await readFile(flagsPath, 'utf8')

// Capabilities deliberately enabled for the commercial release. Everything else
// that reaches off-device must still be explicitly false.
const approvedRemoteFlags = ['account', 'subscriptionBilling']
// The permanent product boundary. No gate approval unlocks these.
const prohibitedFlags = ['tradeExecution', 'paymentOrTransfer', 'taxFiling']
const gatedRemoteFlags = ['cloudSync', 'householdCollaboration', 'advisorSharing', 'externalAnalytics', 'externalAi', 'liveMarketRetrieval']

const unsafeFlags = [...gatedRemoteFlags, ...prohibitedFlags].filter((flag) => !new RegExp(`\\b${flag}:\\s*false\\b`).test(flags))
if (unsafeFlags.length) findings.push({ type: 'remote capability not explicitly false', flags: unsafeFlags })

// A prohibited capability must never appear as true, in any form.
const flippedProhibited = prohibitedFlags.filter((flag) => new RegExp(`\\b${flag}:\\s*true\\b`).test(flags))
if (flippedProhibited.length) findings.push({ type: 'permanently prohibited capability enabled', flags: flippedProhibited })

// An approved remote capability must still be declared, so silently deleting the
// flag cannot be used to dodge the check above.
const missingApproved = approvedRemoteFlags.filter((flag) => !new RegExp(`\\b${flag}:\\s*(true|false)\\b`).test(flags))
if (missingApproved.length) findings.push({ type: 'approved remote capability flag is missing', flags: missingApproved })

// Entitlement gating is a UX affordance, not an access control. If a paid
// capability ever becomes the *only* thing standing between a user and a
// server-side resource, that enforcement must live on the server.
// The provider's plan check belongs in the auth adapter and nowhere else, so
// entitlement decisions stay funnelled through the pure `entitlements` module
// rather than being re-derived ad hoc in feature code.
const authAdapterDirectory = `${path.sep}src${path.sep}auth${path.sep}`
const clientOnlyEntitlementGuard = /\bhas\s*\(\s*\{\s*plan\s*:/
for (const file of files.filter((item) => item.includes(`${path.sep}src${path.sep}`))) {
  const content = await readFile(file, 'utf8')
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (clientOnlyEntitlementGuard.test(line) && !file.includes(authAdapterDirectory)) {
      findings.push({ type: 'billing check outside the auth adapter', file: path.relative(repoRoot, file).replaceAll('\\', '/'), line: index + 1 })
    }
  }
}

const workflowPath = path.join(repoRoot, '.github', 'workflows', 'ci.yml')
const workflow = await readFile(workflowPath, 'utf8')
const requiredActionMajors = [
  ['actions/checkout', 7],
  ['actions/setup-node', 7],
  ['actions/upload-artifact', 7],
]
for (const [action, major] of requiredActionMajors) {
  if (!workflow.includes(`uses: ${action}@v${major}`)) findings.push({ type: 'release workflow action major is not pinned to the approved runtime', action, requiredMajor: major })
}
const unsafeArtifactLines = workflow.split(/\r?\n/).map((line, index) => ({ line: line.trim(), number: index + 1 })).filter(({ line }) =>
  /^app\/work\/(?:e2e|cross-browser|llm-connectors|acceptance-snapshot|studio-interactions|accessibility|responsive-accessibility|external-review)\/$/.test(line)
  || /(?:^|\/)(?:profile|downloads)(?:\/|$)/i.test(line)
  || /\.(?:flowbackup|db|db-wal|db-shm|db-journal)(?:$|\s)/i.test(line))
if (unsafeArtifactLines.length) findings.push({ type: 'release artifact upload includes broad browser state or backup data', entries: unsafeArtifactLines })

const report = {
  scannedFiles: files.length,
  approvedRemoteFlags,
  gatedRemoteFlagsChecked: gatedRemoteFlags.length,
  prohibitedFlagsChecked: prohibitedFlags.length,
  findings,
}
console.log(JSON.stringify(report, null, 2))
if (findings.length) process.exitCode = 1
