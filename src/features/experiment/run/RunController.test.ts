import { describe, expect, it } from 'vitest';
import { testConfig } from '../../../engine/simulation/__tests__/scripted';
import type { ExperimentConfig } from '../../../shared/schema';
import { STRATEGIES, STRATEGY_IDS } from '../../../shared/strategies';
import { ChunkRunner } from '../../../workers/chunkRunner';
import { toWorkerMessageSchema } from '../../../workers/messages';
import {
  CANCEL_BACKSTOP_MS,
  type PoolWorker,
  RunController,
  type RunSnapshot,
  type WorkerFactory,
} from './RunController';

// The controller is tested with in-process fake workers. They run the real ChunkRunner after a
// short async delay and pass every message through the real Zod contract, so only the thread
// boundary is faked. Real-browser checks are in the Phase 6 manual checklist.

interface FakeOptions {
  delayMs?: number;
  /** Fail this chunk's first `times` attempts (counted across workers). */
  failChunk?: { chunkId: number; times: number; how: 'crash' | 'error-message' | 'garbage' };
  /** These chunks never answer, like a worker stuck in a long computation. */
  hangChunks?: readonly number[];
  /** Reported compute time for a chunk; defaults to 0 (untimed). */
  computeMs?: (simulationCount: number, chunkId: number) => number;
}

function fakeWorkers(options: FakeOptions = {}) {
  let created = 0;
  let terminated = 0;
  let failuresLeft = options.failChunk?.times ?? 0;
  const chunkSizes: number[] = [];
  const factory: WorkerFactory = (handlers) => {
    created += 1;
    const runner = new ChunkRunner();
    let alive = true;
    const worker: PoolWorker = {
      send(raw) {
        if (!alive) return;
        const message = toWorkerMessageSchema.parse(structuredClone(raw));
        if (message.type === 'cancel') {
          runner.forget(message.runId);
          return;
        }
        if (options.hangChunks?.includes(message.chunkId)) return;
        chunkSizes.push(message.simulationCount);
        setTimeout(() => {
          if (!alive) return;
          const failure = options.failChunk;
          if (failure?.chunkId === message.chunkId && failuresLeft > 0) {
            failuresLeft -= 1;
            if (failure.how === 'crash') handlers.onError('worker crashed');
            else if (failure.how === 'garbage') handlers.onMessage({ type: 'nonsense' });
            else {
              handlers.onMessage({
                type: 'error',
                runId: message.runId,
                chunkId: message.chunkId,
                message: 'simulated failure',
              });
            }
            return;
          }
          const outcome = runner.run(
            message.runId,
            message.config,
            message.firstSimulation,
            message.simulationCount,
            () => undefined,
            () => 0,
          );
          handlers.onMessage(
            structuredClone({
              type: 'chunk-result',
              runId: message.runId,
              chunkId: message.chunkId,
              simulations: outcome.simulations,
              roundsPlayed: outcome.roundsPlayed,
              computeMs: options.computeMs?.(message.simulationCount, message.chunkId) ?? 0,
            }),
          );
        }, options.delayMs ?? 0);
      },
      terminate() {
        if (alive) terminated += 1;
        alive = false;
      },
    };
    return worker;
  };
  return {
    factory,
    stats: () => ({ created, terminated }),
    chunkSizes,
  };
}

interface Harness {
  controller: RunController;
  snapshots: RunSnapshot[];
  finished: () => Promise<RunSnapshot>;
}

function harness(factory: WorkerFactory, chunkSize: number | null): Harness {
  const snapshots: RunSnapshot[] = [];
  const waiters: ((snapshot: RunSnapshot) => void)[] = [];
  const controller = new RunController({
    createWorker: factory,
    ...(chunkSize === null ? {} : { chunkSize: () => chunkSize }),
    onSnapshot: (snapshot) => {
      snapshots.push(snapshot);
      if (snapshot.status !== 'running')
        waiters.splice(0).forEach((resolve) => {
          resolve(snapshot);
        });
    },
  });
  return {
    controller,
    snapshots,
    finished: () => new Promise((resolve) => waiters.push(resolve)),
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const config: ExperimentConfig = testConfig({
  simulations: 30,
  roundLimit: 200,
  displayedSimulations: 4,
  strategies: STRATEGY_IDS.map((id) => ({ id, version: STRATEGIES[id].version })),
  targetMode: 'compare_all',
  checkpoints: [50, 100, 200],
});

async function completeRun(workers: number, chunkSize: number): Promise<RunSnapshot> {
  const { controller, finished } = harness(fakeWorkers().factory, chunkSize);
  const done = finished();
  controller.start(config, workers);
  const snapshot = await done;
  controller.dispose();
  return snapshot;
}

describe('RunController: determinism across worker counts and chunk sizes (spec 8.4)', () => {
  it('gives identical summaries for 1, 2 and 4 workers and different chunk sizes', async () => {
    const reference = await completeRun(1, 30);
    expect(reference.status).toBe('complete');
    expect(reference.completedSimulations).toBe(30);
    for (const [workers, chunkSize] of [
      [1, 1],
      [2, 4],
      [4, 7],
      [4, 1],
    ] as const) {
      const snapshot = await completeRun(workers, chunkSize);
      expect(snapshot.status).toBe('complete');
      expect(snapshot.summary).toEqual(reference.summary);
      expect(snapshot.displayed).toEqual(reference.displayed);
    }
  });

  it('sizes chunks from measured speed and still gives identical results', async () => {
    const reference = await completeRun(1, 30);
    // Speed that changes from chunk to chunk, as on a real device under load.
    const workers = fakeWorkers({
      computeMs: (simulations, chunkId) => simulations * (chunkId % 3 === 0 ? 40 : 9),
    });
    const { controller, finished } = harness(workers.factory, null);
    const done = finished();
    controller.start(config, 3);
    const snapshot = await done;
    controller.dispose();
    expect(snapshot.status).toBe('complete');
    expect(snapshot.summary).toEqual(reference.summary);
    expect(snapshot.displayed).toEqual(reference.displayed);
    expect(new Set(workers.chunkSizes).size).toBeGreaterThan(1);
    expect(workers.chunkSizes.reduce((sum, size) => sum + size, 0)).toBe(config.simulations);
    expect(snapshot.measuredRoundMicroseconds).toBeGreaterThan(0);
  });

  it('fills every displayed simulation with curves for every strategy', async () => {
    const snapshot = await completeRun(2, 3);
    expect(snapshot.displayed).toHaveLength(4);
    for (const results of snapshot.displayed) {
      expect(results).toHaveLength(5);
      for (const result of results ?? []) expect(result.curve?.rounds[0]).toBe(0);
    }
  });
});

describe('RunController: Stop All', () => {
  it('cancels at once, keeps only whole finished chunks, and a new run works afterwards', async () => {
    const workers = fakeWorkers({ delayMs: 15 });
    const { controller, finished } = harness(workers.factory, 1);
    const cancelled = finished();
    controller.start(config, 2);
    await sleep(50);
    controller.stop();
    const snapshot = await cancelled;

    expect(snapshot.status).toBe('cancelled');
    expect(snapshot.completedSimulations).toBeGreaterThan(0);
    expect(snapshot.completedSimulations).toBeLessThan(30);
    expect(snapshot.summary?.completedSimulations).toBe(snapshot.completedSimulations);
    expect(controller.isRunning).toBe(false);

    // Chunks that finish after Stop All are discarded: the count never changes again.
    await sleep(100);
    const reference = await completeRun(1, 30);
    const again = finished();
    controller.start(config, 2);
    const second = await again;
    expect(second.status).toBe('complete');
    expect(second.summary).toEqual(reference.summary);
    expect(snapshot.completedSimulations).toBeLessThan(second.completedSimulations);
    controller.dispose();
  });

  it('terminates and replaces a worker still busy after the backstop delay', async () => {
    const workers = fakeWorkers({ hangChunks: [1] });
    const { controller, finished } = harness(workers.factory, 10);
    const cancelled = finished();
    controller.start(config, 2);
    await sleep(20);
    controller.stop();
    expect((await cancelled).status).toBe('cancelled');
    const before = workers.stats();
    await sleep(CANCEL_BACKSTOP_MS + 50);
    const after = workers.stats();
    expect(after.terminated).toBe(before.terminated + 1);
    expect(after.created).toBe(before.created + 1);
    controller.dispose();
  });

  it('is harmless when nothing is running', () => {
    const { controller } = harness(fakeWorkers().factory, 5);
    expect(() => {
      controller.stop();
    }).not.toThrow();
    controller.dispose();
  });
});

describe('RunController: worker failures', () => {
  it.each(['crash', 'error-message', 'garbage'] as const)(
    'retries a chunk after a %s without double counting',
    async (how) => {
      const reference = await completeRun(1, 30);
      const workers = fakeWorkers({ failChunk: { chunkId: 2, times: 2, how } });
      const { controller, finished } = harness(workers.factory, 5);
      const done = finished();
      controller.start(config, 2);
      const snapshot = await done;
      expect(snapshot.status).toBe('complete');
      expect(snapshot.completedSimulations).toBe(30);
      expect(snapshot.summary).toEqual(reference.summary);
      expect(workers.stats().created).toBe(2 + 2); // each failure replaced its worker
      controller.dispose();
    },
  );

  it('fails the run after too many retries, keeping finished simulations as partial', async () => {
    const workers = fakeWorkers({ failChunk: { chunkId: 1, times: 10, how: 'crash' } });
    const { controller, finished } = harness(workers.factory, 5);
    const done = finished();
    controller.start(config, 1);
    const snapshot = await done;
    expect(snapshot.status).toBe('failed');
    expect(snapshot.error).toMatch(/Simulations 6-10 failed 3 times/);
    expect(snapshot.completedSimulations).toBe(5);
    expect(snapshot.summary?.completedSimulations).toBe(5);
    controller.dispose();
  });

  it('refuses to start a second run while one is running', () => {
    const { controller } = harness(fakeWorkers({ delayMs: 50 }).factory, 5);
    controller.start(config, 1);
    expect(() => controller.start(config, 1)).toThrow(/already in progress/);
    controller.dispose();
  });
});
