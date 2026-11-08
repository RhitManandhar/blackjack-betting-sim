import type { ExperimentResults } from '../../engine/statistics/experimentResults';
import { simulationSeed } from '../../engine/simulation/rng';
import { formatCentsGrouped } from '../../shared/money';
import { STOP_REASONS, type StopReason } from '../../shared/stopReasons';

// Small read-only views over the result table for the live screen and dashboard. Statistics
// stay in src/engine/statistics; these only count, sample and format.

/** Statistics may be fractional; they are rounded to whole cents only here, for display. */
export const money = (cents: number): string => formatCentsGrouped(Math.round(cents));
export const percent = new Intl.NumberFormat('en-AU', {
  style: 'percent',
  maximumFractionDigits: 1,
});
export const rate = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 4,
  minimumFractionDigits: 4,
});
export const count = new Intl.NumberFormat('en-AU');

export type StopCounts = Record<StopReason, number>;

/** Stop reasons so far for each strategy, over finished simulations (plan 8.2). */
export function liveStopCounts(results: ExperimentResults): StopCounts[] {
  const counts = results.columns.map(
    () => Object.fromEntries(STOP_REASONS.map((reason) => [reason, 0])) as StopCounts,
  );
  for (let simulation = 0; simulation < results.shape.simulations; simulation += 1) {
    if (!results.isCompleted(simulation)) continue;
    results.columns.forEach((columns, strategy) => {
      const row = counts[strategy];
      if (row !== undefined) row[columns.stopReasonAt(simulation)] += 1;
    });
  }
  return counts;
}

export interface SampleRow {
  readonly simulationId: number;
  readonly seed: number;
  readonly roundsPlayed: number;
  readonly netProfit: number;
  readonly maxWager: number;
  readonly maxDrawdown: number;
  readonly stopReason: StopReason;
}

/** Spec 10.8: the sample is the first finished simulations by id, so it is deterministic. */
export const SAMPLE_LIMIT = 500;

export function sampleRows(
  results: ExperimentResults,
  strategyIndex: number,
  experimentSeed: number,
  limit = SAMPLE_LIMIT,
): SampleRow[] {
  const columns = results.columns[strategyIndex];
  if (columns === undefined) return [];
  const rows: SampleRow[] = [];
  for (
    let simulation = 0;
    simulation < results.shape.simulations && rows.length < limit;
    simulation += 1
  ) {
    if (!results.isCompleted(simulation)) continue;
    rows.push({
      simulationId: simulation,
      seed: simulationSeed(experimentSeed, simulation),
      roundsPlayed: columns.roundsPlayed[simulation] ?? 0,
      netProfit: columns.netProfit[simulation] ?? 0,
      maxWager: columns.maxWager[simulation] ?? 0,
      maxDrawdown: columns.maxDrawdown[simulation] ?? 0,
      stopReason: columns.stopReasonAt(simulation),
    });
  }
  return rows;
}
