import { IntegerMoments } from '../../../engine/statistics/integerMoments';
import { ExperimentResults } from '../../../engine/statistics/experimentResults';
import { type ExperimentSummary, summarizeExperiment } from '../../../engine/statistics/summary';
import type { StrategySimulationResult } from '../../../engine/simulation/runSimulation';
import type { ExperimentConfig } from '../../../shared/schema';
import type { StrategyId } from '../../../shared/strategies';
import {
  type ChunkResultMessage,
  type ToWorkerMessage,
  fromWorkerMessageSchema,
} from '../../../workers/messages';
import { type ChunkRange, chunkSimulationCount, planChunks } from './runPlanning';

// Runs an experiment on a bounded pool of workers (plan section 9, spec 10.4).
// - Chunks are queued in simulation order and handed to idle workers.
// - Results are merged into ExperimentResults, which rejects duplicates, so a retried chunk can
//   never be counted twice. A chunk is applied whole or not at all.
// - The screen gets a snapshot at most every SNAPSHOT_INTERVAL_MS, never per round.
// - Stop All empties the queue, tells busy workers to cancel, marks the run cancelled at once,
//   and terminates any worker still busy after CANCEL_BACKSTOP_MS.
// - A failed chunk is retried on a fresh worker up to MAX_CHUNK_RETRIES times; after that the
//   run stops as `failed` (spec 10.4, 2.5).

export const SNAPSHOT_INTERVAL_MS = 300;
export const CANCEL_BACKSTOP_MS = 250;
export const MAX_CHUNK_RETRIES = 2;

export type RunStatus = 'running' | 'complete' | 'cancelled' | 'failed';

export interface WorkerHandlers {
  onMessage(data: unknown): void;
  onError(message: string): void;
}

export interface PoolWorker {
  send(message: ToWorkerMessage): void;
  terminate(): void;
}

export type WorkerFactory = (handlers: WorkerHandlers) => PoolWorker;

export interface ProvisionalStrategy {
  readonly strategyId: StrategyId;
  readonly simulations: number;
  readonly meanProfit: number | null;
  readonly profitableShare: number | null;
}

export interface RunSnapshot {
  readonly runId: string;
  readonly status: RunStatus;
  readonly totalSimulations: number;
  readonly completedSimulations: number;
  readonly workers: number;
  readonly roundsPlayed: number;
  readonly elapsedMs: number;
  readonly roundsPerSecond: number;
  readonly provisional: readonly ProvisionalStrategy[];
  /** Results for displayed simulations 0..n-1, filled as each one finishes (spec 10.9). */
  readonly displayed: readonly (readonly StrategySimulationResult[] | null)[];
  /** Present once the run has ended (complete, cancelled or failed). */
  readonly summary: ExperimentSummary | null;
  readonly error: string | null;
}

interface Slot {
  worker: PoolWorker;
  /** The run the busy chunk belongs to; a slot can still be busy with a cancelled run's chunk. */
  runId: string | null;
  chunk: ChunkRange | null;
  progressRounds: number;
}

interface RunState {
  readonly runId: string;
  readonly config: ExperimentConfig;
  readonly chunks: readonly ChunkRange[];
  readonly queue: ChunkRange[];
  readonly attempts: Map<number, number>;
  readonly results: ExperimentResults;
  readonly profit: IntegerMoments[];
  readonly profitable: number[];
  readonly displayed: (readonly StrategySimulationResult[] | null)[];
  readonly startedAt: number;
  status: RunStatus;
  chunksDone: number;
  roundsPlayed: number;
  endedAt: number | null;
  summary: ExperimentSummary | null;
  error: string | null;
}

export interface RunControllerOptions {
  readonly createWorker: WorkerFactory;
  readonly onSnapshot: (snapshot: RunSnapshot) => void;
  readonly now?: () => number;
  /** Override for tests; defaults to the configuration's own chunk sizing. */
  readonly chunkSize?: (config: ExperimentConfig) => number;
}

export class RunController {
  private slots: Slot[] = [];
  private run: RunState | null = null;
  private runCounter = 0;
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly now: () => number;

  constructor(private readonly options: RunControllerOptions) {
    this.now = options.now ?? (() => Date.now());
  }

  get isRunning(): boolean {
    return this.run?.status === 'running';
  }

  start(config: ExperimentConfig, workerCount: number): string {
    if (this.isRunning) throw new Error('A run is already in progress');
    this.resizePool(workerCount);
    this.runCounter += 1;
    const runId = `run-${String(this.runCounter)}`;
    const chunkSize = (this.options.chunkSize ?? chunkSimulationCount)(config);
    const chunks = planChunks(config.simulations, chunkSize);
    this.run = {
      runId,
      config,
      chunks,
      queue: [...chunks],
      attempts: new Map(),
      results: new ExperimentResults(config),
      profit: config.strategies.map(() => new IntegerMoments()),
      profitable: config.strategies.map(() => 0),
      displayed: new Array<null>(Math.min(config.displayedSimulations, config.simulations)).fill(
        null,
      ),
      startedAt: this.now(),
      status: 'running',
      chunksDone: 0,
      roundsPlayed: 0,
      endedAt: null,
      summary: null,
      error: null,
    };
    this.dispatch();
    this.emitNow();
    return runId;
  }

  /** Stop All (plan section 9, spec 10.4). Keeps only simulations from whole, finished chunks. */
  stop(): void {
    const run = this.run;
    if (run?.status !== 'running') return;
    run.queue.length = 0;
    for (const slot of this.slots) {
      if (slot.chunk !== null) slot.worker.send({ type: 'cancel', runId: run.runId });
    }
    this.finish(run, 'cancelled', null);
    const cancelledRunId = run.runId;
    setTimeout(() => {
      this.slots.forEach((slot, index) => {
        if (slot.chunk !== null && slot.runId === cancelledRunId) {
          this.replaceWorker(index);
          this.dispatch();
        }
      });
    }, CANCEL_BACKSTOP_MS);
  }

  dispose(): void {
    if (this.snapshotTimer !== null) clearTimeout(this.snapshotTimer);
    this.snapshotTimer = null;
    for (const slot of this.slots) slot.worker.terminate();
    this.slots = [];
    this.run = null;
  }

  private resizePool(size: number): void {
    while (this.slots.length > size) this.slots.pop()?.worker.terminate();
    while (this.slots.length < size) this.slots.push(this.createSlot(this.slots.length));
  }

  private createSlot(index: number): Slot {
    const slot: Slot = {
      worker: { send: () => undefined, terminate: () => undefined },
      runId: null,
      chunk: null,
      progressRounds: 0,
    };
    slot.worker = this.options.createWorker({
      onMessage: (data) => {
        if (this.slots[index] === slot) this.handleMessage(slot, data);
      },
      onError: (message) => {
        if (this.slots[index] === slot) this.handleFailure(slot, message);
      },
    });
    return slot;
  }

  private replaceWorker(index: number): void {
    const old = this.slots[index];
    if (old === undefined) return;
    old.worker.terminate();
    this.slots[index] = this.createSlot(index);
  }

  private dispatch(): void {
    const run = this.run;
    if (run?.status !== 'running') return;
    for (const slot of this.slots) {
      if (slot.chunk !== null) continue;
      const chunk = run.queue.shift();
      if (chunk === undefined) return;
      slot.chunk = chunk;
      slot.runId = run.runId;
      slot.progressRounds = 0;
      slot.worker.send({
        type: 'start-chunk',
        runId: run.runId,
        chunkId: chunk.chunkId,
        config: run.config,
        firstSimulation: chunk.firstSimulation,
        simulationCount: chunk.simulationCount,
      });
    }
  }

  private handleMessage(slot: Slot, data: unknown): void {
    const parsed = fromWorkerMessageSchema.safeParse(data);
    if (!parsed.success) {
      this.handleFailure(slot, 'A worker sent a message that does not match the contract');
      return;
    }
    const message = parsed.data;
    const run = this.run;
    const ownsChunk =
      slot.chunk !== null && slot.runId === message.runId && slot.chunk.chunkId === message.chunkId;
    const forActiveRun = run?.status === 'running' && run.runId === message.runId;

    switch (message.type) {
      case 'progress':
        if (ownsChunk && forActiveRun) {
          slot.progressRounds = message.roundsDone;
          this.emitSoon();
        }
        return;
      case 'chunk-result':
        if (!ownsChunk) return;
        slot.chunk = null;
        slot.runId = null;
        slot.progressRounds = 0;
        // A chunk that finishes after Stop All is discarded whole (Phase 6 decision 4).
        if (forActiveRun) this.applyChunk(run, message);
        else this.dispatch();
        return;
      case 'error':
        if (ownsChunk || message.chunkId === null) this.handleFailure(slot, message.message);
        return;
    }
  }

  private applyChunk(run: RunState, message: ChunkResultMessage): void {
    const chunk = run.chunks[message.chunkId];
    if (chunk?.simulationCount !== message.simulations.length) {
      this.failRun(
        run,
        `Chunk ${String(message.chunkId)} returned the wrong number of simulations`,
      );
      return;
    }
    // Check the whole chunk before adding any of it, so it is applied all-or-nothing.
    const valid = message.simulations.every((results, offset) => {
      const id = chunk.firstSimulation + offset;
      return (
        !run.results.isCompleted(id) &&
        results.length === run.config.strategies.length &&
        results.every(
          (result, index) =>
            result.simulationId === id && result.strategyId === run.config.strategies[index]?.id,
        )
      );
    });
    if (!valid) {
      this.failRun(run, `Chunk ${String(message.chunkId)} returned unexpected simulations`);
      return;
    }
    for (const results of message.simulations) {
      run.results.add(results);
      results.forEach((result, index) => {
        run.profit[index]?.add(result.netProfit);
        if (result.netProfit > 0) run.profitable[index] = (run.profitable[index] ?? 0) + 1;
      });
      const id = results[0]?.simulationId ?? -1;
      if (id >= 0 && id < run.displayed.length) run.displayed[id] = results;
    }
    run.roundsPlayed += message.roundsPlayed;
    run.chunksDone += 1;

    if (run.chunksDone === run.chunks.length) {
      this.finish(run, 'complete', null);
      return;
    }
    this.dispatch();
    this.emitSoon();
  }

  private handleFailure(slot: Slot, reason: string): void {
    const index = this.slots.indexOf(slot);
    const chunk = slot.chunk;
    const chunkRunId = slot.runId;
    slot.chunk = null;
    slot.runId = null;
    if (index >= 0) this.replaceWorker(index);
    const run = this.run;
    if (run?.status !== 'running' || chunk === null || chunkRunId !== run.runId) {
      this.dispatch();
      return;
    }

    const attempts = (run.attempts.get(chunk.chunkId) ?? 0) + 1;
    run.attempts.set(chunk.chunkId, attempts);
    if (attempts > MAX_CHUNK_RETRIES) {
      this.failRun(
        run,
        `Simulations ${String(chunk.firstSimulation + 1)}-${String(chunk.firstSimulation + chunk.simulationCount)} failed ${String(attempts)} times: ${reason}`,
      );
      return;
    }
    run.queue.unshift(chunk);
    this.dispatch();
  }

  private failRun(run: RunState, error: string): void {
    run.queue.length = 0;
    this.slots.forEach((slot, index) => {
      if (slot.chunk !== null) {
        slot.chunk = null;
        slot.runId = null;
        this.replaceWorker(index);
      }
    });
    this.finish(run, 'failed', error);
  }

  private finish(run: RunState, status: Exclude<RunStatus, 'running'>, error: string | null): void {
    run.status = status;
    run.error = error;
    run.endedAt = this.now();
    run.summary = summarizeExperiment(run.results, run.config.targetMode !== 'none');
    this.emitNow();
  }

  private emitSoon(): void {
    if (this.snapshotTimer !== null) return;
    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = null;
      this.emit();
    }, SNAPSHOT_INTERVAL_MS);
  }

  private emitNow(): void {
    if (this.snapshotTimer !== null) clearTimeout(this.snapshotTimer);
    this.snapshotTimer = null;
    this.emit();
  }

  private emit(): void {
    const run = this.run;
    if (run === null) return;
    const elapsedMs = (run.endedAt ?? this.now()) - run.startedAt;
    const inFlightRounds =
      run.status === 'running' ? this.slots.reduce((sum, slot) => sum + slot.progressRounds, 0) : 0;
    const rounds = run.roundsPlayed + inFlightRounds;
    this.options.onSnapshot({
      runId: run.runId,
      status: run.status,
      totalSimulations: run.config.simulations,
      completedSimulations: run.results.completed,
      workers: this.slots.length,
      roundsPlayed: rounds,
      elapsedMs,
      roundsPerSecond: elapsedMs > 0 ? (rounds * 1000) / elapsedMs : 0,
      provisional: run.config.strategies.map((strategy, index) => {
        const moments = run.profit[index];
        const n = moments?.count ?? 0;
        return {
          strategyId: strategy.id,
          simulations: n,
          meanProfit: moments?.mean() ?? null,
          profitableShare: n > 0 ? (run.profitable[index] ?? 0) / n : null,
        };
      }),
      displayed: [...run.displayed],
      summary: run.summary,
      error: run.error,
    });
  }
}
