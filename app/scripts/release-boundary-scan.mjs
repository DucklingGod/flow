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
const remoteFlags = ['account', 'cloudSync', 'householdCollaboration', 'advisorSharing', 'externalAnalytics', 'externalAi', 'liveMarketRetrieval', 'tradeExecution', 'paymentOrTransfer', 'taxFiling']
const unsafeFlags = remoteFlags.filter((flag) => !new RegExp(`\\b${flag}:\\s*false\\b`).test(flags))
if (unsafeFlags.length) findings.push({ type: 'remote capability not explicitly false', flags: unsafeFlags })

const report = {
  scannedFiles: files.length,
  remoteFlagsChecked: remoteFlags.length,
  findings,
}
console.log(JSON.stringify(report, null, 2))
if (findings.length) process.exitCode = 1
