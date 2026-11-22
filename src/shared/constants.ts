// Limits and defaults from spec sections 9 and 10.9 and plan section 16.
// Caps confirmed as final by the Phase 9 benchmark (spec 2.9, docs/performance.md).

export const SPEC_VERSION = '2.9';
export const CONFIG_SCHEMA_VERSION = 1;
export const CURRENCY = 'AUD';

export const LIMITS = {
  maxSimulations: 50_000,
  maxRoundLimit: 10_000,
  totalRoundsBudget: 100_000_000,
  maxDisplayedSimulations: 25,
  /** Spec 2.7: bounds the per-simulation checkpoint bets kept for exact percentiles. */
  maxCheckpoints: 20,
  maxWorkers: 4,
  minParoliStreak: 2,
  maxParoliStreak: 5,
  maxUint32: 0xffff_ffff,
} as const;

export const DEFAULTS = {
  simulations: 5_000,
  roundLimit: 1_000,
  startingBankroll: 50_000,
  tableMinimum: 2_000,
  paroliStreakLength: 3,
  displayedSimulations: 6,
  checkpoints: [50, 100, 250, 500, 1_000],
} as const;
