export function formatCurrency(amount: number, decimals: 0 | 2 = 2): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
