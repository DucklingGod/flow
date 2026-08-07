import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { createServer } from 'vite'
import { verifyHashedFiles } from './review-evidence-integrity.mjs'

const MAX_MANIFEST_BYTES = 512 * 1024
const MAX_RESPONSE_BYTES = 256 * 1024

function usage() {
  return 'Usage: npm.cmd run verify:external-review -- "<bundle-directory>" "<completed-response.json>"\n       npm.cmd run verify:external-review -- --latest --expect-template'
}

async function readBoundedJson(filePath, maxBytes) {
  const info = await stat(filePath)
  if (!info.isFile()) throw new Error(`Not a file: ${filePath}`)
  if (info.size > maxBytes) throw new Error(`File exceeds ${maxBytes} byte limit: ${filePath}`)
  const text = await readFile(filePath, 'utf8')
  return { text, value: JSON.parse(text) }
}

const args = process.argv.slice(2)
const expectTemplate = args.includes('--expect-template')
const useLatest = args.includes('--latest')
const positional = args.filter((item) => !item.startsWith('--'))

let bundleDir
let responsePath
if (useLatest) {
  const latest = await readBoundedJson(path.resolve('work', 'external-review', 'latest-manifest.json'), MAX_MANIFEST_BYTES)
  bundleDir = path.resolve('work', 'external-review', latest.value.runId)
  responsePath = positional[0] ? path.resolve(positional[0]) : path.join(bundleDir, 'REVIEW_RESPONSE.json')
} else {
  if (positional.length !== 2) throw new Error(usage())
  bundleDir = path.resolve(positional[0])
  responsePath = path.resolve(positional[1])
}

const manifestPath = path.join(bundleDir, 'manifest.json')
const manifestFile = await readBoundedJson(manifestPath, MAX_MANIFEST_BYTES)
const responseFile = await readBoundedJson(responsePath, MAX_RESPONSE_BYTES)
const manifestSha256 = createHash('sha256').update(manifestFile.text).digest('hex')
const artifactFailures = await verifyHashedFiles(bundleDir, manifestFile.value.evidenceArtifacts, 'Evidence artifact', 20)
const sourceRoot = path.resolve('..')
const sourceFailures = await verifyHashedFiles(sourceRoot, manifestFile.value.sourceFiles, 'Source snapshot', 100)

const vite = await createServer({ root: path.resolve('.'), logLevel: 'silent', appType: 'custom', server: { middlewareMode: true } })
let evaluateExternalReviewResponse
let buildExternalReviewResponseTemplate
try {
  ;({ evaluateExternalReviewResponse, buildExternalReviewResponseTemplate } = await vite.ssrLoadModule('/src/domain/reviewEvidence.ts'))
} finally {
  await vite.close()
}

const evaluation = evaluateExternalReviewResponse(responseFile.value, manifestFile.value, manifestSha256)
const integrityClean = artifactFailures.length === 0 && sourceFailures.length === 0
const exactTemplate = expectTemplate && JSON.stringify(responseFile.value) === JSON.stringify(buildExternalReviewResponseTemplate(manifestFile.value, manifestSha256))
const output = {
  bundleDir,
  responsePath,
  manifestSha256,
  structurallyValid: evaluation.structurallyValid,
  releaseReady: evaluation.releaseReady && integrityClean,
  gateStatus: evaluation.gateStatus,
  integrity: { clean: integrityClean, artifactFailures, sourceFailures },
  issueCount: evaluation.issues.length,
  issues: expectTemplate && exactTemplate ? [] : evaluation.issues,
  pendingTemplateIssueCount: expectTemplate && exactTemplate ? evaluation.issues.length : undefined,
  boundary: 'verification-only; does not enable sharing, providers, external AI, transactions, transfers, payments, or tax filing',
}
console.log(JSON.stringify(output, null, 2))

if (expectTemplate) {
  if (!exactTemplate || !integrityClean || !evaluation.structurallyValid || evaluation.releaseReady || Object.values(evaluation.gateStatus).some((status) => status !== 'pending')) process.exitCode = 1
} else if (!evaluation.releaseReady || !integrityClean) {
  process.exitCode = 1
}
