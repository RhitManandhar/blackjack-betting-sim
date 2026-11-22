// Shared settings for the independent cross-checks (plan Phase 9, task 4). Long-running; run with
// `npm run bench:crosscheck`, never in CI. Results are recorded in docs/validation.md.

export const CROSS_CHECK_SEED = 20_261_122;
export const Z_99 = 2.5758;

/** Positive integer from an environment variable, or the default. */
export function countFromEnvironment(name: string, fallback: number, minimum: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(`${name} must be an integer >= ${String(minimum)}`);
  }
  return value;
}

export function percent(value: number, digits = 4): string {
  return `${(value * 100).toFixed(digits)}%`;
}
