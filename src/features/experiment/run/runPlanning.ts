import { LIMITS } from '../../../shared/constants';
import type { ExperimentConfig } from '../../../shared/schema';

// Sizing decisions for a run (plan section 9). None of these can change results: a simulation's
// seed comes only from its index (spec 8.1), so chunk size and worker count only affect speed.

/** Measured in Phase 5: about 1.23 µs per round including bookkeeping. Rounded up for estimates. */
export const ROUND_COST_MICROSECONDS = 1.25;
/** Each worker generates the strategy table once per run (about 1.3 s). */
export const TABLE_PREPARATION_SECONDS = 1.5;
const TARGET_CHUNK_MS = 150;
const MAX_CHUNK_SIMULATIONS = 500;

export type WorkerCountSetting = ExperimentConfig['workerCount'];

/** Auto = min(4, max(1, logical cores − 1)); manual 1-4 (CLAUDE.md, Workers). */
export function resolveWorkerCount(setting: WorkerCountSetting, logicalCores: number): number {
  if (setting !== 'auto') return setting;
  const cores = Number.isFinite(logicalCores) && logicalCores > 0 ? Math.floor(logicalCores) : 1;
  return Math.min(LIMITS.maxWorkers, Math.max(1, cores - 1));
}

/** Worst-case rounds for one simulation: every strategy plays to the round limit. */
function worstCaseRoundsPerSimulation(config: ExperimentConfig): number {
  return config.strategies.length * config.roundLimit;
}

/** Simulations per chunk, aiming for about 150 ms of work in the worst case. */
export function chunkSimulationCount(config: ExperimentConfig): number {
  const microsecondsPerSimulation = worstCaseRoundsPerSimulation(config) * ROUND_COST_MICROSECONDS;
  const fitting = Math.floor((TARGET_CHUNK_MS * 1000) / microsecondsPerSimulation);
  return Math.min(MAX_CHUNK_SIMULATIONS, Math.max(1, fitting));
}

export interface ChunkRange {
  readonly chunkId: number;
  readonly firstSimulation: number;
  readonly simulationCount: number;
}

/** Contiguous chunks in simulation order, so the displayed simulations finish first (spec 10.9). */
export function planChunks(simulations: number, chunkSize: number): ChunkRange[] {
  const chunks: ChunkRange[] = [];
  for (let first = 0; first < simulations; first += chunkSize) {
    chunks.push({
      chunkId: chunks.length,
      firstSimulation: first,
      simulationCount: Math.min(chunkSize, simulations - first),
    });
  }
  return chunks;
}

/** Upper-bound runtime in seconds: all rounds played, spread evenly over the workers. */
export function estimateRuntimeSeconds(config: ExperimentConfig, workers: number): number {
  const totalRounds = config.simulations * worstCaseRoundsPerSimulation(config);
  return TABLE_PREPARATION_SECONDS + (totalRounds * ROUND_COST_MICROSECONDS) / 1e6 / workers;
}
