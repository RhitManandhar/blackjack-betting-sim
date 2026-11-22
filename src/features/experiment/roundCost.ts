import type { StorageLike } from './recentExperiments';

// The worker time per round measured on this device by the last run (Phase 9), kept in browser
// storage so the next pre-run estimate reflects this device rather than a cautious constant.
// It only feeds the estimate, so a missing, blocked or odd value just falls back to the default.

export const ROUND_COST_KEY = 'blackjack-betting-sim.round-cost.v1';

/** Plausible range in microseconds; anything outside is treated as a bad measurement. */
const MIN_COST = 0.05;
const MAX_COST = 50;

/** Ignore tiny runs: too little work for a stable measurement. */
export const MIN_MEASURED_ROUNDS = 1_000_000;

const plausible = (value: number): boolean =>
  Number.isFinite(value) && value >= MIN_COST && value <= MAX_COST;

export function loadRoundCost(storage: StorageLike | null): number | null {
  try {
    const value = Number(storage?.getItem(ROUND_COST_KEY) ?? Number.NaN);
    return plausible(value) ? value : null;
  } catch {
    return null;
  }
}

/** Saves the measurement if it is plausible and came from enough rounds; returns what is stored. */
export function saveRoundCost(
  storage: StorageLike | null,
  microseconds: number | null,
  roundsPlayed: number,
): number | null {
  if (microseconds === null || roundsPlayed < MIN_MEASURED_ROUNDS || !plausible(microseconds)) {
    return loadRoundCost(storage);
  }
  try {
    storage?.setItem(ROUND_COST_KEY, String(microseconds));
  } catch {
    // Storage unavailable: the estimate keeps using the measurement for this visit only.
  }
  return microseconds;
}
