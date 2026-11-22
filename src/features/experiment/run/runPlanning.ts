import { LIMITS } from '../../../shared/constants';
import type { ExperimentConfig } from '../../../shared/schema';

// Sizing decisions for a run (plan section 9). None of these can change results: a simulation's
// seed comes only from its index (spec 8.1), so chunk size and worker count only affect speed.

/** Measured in Phase 5: about 1.23 µs per round including bookkeeping. Rounded up for estimates. */
export const ROUND_COST_MICROSECONDS = 1.25;
/** Each worker generates the strategy table once per run (about 1.3 s). */
export const TABLE_PREPARATION_SECONDS = 1.5;
export const TARGET_CHUNK_MS = 150;
/** Bounds one chunk-result message (each simulation carries every strategy's result). */
export const MAX_CHUNK_SIMULATIONS = 500;

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

/** Measured work from finished chunks of the current run (simulation time only). */
export interface ChunkTiming {
  readonly simulations: number;
  readonly rounds: number;
  readonly computeMs: number;
}

export const NO_TIMING: ChunkTiming = { simulations: 0, rounds: 0, computeMs: 0 };

/**
 * Size of the next chunk (Phase 9): about TARGET_CHUNK_MS of work at the speed measured so far
 * in this run, or the cautious worst-case size before any chunk has finished. Chunk sizes never
 * change results (spec 8.4), only how often workers report and how fast Stop All responds.
 */
export function adaptiveChunkSize(config: ExperimentConfig, timing: ChunkTiming): number {
  if (timing.simulations === 0 || timing.computeMs <= 0) return chunkSimulationCount(config);
  const msPerSimulation = timing.computeMs / timing.simulations;
  const fitting = Math.floor(TARGET_CHUNK_MS / msPerSimulation);
  return Math.min(MAX_CHUNK_SIMULATIONS, Math.max(1, fitting));
}

/** Measured worker time per round in microseconds, or null before any timed chunk. */
export function measuredRoundMicroseconds(timing: ChunkTiming): number | null {
  return timing.rounds > 0 && timing.computeMs > 0
    ? (timing.computeMs * 1000) / timing.rounds
    : null;
}

export interface ChunkRange {
  readonly chunkId: number;
  readonly firstSimulation: number;
  readonly simulationCount: number;
}

/**
 * Upper-bound runtime in seconds: every strategy plays to the round limit, spread evenly over
 * the workers. Uses the round cost measured on this device when one is known (Phase 9), else the
 * cautious default.
 */
export function estimateRuntimeSeconds(
  config: ExperimentConfig,
  workers: number,
  roundCostMicroseconds: number = ROUND_COST_MICROSECONDS,
): number {
  const totalRounds = config.simulations * worstCaseRoundsPerSimulation(config);
  return TABLE_PREPARATION_SECONDS + (totalRounds * roundCostMicroseconds) / 1e6 / workers;
}
