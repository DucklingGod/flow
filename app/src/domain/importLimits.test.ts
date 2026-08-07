import { describe, expect, it } from 'vitest'
import { assertFileSize, assertTextSize, MAX_CSV_IMPORT_BYTES, MAX_PLAN_IMPORT_BYTES } from './importLimits'

describe('untrusted import resource limits', () => {
  it('accepts exact limits and rejects oversized or invalid file metadata', () => {
    expect(() => assertFileSize(MAX_PLAN_IMPORT_BYTES, MAX_PLAN_IMPORT_BYTES, 'too-large')).not.toThrow()
    for (const size of [MAX_PLAN_IMPORT_BYTES + 1, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
      expect(() => assertFileSize(size, MAX_PLAN_IMPORT_BYTES, 'too-large')).toThrow('too-large')
    }
  })

  it('counts UTF-8 bytes rather than only JavaScript characters', () => {
    expect(() => assertTextSize('a'.repeat(MAX_CSV_IMPORT_BYTES), MAX_CSV_IMPORT_BYTES, 'too-large')).not.toThrow()
    expect(() => assertTextSize('ก'.repeat(Math.floor(MAX_CSV_IMPORT_BYTES / 3) + 1), MAX_CSV_IMPORT_BYTES, 'too-large')).toThrow('too-large')
  })
})
