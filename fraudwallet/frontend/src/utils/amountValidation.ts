/**
 * Validates and formats money amounts for payments
 */

export const AMOUNT_LIMITS = {
  MIN: 0.01,
  MAX: 999999.99,
  MIN_TOPUP: 10.00
}

/**
 * Validates if an amount is within acceptable range
 * @param amount - The amount to validate
 * @param options - Validation options
 * @returns Object with isValid flag and error message
 */
export function validateAmount(
  amount: number | string,
  options: { minTopup?: boolean } = {}
): { isValid: boolean; error: string | null; value: number } {
  // Convert to number
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

  // Check if valid number
  if (isNaN(numAmount)) {
    return { isValid: false, error: 'Please enter a valid amount', value: 0 }
  }

  // Check if positive
  if (numAmount <= 0) {
    return { isValid: false, error: 'Amount must be greater than zero', value: 0 }
  }

  // Check minimum for top-up
  if (options.minTopup && numAmount < AMOUNT_LIMITS.MIN_TOPUP) {
    return {
      isValid: false,
      error: `Minimum top-up amount is RM ${AMOUNT_LIMITS.MIN_TOPUP.toFixed(2)}`,
      value: 0
    }
  }

  // Check maximum
  if (numAmount > AMOUNT_LIMITS.MAX) {
    return {
      isValid: false,
      error: `Maximum amount is RM ${AMOUNT_LIMITS.MAX.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      value: 0
    }
  }

  // Round to 2 decimal places
  const roundedAmount = Math.round(numAmount * 100) / 100

  return { isValid: true, error: null, value: roundedAmount }
}

/**
 * Formats amount to 2 decimal places
 * @param amount - The amount to format
 * @returns Formatted amount rounded to 2 decimals
 */
export function formatAmount(amount: number | string): number {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(numAmount)) return 0
  return Math.round(numAmount * 100) / 100
}

/**
 * Formats amount for display with MYR currency
 * @param amount - The amount to format
 * @returns Formatted string like "RM 123.45"
 */
export function formatCurrency(amount: number): string {
  return `RM ${amount.toFixed(2)}`
}
