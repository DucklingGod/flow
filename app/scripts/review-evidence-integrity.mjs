import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

export function safeChildPath(baseDir, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)) throw new Error(`Unsafe evidence path: ${String(relativePath)}`)
  const resolved = path.resolve(baseDir, relativePath)
  const relative = path.relative(baseDir, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Evidence path escapes its root: ${relativePath}`)
  return resolved
}

export async function verifyHashedFiles(baseDir, entries, label, maxEntries) {
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > maxEntries) throw new Error(`${label} manifest must contain 1-${maxEntries} entries.`)
  const failures = []
  for (const entry of entries) {
    if (!entry || typeof entry.path !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256 ?? '') || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0) {
      failures.push({ path: String(entry?.path ?? ''), reason: 'invalid-manifest-entry' })
      continue
    }
    try {
      const filePath = safeChildPath(baseDir, entry.path)
      const info = await stat(filePath)
      if (!info.isFile() || info.size !== entry.bytes) {
        failures.push({ path: entry.path, reason: 'byte-size-mismatch' })
        continue
      }
      const bytes = await readFile(filePath)
      if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) failures.push({ path: entry.path, reason: 'sha256-mismatch' })
    } catch {
      failures.push({ path: entry.path, reason: 'missing-or-unreadable' })
    }
  }
  return failures
}
