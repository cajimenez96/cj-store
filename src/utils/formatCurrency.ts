/**
 * Formats a number or numeric string in Argentine currency format:
 * - Thousands separated by '.'
 * - Decimals separated by ','
 * - Exactly 2 decimal digits
 *
 * Examples:
 *   100000.12312 -> "$100.000,12"
 *   80000        -> "$80.000,00"
 *   1234567.89   -> "$1.234.567,89"
 *   undefined    -> "$0,00"
 */
export function formatPrice(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') return '$0,00';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '$0,00';

  return `$${num.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Formats a numeric value without the currency sign:
 * Example: 100000.12312 -> "100.000,12"
 */
export function formatAmount(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') return '0,00';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return '0,00';

  return num.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats an integer/numeric input value with Argentine thousands separators ('.'):
 *   10000000 -> "10.000.000"
 *   25000    -> "25.000"
 *   ""       -> ""
 */
export function formatPriceInput(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  const num = Number(digits);
  if (isNaN(num)) return '';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Parses a dot-formatted price input string back into a number (or '' when empty):
 *   "10.000.000" -> 10000000
 *   ""           -> ""
 */
export function parsePriceInput(raw: string): number | '' {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits);
}
