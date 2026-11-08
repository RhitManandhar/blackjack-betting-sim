import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { performance } from 'node:perf_hooks';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  type BenchmarkRow,
  FULL_SIMULATIONS,
  QUICK_SIMULATIONS,
  benchmarkCases,
  benchmarkMarkdown,
  runCase,
} from '../../src/features/benchmark/benchmark';
import { nodeProbe, nodeWorkerFactory } from './nodeProbe';

// Performance benchmark (plan Phase 9). Run with `npm run bench:perf` (full grid, about
// 15-20 minutes) or `npm run bench:perf:quick` (500 and 5,000 simulations). Never part of CI. Writes a Markdown table to
// node_modules/.perf/results.md for docs/performance.md.

const quick = process.env.PERF_GRID === 'quick';
const MB = 1024 * 1024;

setFlagsFromString('--expose-gc');
const collectGarbage = runInNewContext('gc') as () => void;

function heapAfterGcMb(): number {
  collectGarbage();
  collectGarbage();
  return process.memoryUsage().heapUsed / MB;
}

const environment = `Node ${process.version}, ${cpus()[0]?.model ?? 'unknown CPU'}, ${String(cpus().length)} logical cores, ${new Date().toISOString().slice(0, 10)}`;
const options = { factory: nodeWorkerFactory, now: () => performance.now(), probe: nodeProbe() };

describe('performance benchmark', () => {
  it('runs the simulation × worker grid with identical summaries for every worker count', async () => {
    const rows: BenchmarkRow[] = [];
    for (const benchmarkCase of benchmarkCases(quick ? QUICK_SIMULATIONS : FULL_SIMULATIONS)) {
      const row = await runCase(benchmarkCase, options);
      rows.push(row);
      console.log(
        `${String(row.simulations)} simulations, ${String(row.workers)} workers: ${(row.elapsedMs / 1000).toFixed(1)} s, ${Math.round(row.roundsPerSecond).toLocaleString('en-AU')} rounds/s`,
      );
    }
    const markdown = benchmarkMarkdown(`**${environment}**`, rows);
    mkdirSync('node_modules/.perf', { recursive: true });
    writeFileSync('node_modules/.perf/results.md', markdown);
    console.log(`\n${markdown}`);
    for (const row of rows) {
      expect(row.status).toBe('complete');
      const single = rows.find(
        (other) => other.simulations === row.simulations && other.workers === 1,
      );
      expect(row.summaryFingerprint).toBe(single?.summaryFingerprint);
    }
  });

  it('returns memory to its level after repeated runs, including a cancelled one', async () => {
    const heaps: number[] = [];
    const steps: string[] = [];
    for (let run = 0; run < 6; run += 1) {
      const cancel = run === 2;
      const row = await runCase(
        { simulations: 5_000, workers: 4 },
        cancel ? { ...options, cancelAfterMs: 1_500 } : options,
      );
      expect(row.status).toBe(cancel ? 'cancelled' : 'complete');
      // Let the cancel backstop and worker shutdown finish before measuring.
      await new Promise((resolve) => setTimeout(resolve, 500));
      heaps.push(heapAfterGcMb());
      steps.push(
        `run ${String(run + 1)}${cancel ? ' (cancelled)' : ''}: ${heaps.at(-1)?.toFixed(1) ?? ''} MB`,
      );
    }
    const report = `Heap after GC, 5,000 simulations × 4 workers, 6 runs: ${steps.join('; ')}`;
    writeFileSync('node_modules/.perf/memory.md', `${report}\n`);
    console.log(report);
    const settled = heaps.slice(1);
    expect(Math.max(...settled) - Math.min(...settled)).toBeLessThan(20);
  });
});
