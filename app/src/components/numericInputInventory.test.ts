import { describe, expect, it } from 'vitest'

const rawSources = import.meta.glob(['../App.tsx', './*.tsx'], { eager: true, import: 'default', query: '?raw' }) as Record<string, string>
const productionSources = Object.entries(rawSources).filter(([file]) => !file.includes('.test.'))

describe('numeric input inventory', () => {
  it('routes every editable numeric text field through the grouped formatter', () => {
    const nativeNumberInputs = productionSources.flatMap(([file, source]) => [...source.matchAll(/<input\b[^>]*\btype=["']number["']/g)].map((match) => `${file}:${match.index}`))
    const formattedUsages = productionSources.reduce((total, [, source]) => total + [...source.matchAll(/<FormattedNumberInput\b/g)].length, 0)
    expect(nativeNumberInputs).toEqual([])
    expect(formattedUsages).toBe(94)
  })

  it('keeps native range, date, checkbox, password, and file controls outside the formatter', () => {
    const allSource = productionSources.map(([, source]) => source).join('\n')
    expect(allSource).toMatch(/<input\b[^>]*type=["']range["']/)
    expect(allSource).toMatch(/<input\b[^>]*type=["']date["']/)
    expect(allSource).toMatch(/<input\b[^>]*type=["']checkbox["']/)
    expect(allSource).toMatch(/<input\b[^>]*type=["']password["']/)
    expect(allSource).toMatch(/<input\b[^>]*type=["']file["']/)
  })
})
