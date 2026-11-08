import { describe, expect, it } from 'vitest';
import { experimentConfigSchema } from '../../shared/schema';
import { createWorkerMessageHandler } from '../../workers/workerMessageHandler';
import type { WorkerFactory } from '../experiment/run/RunController';
import {
  type BenchmarkRow,
  type Probe,
  benchmarkCases,
  benchmarkConfig,
  benchmarkMarkdown,
  runCase,
} from './benchmark';

// In-process workers that run the real message handler after an async hop, so only the thread
// boundary is faked.
const inProcessFactory: WorkerFactory = (handlers) => {
  let alive = true;
  const handle = createWorkerMessageHandler(
    (message) => {
      if (alive) handlers.onMessage(structuredClone(message));
    },
    () => 0,
  );
  return {
    send: (message) => {
      const copy = structuredClone(message);
      setTimeout(() => {
        if (alive) handle(copy);
      }, 0);
    },
    terminate: () => {
      alive = false;
    },
  };
};

function countingProbe() {
  const calls = { start: 0, sample: 0, stop: 0 };
  const probe: Probe = {
    start: () => {
      calls.start += 1;
    },
    sample: () => {
      calls.sample += 1;
    },
    stop: () => {
      calls.stop += 1;
      return { mainThreadMaxGapMs: 12, peakMemoryMb: 34 };
    },
  };
  return { probe, calls };
}

let clock = 0;
const now = () => (clock += 5);

describe('benchmark driver (plan Phase 9)', () => {
  it('uses the default configuration with only the simulation count changed', () => {
    const config = benchmarkConfig(500);
    expect(config.simulations).toBe(500);
    expect(config.strategies).toHaveLength(5);
    expect(config.roundLimit).toBe(1_000);
    expect(experimentConfigSchema.safeParse(benchmarkConfig(1)).success).toBe(true);
  });

  it('crosses every simulation count with 1 to 4 workers', () => {
    expect(benchmarkCases([500, 5_000])).toHaveLength(8);
    expect(benchmarkCases([500]).map((entry) => entry.workers)).toEqual([1, 2, 3, 4]);
  });

  it('runs a case to completion with identical summaries for 1 and 3 workers', async () => {
    const one = countingProbe();
    const first = await runCase(
      { simulations: 12, workers: 1 },
      { factory: inProcessFactory, now, probe: one.probe },
    );
    const third = await runCase(
      { simulations: 12, workers: 3 },
      { factory: inProcessFactory, now, probe: countingProbe().probe },
    );
    expect(first.status).toBe('complete');
    expect(first.coldStartMs).toBeGreaterThan(0);
    expect(first.roundsPlayed).toBeGreaterThan(0);
    expect(first.roundsPerSecond).toBeGreaterThan(0);
    expect(first.messagesPerSecond).toBeGreaterThan(0);
    expect(first.mainThreadMaxGapMs).toBe(12);
    expect(first.peakMemoryMb).toBe(34);
    expect(third.summaryFingerprint).toBe(first.summaryFingerprint);
    expect(one.calls.start).toBe(1);
    expect(one.calls.stop).toBe(1);
    expect(one.calls.sample).toBeGreaterThan(0);
  });

  it('can cancel a case partway', async () => {
    const row = await runCase(
      { simulations: 2_000, workers: 2 },
      { factory: inProcessFactory, now, probe: countingProbe().probe, cancelAfterMs: 1 },
    );
    expect(row.status).toBe('cancelled');
  });

  it('formats rows as a Markdown table with speed-up and a summary check', () => {
    const row = (
      workers: number,
      roundsPerSecond: number,
      summaryFingerprint = 'abc',
    ): BenchmarkRow => ({
      simulations: 500,
      workers,
      status: 'complete',
      coldStartMs: 1_400,
      elapsedMs: 2_000,
      roundsPlayed: 1_000_000,
      roundsPerSecond,
      messagesPerSecond: 7.25,
      mainThreadMaxGapMs: null,
      peakMemoryMb: 40,
      summaryFingerprint,
    });
    const markdown = benchmarkMarkdown('Env', [
      row(1, 500_000),
      row(2, 1_000_000),
      row(3, 1_400_000, 'xyz'),
    ]);
    expect(markdown).toContain(
      '| 500 | 2 | complete | 1.4 | 2.0 | 1,000,000 | 1,000,000 | 2.0× | 7.3 | — | 40 | abc',
    );
    expect(markdown).toContain('xyz (differs!)');
  });
});
