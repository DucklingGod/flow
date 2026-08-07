// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProjectionPoint } from '../domain/finance/projection'
import { ProjectionChart } from './ProjectionChart'

afterEach(cleanup)

const points = [
  { year: 0, nominal: 100_000, real: 100_000, contributed: 100_000, deposit: 100_000 },
  { year: 1, nominal: 130_000, real: 125_000, contributed: 120_000, deposit: 122_000 },
  { year: 2, nominal: 165_000, real: 150_000, contributed: 140_000, deposit: 145_000 },
] as ProjectionPoint[]

describe('ProjectionChart', () => {
  it('supports keyboard year exploration with an accessible value summary', () => {
    render(<ProjectionChart points={points} />)
    const chart = screen.getByRole('slider', { name: 'สำรวจกราฟประมาณการตามปี' })
    expect(chart).toHaveAttribute('aria-valuenow', '2')
    expect(chart.getAttribute('aria-valuetext')).toContain('มูลค่าพอร์ตหลังภาษี')
    fireEvent.keyDown(chart, { key: 'ArrowLeft' })
    expect(chart).toHaveAttribute('aria-valuenow', '1')
    fireEvent.keyDown(chart, { key: 'Home' })
    expect(chart).toHaveAttribute('aria-valuenow', '0')
    fireEvent.keyDown(chart, { key: 'End' })
    expect(chart).toHaveAttribute('aria-valuenow', '2')
  })

  it('selects the nearest point with pointer or touch-compatible pointer events', () => {
    render(<ProjectionChart points={points} />)
    const chart = screen.getByRole('slider', { name: 'สำรวจกราฟประมาณการตามปี' })
    Object.defineProperty(chart, 'getBoundingClientRect', { value: () => ({ left: 0, width: 720, top: 0, right: 720, bottom: 260, height: 260, x: 0, y: 0, toJSON: () => ({}) }) })
    fireEvent.pointerDown(chart, { clientX: 360 })
    expect(chart).toHaveAttribute('aria-valuenow', '1')
  })

  it('toggles individual series but never hides the last visible series', () => {
    const { container } = render(<ProjectionChart points={points} />)
    const nominal = screen.getByRole('button', { name: 'มูลค่าพอร์ตหลังภาษี' })
    fireEvent.click(nominal)
    expect(nominal).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelector('[data-series="nominal"]')).toBeNull()
    for (const label of ['เงินต้นสะสม', 'หลังเงินเฟ้อ']) fireEvent.click(screen.getByRole('button', { name: label }))
    const deposit = screen.getByRole('button', { name: 'ฝากประจำสุทธิ' })
    fireEvent.click(deposit)
    expect(deposit).toHaveAttribute('aria-pressed', 'true')
  })
})
