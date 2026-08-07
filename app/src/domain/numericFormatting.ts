const thaiDigits: Record<string, string> = { '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4', '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9' }

export function normalizeNumericText(value: string) {
  return value.replace(/[๐-๙]/g, (digit) => thaiDigits[digit] ?? digit).replace(/[,_\s]/g, '')
}

export function formatEditableNumber(value: string, allowNegative = true, fractionDigits = 8) {
  const normalized = normalizeNumericText(value)
  const negative = allowNegative && normalized.startsWith('-')
  const unsigned = normalized.replaceAll('-', '')
  const decimalIndex = unsigned.indexOf('.')
  const rawInteger = (decimalIndex >= 0 ? unsigned.slice(0, decimalIndex) : unsigned).replace(/\D/g, '')
  const rawFraction = (decimalIndex >= 0 ? unsigned.slice(decimalIndex + 1) : '').replace(/\D/g, '').slice(0, fractionDigits)
  const integer = rawInteger || (decimalIndex >= 0 ? '0' : '')
  const grouped = integer.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const decimal = decimalIndex >= 0 && fractionDigits > 0 ? `.${rawFraction}` : ''
  return `${negative ? '-' : ''}${grouped}${decimal}`
}

export function parseFormattedNumber(value: string) {
  const normalized = normalizeNumericText(value)
  if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}
