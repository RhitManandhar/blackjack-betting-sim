import { createDefaultConfig } from '../../shared/defaults';
import type { ExperimentConfig } from '../../shared/schema';
import {
  type RunSnapshot,
  RunController,
  type WorkerFactory,
} from '../experiment/run/RunController';

// Performance benchmark (plan Phase 9, task 1), shared by the Node script (`npm run bench:perf`)
// and the in-browser page (`/?benchmark`). It drives the real RunController with a real worker
// factory on the default configuration, so it measures exactly what a user's run costs: worker
// rounds, messages, merging and the final summary.

export const BENCHMARK_SEED = 20_261_108;
export const FULL_SIMULATIONS = [500, 5_000, 20_000, 50_000] as const;
export const QUICK_SIMULATIONS = [500, 5_000] as const;
export const WORKER_COUNTS = [1, 2, 3, 4] as const;

export function benchmarkConfig(simulations: number): ExperimentConfig {
  return { ...createDefaultConfig('benchmark', BENCHMARK_SEED), simulations };
}

export interface BenchmarkCase {
  readonly simulations: number;
  readonly workers: number;
}

export function benchmarkCases(simulations: readonly number[]): BenchmarkCase[] {
  return simulations.flatMap((count) =>
    WORKER_COUNTS.map((workers) => ({ simulations: count, workers })),
  );
}

/** Platform-specific measurements taken while a case runs (event-loop lag, frame gaps, memory). */
export interface Probe {
  start(): void;
  /** Called on every controller snapshot (about every 300 ms). */
  sample(): void;
  stop(): { readonly mainThreadMaxGapMs: number | null; readonly peakMemoryMb: number | null };
}

export interface BenchmarkRow extends BenchmarkCase {
  readonly status: RunSnapshot['status'];
  readonly elapsedMs: number;
  readonly roundsPlayed: number;
  readonly roundsPerSecond: number;
  /** Worker-to-main-thread messages per second (progress and chunk results). */
  readonly messagesPerSecond: number;
  readonly mainThreadMaxGapMs: number | null;
  readonly peakMemoryMb: number | null;
  /** A fingerprint of the summary; it must be identical for every worker count (spec 8.4). */
  readonly summaryFingerprint: string;
}

function countingFactory(factory: WorkerFactory, onMessage: () => void): WorkerFactory {
  return (handlers) =>
    factory({
      onMessage: (data) => {
        onMessage();
        handlers.onMessage(data);
      },
      onError: (message) => {
        handlers.onError(message);
      },
    });
}

/** Short, stable digest of the summary, so rows can be compared across worker counts. */
export function fingerprint(snapshot: RunSnapshot): string {
  const text = JSON.stringify(snapshot.summary);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export interface RunCaseOptions {
  readonly factory: WorkerFactory;
  readonly now: () => number;
  readonly probe: Probe;
  /** Stop the run after this many milliseconds (for the cancel-then-restart check). */
  readonly cancelAfterMs?: number;
  readonly onSnapshot?: (snapshot: RunSnapshot) => void;
}

export function runCase(
  benchmarkCase: BenchmarkCase,
  options: RunCaseOptions,
): Promise<BenchmarkRow> {
  let messages = 0;
  return new Promise((resolve, reject) => {
    const startedAt = options.now();
    const controller = new RunController({
      createWorker: countingFactory(options.factory, () => {
        messages += 1;
      }),
      now: options.now,
      onSnapshot: (snapshot) => {
        options.probe.sample();
        options.onSnapshot?.(snapshot);
        if (
          options.cancelAfterMs !== undefined &&
          snapshot.status === 'running' &&
          options.now() - startedAt >= options.cancelAfterMs
        ) {
          controller.stop();
          return;
        }
        if (snapshot.status === 'running') return;
        const elapsedMs = options.now() - startedAt;
        const measured = options.probe.stop();
        controller.dispose();
        resolve({
          ...benchmarkCase,
          status: snapshot.status,
          elapsedMs,
          roundsPlayed: snapshot.roundsPlayed,
          roundsPerSecond: elapsedMs > 0 ? (snapshot.roundsPlayed * 1000) / elapsedMs : 0,
          messagesPerSecond: elapsedMs > 0 ? (messages * 1000) / elapsedMs : 0,
          ...measured,
          summaryFingerprint: fingerprint(snapshot),
        });
      },
    });
    try {
      options.probe.start();
      controller.start(benchmarkConfig(benchmarkCase.simulations), benchmarkCase.workers);
    } catch (error) {
      controller.dispose();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

const number = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('en-AU', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

/** Markdown table for docs/performance.md, with the environment in a heading line. */
export function benchmarkMarkdown(environment: string, rows: readonly BenchmarkRow[]): string {
  const header =
    '| Simulations | Workers | Status | Time (s) | Rounds | Rounds/s | Speed-up | Messages/s | Max main-thread gap (ms) | Peak memory (MB) | Summary |\n| ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |';
  const lines = rows.map((row) => {
    const single = rows.find(
      (other) => other.simulations === row.simulations && other.workers === 1,
    );
    const speedUp =
      single === undefined || single.roundsPerSecond === 0
        ? null
        : row.roundsPerSecond / single.roundsPerSecond;
    const sameSummary = rows
      .filter((other) => other.simulations === row.simulations && other.status === 'complete')
      .every((other) => other.summaryFingerprint === row.summaryFingerprint);
    return `| ${number.format(row.simulations)} | ${String(row.workers)} | ${row.status} | ${decimal.format(row.elapsedMs / 1000)} | ${number.format(row.roundsPlayed)} | ${number.format(row.roundsPerSecond)} | ${speedUp === null ? '—' : `${decimal.format(speedUp)}×`} | ${decimal.format(row.messagesPerSecond)} | ${row.mainThreadMaxGapMs === null ? '—' : number.format(row.mainThreadMaxGapMs)} | ${row.peakMemoryMb === null ? '—' : number.format(row.peakMemoryMb)} | ${row.summaryFingerprint}${sameSummary ? '' : ' (differs!)'} |`;
  });
  return `${environment}\n\n${header}\n${lines.join('\n')}\n`;
}
