/**
 * Formats a numeric amount using the user's currency (Intl.NumberFormat).
 * Falls back to fixed 2dp if currency is falsy or unrecognised.
 */
export function formatAmount(amount: number, currency: string): string {
  if (!currency) return amount.toFixed(2);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
