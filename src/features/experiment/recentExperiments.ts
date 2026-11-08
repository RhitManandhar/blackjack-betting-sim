import { z } from 'zod';
import type { StrategySummary } from '../../engine/statistics/summary';
import { experimentConfigSchema, type ExperimentConfig } from '../../shared/schema';
import { STOP_REASONS } from '../../shared/stopReasons';
import { STRATEGY_IDS } from '../../shared/strategies';
import type { RunStatus } from './run/RunController';

// Recent experiment summaries in browser storage (plan 8.4): the last MAX_RECENT runs, each
// holding the configuration and a compact digest of its results, never per-simulation data.
// Storage is external input: entries are validated on load and invalid ones dropped. Storage
// can be unavailable (private windows, blocked site data), so every access is guarded.

export const STORAGE_KEY = 'blackjack-betting-sim.recent-experiments.v1';
export const MAX_RECENT = 10;

const strategyDigestSchema = z.strictObject({
  strategyId: z.enum(STRATEGY_IDS),
  strategyVersion: z.string(),
  simulations: z.int().min(0),
  profitMean: z.number(),
  profitMedian: z.number(),
  profitShare: z.number().min(0).max(1),
  returnPerUnitWagered: z.number(),
  statusCounts: z.strictObject(
    Object.fromEntries(STOP_REASONS.map((reason) => [reason, z.int().min(0)])) as Record<
      (typeof STOP_REASONS)[number],
      z.ZodInt
    >,
  ),
});

const recentExperimentSchema = z.strictObject({
  savedAt: z.number(),
  status: z.enum(['complete', 'cancelled', 'failed']),
  completedSimulations: z.int().min(0),
  config: experimentConfigSchema,
  strategies: z.array(strategyDigestSchema),
});

export type RecentExperiment = z.infer<typeof recentExperimentSchema>;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function digestOf(
  config: ExperimentConfig,
  status: Exclude<RunStatus, 'running'>,
  completedSimulations: number,
  strategies: readonly StrategySummary[],
  savedAt: number,
): RecentExperiment {
  return {
    savedAt,
    status,
    completedSimulations,
    config,
    strategies: strategies.map((strategy) => ({
      strategyId: strategy.strategyId,
      strategyVersion: strategy.strategyVersion,
      simulations: strategy.simulations,
      profitMean: strategy.profitMean,
      profitMedian: strategy.profitPercentiles.median,
      profitShare: strategy.profitShare,
      returnPerUnitWagered: strategy.returnPerUnitWagered,
      statusCounts: { ...strategy.statusCounts },
    })),
  };
}

export function loadRecent(storage: StorageLike | null): RecentExperiment[] {
  if (storage === null) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .map((entry) => recentExperimentSchema.safeParse(entry))
      .filter((result) => result.success)
      .map((result) => result.data)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/** Adds an entry first, replacing any earlier entry for the same experiment, and keeps MAX_RECENT. */
export function saveRecent(
  storage: StorageLike | null,
  entry: RecentExperiment,
): RecentExperiment[] {
  const others = loadRecent(storage).filter(
    (existing) => existing.config.experimentId !== entry.config.experimentId,
  );
  const next = [entry, ...others].slice(0, MAX_RECENT);
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: keep the list in memory for this visit only.
  }
  return next;
}

export function clearRecent(storage: StorageLike | null): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

/** The page's storage, or null when the browser blocks it. */
export function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
