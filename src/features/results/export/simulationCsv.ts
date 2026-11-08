import type { ExperimentResults } from '../../../engine/statistics/experimentResults';
import { simulationSeed } from '../../../engine/simulation/rng';
import { TARGET_IDS } from '../../../shared/targets';
import { csvRow, integerCell, moneyCell } from './csv';
import type { ExportMeta } from './exportMeta';

// CSV 2, per simulation (spec 10.7): one row per finished simulation per strategy, ordered by
// simulation id and then by configuration order. `run_status` follows `experiment_id` (2.8) so a
// partial file says so. Rows are produced in blocks, so the page can stay responsive while a large
// file is assembled (plan 8.4).

export const SIMULATION_COLUMNS = [
  'experiment_id',
  'run_status',
  'simulation_id',
  'simulation_seed',
  'strategy_id',
  'strategy_version',
  'rounds_played',
  'final_bankroll',
  'net_profit',
  'total_wagered',
  'max_wager',
  'max_drawdown',
  ...TARGET_IDS.map((target) => `first_cross_${target}`),
  'stop_reason',
  'unavailable_actions',
  'minimum_overshoot_count',
] as const;

export const ROWS_PER_BLOCK = 2000;

function rowsFor(results: ExperimentResults, meta: ExportMeta, simulation: number): string[] {
  const seed = String(simulationSeed(meta.experimentSeed, simulation));
  return results.columns.map((columns, index) => {
    const strategy = results.shape.strategies[index];
    const netProfit = columns.netProfit[simulation] ?? 0;
    return csvRow([
      meta.experimentId,
      meta.runStatus,
      String(simulation),
      seed,
      strategy?.id ?? '',
      strategy?.version ?? '',
      integerCell(columns.roundsPlayed[simulation] ?? 0),
      moneyCell(results.shape.startingBankroll + netProfit),
      moneyCell(netProfit),
      moneyCell(columns.totalWagered[simulation] ?? 0),
      moneyCell(columns.maxWager[simulation] ?? 0),
      moneyCell(columns.maxDrawdown[simulation] ?? 0),
      ...TARGET_IDS.map((target) => integerCell(columns.firstCrossingAt(target, simulation))),
      columns.stopReasonAt(simulation),
      integerCell(columns.unavailableActions[simulation] ?? 0),
      integerCell(columns.overshootCount[simulation] ?? 0),
    ]);
  });
}

/** The header, then blocks of about `rowsPerBlock` rows, each a ready-to-write string. */
export function* simulationCsvBlocks(
  results: ExperimentResults,
  meta: ExportMeta,
  rowsPerBlock = ROWS_PER_BLOCK,
): Generator<string, void, undefined> {
  yield csvRow(SIMULATION_COLUMNS);
  let block: string[] = [];
  for (let simulation = 0; simulation < results.shape.simulations; simulation += 1) {
    if (!results.isCompleted(simulation)) continue;
    block.push(...rowsFor(results, meta, simulation));
    if (block.length >= rowsPerBlock) {
      yield block.join('');
      block = [];
    }
  }
  if (block.length > 0) yield block.join('');
}

export function simulationCsvRowCount(results: ExperimentResults): number {
  return results.completed * results.shape.strategies.length;
}

/** About how large the file will be: the first finished simulation's rows, scaled up. */
export function estimateSimulationCsvBytes(results: ExperimentResults, meta: ExportMeta): number {
  const header = csvRow(SIMULATION_COLUMNS).length;
  for (let simulation = 0; simulation < results.shape.simulations; simulation += 1) {
    if (!results.isCompleted(simulation)) continue;
    const sample = rowsFor(results, meta, simulation).join('').length;
    return header + sample * results.completed;
  }
  return header;
}

/** Files above this size ask before they are built (plan 8.4: "warn on large exports"). */
export const LARGE_EXPORT_BYTES = 10 * 1024 * 1024;

/**
 * Drains blocks, yielding to the event loop between them so the interface never freezes.
 * `pause` is injectable for tests; `shouldStop` lets the user abandon a long export.
 */
export async function collectBlocks(
  blocks: Iterable<string>,
  options: {
    readonly onProgress?: (blocksDone: number) => void;
    readonly pause?: () => Promise<void>;
    readonly shouldStop?: () => boolean;
  } = {},
): Promise<string[] | null> {
  const pause =
    options.pause ??
    (() =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      }));
  const parts: string[] = [];
  for (const block of blocks) {
    if (options.shouldStop?.() === true) return null;
    parts.push(block);
    options.onProgress?.(parts.length);
    await pause();
  }
  return parts;
}
