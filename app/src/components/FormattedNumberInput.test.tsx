// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { useState, type KeyboardEventHandler } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatEditableNumber, normalizeNumericText, parseFormattedNumber } from '../domain/numericFormatting'
import { FormattedNumberInput } from './FormattedNumberInput'

afterEach(cleanup)

function ControlledInput({ initialValue = 1_000_000, min, max, step, onKeyDown }: { initialValue?: number; min?: number; max?: number; step?: number; onKeyDown?: KeyboardEventHandler<HTMLInputElement> }) {
  const [value, setValue] = useState(initialValue)
  return <FormattedNumberInput aria-label="จำนวนเงิน" min={min} max={max} step={step} onKeyDown={onKeyDown} value={value} onValueChange={setValue} />
}

describe('FormattedNumberInput', () => {
  it('formats every three digits and accepts grouped paste-like input', () => {
    render(<ControlledInput />)
    const input = screen.getByLabelText('จำนวนเงิน')
    expect(input).toHaveValue('1,000,000')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '1234567' } })
    expect(input).toHaveValue('1,234,567')
    fireEvent.change(input, { target: { value: '9,876,543' } })
    expect(input).toHaveValue('9,876,543')
  })

  it('preserves a decimal draft and supports Thai digits', () => {
    render(<ControlledInput initialValue={0} step={0.01} min={-100} />)
    const input = screen.getByLabelText('จำนวนเงิน')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '-๑๒๓๔.๕' } })
    expect(input).toHaveValue('-1,234.5')
    expect(input).toHaveAttribute('aria-valuenow', '-100')
    expect(formatEditableNumber('1234.', true, 2)).toBe('1,234.')
  })

  it('keeps an empty intermediate draft and restores the committed value on blur', () => {
    render(<ControlledInput initialValue={5000} />)
    const input = screen.getByLabelText('จำนวนเงิน')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '' } })
    expect(input).toHaveValue('')
    fireEvent.blur(input)
    expect(input).toHaveValue('5,000')
  })

  it('uses arrow keys with step and clamps to declared bounds', () => {
    render(<ControlledInput initialValue={9.5} min={0} max={10} step={0.5} />)
    const input = screen.getByLabelText('จำนวนเงิน')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input).toHaveValue('10')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(input).toHaveValue('10')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveValue('9.5')
  })

  it('exposes spinbutton semantics and forwards a custom handler', () => {
    const onKeyDown = vi.fn()
    render(<ControlledInput min={0} max={2_000_000} onKeyDown={onKeyDown} />)
    const input = screen.getByRole('spinbutton', { name: 'จำนวนเงิน' })
    expect(input).toHaveAttribute('inputmode', 'numeric')
    expect(input).toHaveAttribute('aria-valuemin', '0')
    expect(input).toHaveAttribute('aria-valuemax', '2000000')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onKeyDown).toHaveBeenCalledOnce()
  })

  it('normalizes and parses only finite numeric values', () => {
    expect(normalizeNumericText('๑,๒๓๔_๕๖')).toBe('123456')
    expect(parseFormattedNumber('1,234.50')).toBe(1234.5)
    expect(parseFormattedNumber('-')).toBeNull()
    expect(parseFormattedNumber('1e999')).toBeNull()
  })
})
