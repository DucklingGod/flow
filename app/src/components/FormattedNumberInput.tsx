import { useEffect, useRef, useState, type FocusEventHandler, type InputHTMLAttributes, type KeyboardEvent } from 'react'
import { formatEditableNumber, normalizeNumericText, parseFormattedNumber } from '../domain/numericFormatting'

type NativeProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max' | 'step'>

interface CommonFormattedNumberInputProps extends NativeProps {
  min?: number | string
  max?: number | string
  step?: number | string
}

interface RequiredNumberInputProps extends CommonFormattedNumberInputProps {
  value: number
  onValueChange: (value: number) => void
  allowEmpty?: false
}

interface NullableNumberInputProps extends CommonFormattedNumberInputProps {
  value: number | null
  onValueChange: (value: number | null) => void
  allowEmpty: true
}

export type FormattedNumberInputProps = RequiredNumberInputProps | NullableNumberInputProps

function decimalsFromStep(step: FormattedNumberInputProps['step']) {
  if (step === 'any') return 8
  const numericStep = Number(step)
  if (!Number.isFinite(numericStep) || numericStep <= 0) return 0
  const text = String(step)
  if (text.includes('e-')) return Math.min(8, Number(text.split('e-')[1]) || 0)
  return Math.min(8, text.split('.')[1]?.length ?? 0)
}

function clamp(value: number, min?: number, max?: number) {
  return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, value))
}

function formatCommittedNumber(value: number, fractionDigits: number) {
  return new Intl.NumberFormat('en-US', { useGrouping: true, maximumFractionDigits: fractionDigits }).format(value)
}

function caretFromLogicalPosition(formatted: string, logicalPosition: number) {
  if (logicalPosition <= 0) return 0
  let logical = 0
  for (let index = 0; index < formatted.length; index += 1) {
    if (formatted[index] !== ',') logical += 1
    if (logical >= logicalPosition) return index + 1
  }
  return formatted.length
}

export function FormattedNumberInput({ value, onValueChange, allowEmpty = false, min, max, step = 1, onBlur, onFocus, disabled, readOnly, ...props }: FormattedNumberInputProps) {
  const fractionDigits = decimalsFromStep(step)
  const numericMin = min === undefined || !Number.isFinite(Number(min)) ? undefined : Number(min)
  const numericMax = max === undefined || !Number.isFinite(Number(max)) ? undefined : Number(max)
  const allowNegative = numericMin === undefined || numericMin < 0
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : (numericMin ?? 0)
  const [draft, setDraft] = useState(() => value === null ? '' : formatCommittedNumber(numericValue, fractionDigits))
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!focused) setDraft(value === null ? '' : formatCommittedNumber(numericValue, fractionDigits))
  }, [focused, fractionDigits, numericValue, value])

  const emitValue = (next: number | null) => {
    if (next === null) (onValueChange as (value: number | null) => void)(null)
    else (onValueChange as (value: number) => void)(next)
  }

  const commit = (candidate: number) => {
    const next = clamp(candidate, numericMin, numericMax)
    emitValue(next)
    return next
  }

  const handleChange: InputHTMLAttributes<HTMLInputElement>['onChange'] = (event) => {
    const logicalPosition = normalizeNumericText(event.currentTarget.value.slice(0, event.currentTarget.selectionStart ?? event.currentTarget.value.length)).length
    const formatted = formatEditableNumber(event.currentTarget.value, allowNegative, fractionDigits)
    setDraft(formatted)
    const parsed = parseFormattedNumber(formatted)
    if (parsed !== null) emitValue(clamp(parsed, numericMin, numericMax))
    else if (allowEmpty && formatted === '') emitValue(null)
    const caret = caretFromLogicalPosition(formatted, logicalPosition)
    const restoreCaret = () => inputRef.current?.setSelectionRange(caret, caret)
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(restoreCaret)
    else queueMicrotask(restoreCaret)
  }

  const handleFocus: FocusEventHandler<HTMLInputElement> = (event) => {
    setFocused(true)
    onFocus?.(event)
  }

  const handleBlur: FocusEventHandler<HTMLInputElement> = (event) => {
    const parsed = parseFormattedNumber(draft)
    if (allowEmpty && draft === '') emitValue(null)
    else {
      const committed = commit(parsed ?? numericValue)
      setDraft(formatCommittedNumber(committed, fractionDigits))
    }
    setFocused(false)
    onBlur?.(event)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    props.onKeyDown?.(event)
    if (event.defaultPrevented || readOnly || disabled || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    const numericStep = Number(step)
    const increment = Number.isFinite(numericStep) && numericStep > 0 ? numericStep : 1
    const base = parseFormattedNumber(draft) ?? numericValue
    const next = commit(base + (event.key === 'ArrowUp' ? increment : -increment))
    setDraft(formatCommittedNumber(next, fractionDigits))
  }

  return <input
    {...props}
    ref={inputRef}
    type="text"
    role="spinbutton"
    inputMode={fractionDigits > 0 || allowNegative ? 'decimal' : 'numeric'}
    data-formatted-number="true"
    value={draft}
    disabled={disabled}
    readOnly={readOnly}
    aria-valuenow={typeof value === 'number' && Number.isFinite(value) ? value : undefined}
    aria-valuemin={numericMin}
    aria-valuemax={numericMax}
    onChange={handleChange}
    onFocus={handleFocus}
    onBlur={handleBlur}
    onKeyDown={handleKeyDown}
  />
}
