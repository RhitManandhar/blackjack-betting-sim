import { formatCentsPlain, roundStatisticToCents } from '../../../shared/money';

// CSV conventions (spec 10.5, pinned further in 2.8): UTF-8 without a byte-order mark, comma
// separated, CRLF line endings, a header row and no comment lines. Money in currency units with
// exactly two decimals (statistics rounded to whole cents, halves away from zero), rates as
// fractions with six decimals, other averages with two decimals, blank for "not applicable".

export const CSV_LINE_END = '\r\n';

const NEEDS_QUOTES = /[",\r\n]/;

/** RFC 4180: quote a cell only when it contains a comma, quote or line break. */
export function csvCell(value: string): string {
  return NEEDS_QUOTES.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function csvRow(cells: readonly string[]): string {
  return cells.map(csvCell).join(',') + CSV_LINE_END;
}

const isMissing = (value: number | null): value is null =>
  value === null || !Number.isFinite(value);

/** Cents (integer or fractional statistic) as currency units: "-12.50". */
export function moneyCell(cents: number | null): string {
  return isMissing(cents) ? '' : formatCentsPlain(roundStatisticToCents(cents));
}

function fixed(value: number | null, digits: number): string {
  if (isMissing(value)) return '';
  const text = value.toFixed(digits);
  // A tiny negative value would print as "-0.000000"; a rounded zero has no sign.
  return Number(text) === 0 ? (0).toFixed(digits) : text;
}

/** A fraction (share, rate, return per unit wagered) with six decimals. */
export function rateCell(value: number | null): string {
  return fixed(value, 6);
}

/** A non-money average such as rounds played, with two decimals. */
export function averageCell(value: number | null): string {
  return fixed(value, 2);
}

export function integerCell(value: number | null): string {
  return value === null ? '' : String(value);
}

export function booleanCell(value: boolean): string {
  return value ? 'true' : 'false';
}
