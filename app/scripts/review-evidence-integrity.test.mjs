import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, test } from 'node:test'
import { safeChildPath, verifyHashedFiles } from './review-evidence-integrity.mjs'

const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function fixture(content = 'review evidence') {
  const directory = await mkdtemp(path.join(tmpdir(), 'flow-review-evidence-'))
  temporaryDirectories.push(directory)
  const filePath = path.join(directory, 'artifact.txt')
  await writeFile(filePath, content)
  return {
    directory,
    entry: { path: 'artifact.txt', bytes: Buffer.byteLength(content), sha256: createHash('sha256').update(content).digest('hex') },
  }
}

test('accepts exact bounded artifact bytes', async () => {
  const { directory, entry } = await fixture()
  assert.deepEqual(await verifyHashedFiles(directory, [entry], 'Evidence', 10), [])
})

test('detects same-size SHA-256 tampering', async () => {
  const { directory, entry } = await fixture('original')
  await writeFile(path.join(directory, entry.path), 'tampered')
  assert.deepEqual(await verifyHashedFiles(directory, [entry], 'Evidence', 10), [{ path: 'artifact.txt', reason: 'sha256-mismatch' }])
})

test('detects byte-size mismatch and missing files', async () => {
  const { directory, entry } = await fixture('short')
  await writeFile(path.join(directory, entry.path), 'much longer')
  const failures = await verifyHashedFiles(directory, [entry, { ...entry, path: 'missing.txt' }], 'Evidence', 10)
  assert.deepEqual(failures, [{ path: 'artifact.txt', reason: 'byte-size-mismatch' }, { path: 'missing.txt', reason: 'missing-or-unreadable' }])
})

test('rejects traversal, absolute paths, and invalid manifest entries', async () => {
  const { directory, entry } = await fixture()
  assert.throws(() => safeChildPath(directory, '../escape.txt'), /escapes its root/)
  assert.throws(() => safeChildPath(directory, path.resolve(directory, 'absolute.txt')), /Unsafe evidence path/)
  assert.deepEqual(await verifyHashedFiles(directory, [{ ...entry, sha256: 'not-a-hash' }], 'Evidence', 10), [{ path: 'artifact.txt', reason: 'invalid-manifest-entry' }])
})

test('rejects empty and over-capacity manifests before reading files', async () => {
  const { directory, entry } = await fixture()
  await assert.rejects(() => verifyHashedFiles(directory, [], 'Evidence', 1), /must contain 1-1 entries/)
  await assert.rejects(() => verifyHashedFiles(directory, [entry, entry], 'Evidence', 1), /must contain 1-1 entries/)
})
