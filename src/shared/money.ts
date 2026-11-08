// Money is always an integer number of minor units (cents). See spec section 5.5.
// Nothing here uses floating-point arithmetic on money values.

export type Cents = number;

export const CENTS_PER_UNIT = 100;

export function isCents(value: number): boolean {
  return Number.isSafeInteger(value);
}

export function assertCents(value: number, label = 'amount'): void {
  if (!isCents(value)) {
    throw new RangeError(`${label} must be a safe integer number of cents, got ${value}`);
  }
}

/** Floor of numerator / divisor for non-negative integers, computed without fractions. */
export function floorDivide(numerator: number, divisor: number): number {
  assertNonNegativeInteger(numerator, 'numerator');
  assertPositiveInteger(divisor, 'divisor');
  return (numerator - (numerator % divisor)) / divisor;
}

/** Ceiling of numerator / divisor for non-negative integers, computed without fractions. */
export function ceilDivide(numerator: number, divisor: number): number {
  const floor = floorDivide(numerator, divisor);
  return numerator % divisor === 0 ? floor : floor + 1;
}

const DECIMAL_AMOUNT = /^(\d{1,13})(?:\.(\d{1,2}))?$/;

/**
 * Parses a non-negative decimal amount typed in currency units ("20", "20.5", "1250.00")
 * into cents. Returns null for anything else, including more than two decimals.
 * Grouping commas are accepted and ignored ("1,250.00").
 */
export function parseUnitsToCents(input: string): Cents | null {
  const match = DECIMAL_AMOUNT.exec(input.trim().replaceAll(',', ''));
  if (match === null) return null;
  const whole = Number(match[1]);
  const fraction = (match[2] ?? '').padEnd(2, '0');
  const cents = whole * CENTS_PER_UNIT + Number(fraction);
  return isCents(cents) ? cents : null;
}

/**
 * Rounds a fractional statistic (a mean, percentile or interval bound, in cents) to whole cents
 * for display and export, halves away from zero (spec 10.5, pinned in 2.8). Money totals are
 * already integers and pass through unchanged. Never used for payouts or bankroll arithmetic.
 */
export function roundStatisticToCents(value: number): Cents {
  const rounded = Math.sign(value) * Math.round(Math.abs(value));
  return rounded === 0 ? 0 : rounded;
}

/** "-1234.50" style: two decimals, no grouping. Used for CSV and JSON. */
export function formatCentsPlain(cents: Cents): string {
  assertCents(cents);
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const whole = floorDivide(absolute, CENTS_PER_UNIT);
  const fraction = absolute % CENTS_PER_UNIT;
  return `${sign}${whole}.${String(fraction).padStart(2, '0')}`;
}

/** "-1,234.50" style: two decimals with thousands grouping. Used in the UI and reports. */
export function formatCentsGrouped(cents: Cents): string {
  const plain = formatCentsPlain(cents);
  const sign = plain.startsWith('-') ? '-' : '';
  const [whole = '0', fraction = '00'] = plain.replace('-', '').split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}.${fraction}`;
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer, got ${value}`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer, got ${value}`);
  }
}
