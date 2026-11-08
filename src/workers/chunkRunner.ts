import { type SimulationPlan, createSimulationPlan } from '../engine/simulation/plan';
import { type StrategySimulationResult, runSimulation } from '../engine/simulation/runSimulation';
import type { ExperimentConfig } from '../shared/schema';

// Runs a chunk (a contiguous range of simulation indices) inside a worker. Kept free of worker
// globals so Node tests can drive it directly. A chunk has no seed of its own: each simulation's
// seed comes from its index (spec 8.1), so chunking cannot change results.

export const PROGRESS_INTERVAL_MS = 300;

export interface ChunkOutcome {
  readonly simulations: StrategySimulationResult[][];
  readonly roundsPlayed: number;
}

export type ProgressCallback = (simulationsDone: number, roundsDone: number) => void;

export class ChunkRunner {
  private cachedRunId: string | null = null;
  private cachedPlan: SimulationPlan | null = null;

  /** One plan per run per worker: the strategy table is generated once, then reused. */
  private planFor(runId: string, config: ExperimentConfig): SimulationPlan {
    if (this.cachedRunId !== runId || this.cachedPlan === null) {
      this.cachedPlan = createSimulationPlan(config);
      this.cachedRunId = runId;
    }
    return this.cachedPlan;
  }

  /** Drops the cached plan for a run that was cancelled. */
  forget(runId: string): void {
    if (this.cachedRunId === runId) {
      this.cachedRunId = null;
      this.cachedPlan = null;
    }
  }

  run(
    runId: string,
    config: ExperimentConfig,
    firstSimulation: number,
    simulationCount: number,
    onProgress: ProgressCallback,
    now: () => number,
  ): ChunkOutcome {
    if (firstSimulation + simulationCount > config.simulations) {
      throw new RangeError('Chunk extends past the last simulation');
    }
    const plan = this.planFor(runId, config);
    const simulations: StrategySimulationResult[][] = [];
    let roundsPlayed = 0;
    let lastProgress = now();
    for (let offset = 0; offset < simulationCount; offset += 1) {
      const results = runSimulation(plan, firstSimulation + offset);
      for (const result of results) roundsPlayed += result.roundsPlayed;
      simulations.push(results);
      const time = now();
      if (time - lastProgress >= PROGRESS_INTERVAL_MS) {
        onProgress(offset + 1, roundsPlayed);
        lastProgress = time;
      }
    }
    return { simulations, roundsPlayed };
  }
}
