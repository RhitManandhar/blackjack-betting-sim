// Statistic definitions from spec 10.2. These operate on finished numbers, so floating point
// is fine here; money totals feeding them are exact integers.

/** z for 95% Wilson intervals (spec 10.2). */
export const Z_WILSON_95 = 1.959964;
/** z for 95% intervals of means and of return per unit wagered (spec 10.2). */
export const Z_95 = 1.96;

export interface Interval {
  readonly low: number;
  readonly high: number;
}

/** Hyndman-Fan type 7 (numpy default, Excel PERCENTILE.INC) on ascending values. p in [0, 1]. */
export function percentileType7(sorted: ArrayLike<number>, p: number): number {
  const n = sorted.length;
  if (n === 0) throw new RangeError('percentile of an empty set');
  if (p < 0 || p > 1) throw new RangeError(`p must be in [0, 1], got ${String(p)}`);
  const h = (n - 1) * p;
  const below = Math.floor(h);
  const lower = sorted[below] ?? Number.NaN;
  const upper = sorted[Math.min(below + 1, n - 1)] ?? Number.NaN;
  return lower + (h - below) * (upper - lower);
}

/** Wilson score interval for a proportion (spec 10.2). */
export function wilsonInterval(successes: number, n: number, z = Z_WILSON_95): Interval {
  if (n <= 0) throw new RangeError('Wilson interval needs n > 0');
  const p = successes / n;
  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denominator;
  const halfWidth = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;
  return { low: Math.max(0, centre - halfWidth), high: Math.min(1, centre + halfWidth) };
}

/** mean ± 1.96·SD/√n (spec 10.2). */
export function meanInterval(mean: number, sd: number, n: number): Interval {
  const halfWidth = (Z_95 * sd) / Math.sqrt(n);
  return { low: mean - halfWidth, high: mean + halfWidth };
}

/**
 * Return per unit wagered R = Σp / Σw with the ratio-estimator interval (spec 10.2):
 * SE = sqrt(Σ(pᵢ − R·wᵢ)² / (n(n−1))) / mean(w), interval R ± 1.96·SE.
 * Σ(pᵢ − R·wᵢ)² is expanded as Σp² − 2R·Σpw + R²·Σw² so it can be built from exact sums.
 */
export function ratioInterval(
  ratio: number,
  n: number,
  sumW: number,
  sumP2: number,
  sumPW: number,
  sumW2: number,
): Interval | null {
  if (n < 2 || sumW <= 0) return null;
  const residualSquares = Math.max(0, sumP2 - 2 * ratio * sumPW + ratio * ratio * sumW2);
  const standardError = Math.sqrt(residualSquares / (n * (n - 1))) / (sumW / n);
  return { low: ratio - Z_95 * standardError, high: ratio + Z_95 * standardError };
}
