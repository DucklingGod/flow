export const MAX_PLAN_IMPORT_BYTES = 10 * 1024 * 1024
export const MAX_MARKET_SNAPSHOT_BYTES = 10 * 1024 * 1024
export const MAX_CSV_IMPORT_BYTES = 2 * 1024 * 1024
export const MAX_CSV_ROWS = 20_001 // one header plus the schema's 20,000 transactions
export const MAX_CSV_COLUMNS = 64
export const MAX_CSV_CELL_CHARACTERS = 10_000
export const MAX_PORTFOLIO_TRANSACTIONS = 20_000
export const TRANSACTION_LIMITS = { quantity: 1_000_000_000_000, price: 1_000_000_000_000, amount: 1_000_000_000_000_000, fxToThb: 1_000_000 } as const

export function assertFileSize(size: number, maximum: number, message: string) {
  if (!Number.isSafeInteger(size) || size < 0 || size > maximum) throw new Error(message)
}

export function assertTextSize(value: string, maximum: number, message: string) {
  // Reject oversized ASCII before allocating a second full UTF-8 buffer.
  if (value.length > maximum || new Blob([value]).size > maximum) throw new Error(message)
}
