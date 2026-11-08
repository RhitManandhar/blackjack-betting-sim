import { useRef, useState } from 'react';
import { browserWorkerFactory } from '../experiment/run/browserWorker';
import {
  type BenchmarkRow,
  FULL_SIMULATIONS,
  QUICK_SIMULATIONS,
  benchmarkCases,
  benchmarkMarkdown,
  runCase,
} from './benchmark';
import { browserEnvironment, browserProbe, collectGarbage, currentHeapMb } from './browserProbe';

// In-browser performance check (plan Phase 9, tasks 1, 2 and 6), opened with /?benchmark. It
// runs the default configuration through the real worker pool for each simulation count and
// worker count, then offers the results as Markdown for docs/performance.md.

const BUTTON =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-700';

type Grid = 'quick' | 'full';

const GRID_TEXT: Record<Grid, string> = {
  quick: 'Quick: 500 and 5,000 simulations (about 1–3 minutes)',
  full: 'Full: 500, 5,000, 20,000 and 50,000 simulations (about 15–60 minutes)',
};

export function BenchmarkPage() {
  const [grid, setGrid] = useState<Grid>('quick');
  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [memory, setMemory] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const stopRef = useRef(false);
  // Read through a function: the flag changes while a run is awaited.
  const stopRequested = () => stopRef.current;
  const environment = browserEnvironment();
  const options = () => ({
    factory: browserWorkerFactory,
    now: () => performance.now(),
    probe: browserProbe(),
  });

  const runGrid = async () => {
    setBusy(true);
    setRows([]);
    setCopied(false);
    stopRef.current = false;
    const cases = benchmarkCases(grid === 'quick' ? QUICK_SIMULATIONS : FULL_SIMULATIONS);
    const done: BenchmarkRow[] = [];
    try {
      for (const [index, benchmarkCase] of cases.entries()) {
        if (stopRequested()) break;
        setStatus(
          `Case ${String(index + 1)} of ${String(cases.length)}: ${benchmarkCase.simulations.toLocaleString('en-AU')} simulations, ${String(benchmarkCase.workers)} workers…`,
        );
        done.push(await runCase(benchmarkCase, options()));
        setRows([...done]);
      }
      setStatus(stopRequested() ? 'Stopped after the current case.' : 'Finished.');
    } catch (error) {
      setStatus(`Benchmark failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const runMemoryCheck = async () => {
    setBusy(true);
    setMemory(null);
    const steps: string[] = [];
    let forcedGc = false;
    try {
      for (let run = 0; run < 6; run += 1) {
        const cancel = run === 2;
        setStatus(
          `Memory check: run ${String(run + 1)} of 6${cancel ? ' (cancelled partway)' : ''}…`,
        );
        await runCase(
          { simulations: 5_000, workers: 4 },
          cancel ? { ...options(), cancelAfterMs: 1_500 } : options(),
        );
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        // Chrome started with --js-flags=--expose-gc offers gc(); then readings are comparable.
        forcedGc = collectGarbage() || forcedGc;
        const heap = currentHeapMb();
        steps.push(
          `run ${String(run + 1)}${cancel ? ' (cancelled)' : ''}: ${heap === null ? 'not reported' : `${heap.toFixed(1)} MB`}`,
        );
      }
      setMemory(
        `Heap after each of 6 runs (5,000 simulations × 4 workers, ${forcedGc ? 'forced GC' : 'no forced GC'}): ${steps.join('; ')}`,
      );
      setStatus('Memory check finished.');
    } catch (error) {
      setStatus(`Memory check failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const markdown = `${benchmarkMarkdown(`**${environment}**`, rows)}${memory === null ? '' : `\n${memory}\n`}`;

  return (
    <section aria-labelledby="benchmark-title" className="space-y-4">
      <div>
        <h2 id="benchmark-title" className="text-lg font-semibold">
          Performance check
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Runs the default experiment (5 strategies, 1,000 rounds, 6 decks) with 1 to 4 workers and
          records the speed, how responsive the page stayed and the memory used. Keep this tab in
          front while it runs: browsers slow down hidden tabs. Plug a laptop in for the full grid.
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{environment}</p>
      </div>

      <fieldset className="space-y-1 text-sm" disabled={busy}>
        <legend className="font-medium">Grid</legend>
        {(['quick', 'full'] as const).map((value) => (
          <label key={value} className="flex items-center gap-2">
            <input
              type="radio"
              name="grid"
              value={value}
              checked={grid === value}
              onChange={() => {
                setGrid(value);
              }}
            />
            {GRID_TEXT[value]}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <button type="button" className={BUTTON} disabled={busy} onClick={() => void runGrid()}>
          Run benchmark
        </button>
        <button
          type="button"
          className={BUTTON}
          disabled={busy}
          onClick={() => void runMemoryCheck()}
        >
          Run memory check
        </button>
        {busy && (
          <button
            type="button"
            className={BUTTON}
            onClick={() => {
              stopRef.current = true;
            }}
          >
            Stop after this case
          </button>
        )}
        <button
          type="button"
          className={BUTTON}
          disabled={rows.length === 0 && memory === null}
          onClick={() => {
            void navigator.clipboard.writeText(markdown).then(() => {
              setCopied(true);
            });
          }}
        >
          {copied ? 'Copied' : 'Copy results (Markdown)'}
        </button>
      </div>
      <p aria-live="polite" className="text-sm">
        {status}
      </p>

      {(rows.length > 0 || memory !== null) && (
        <pre className="overflow-x-auto rounded-md border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
          {markdown}
        </pre>
      )}
      <p className="text-sm">
        <a className="text-teal-700 underline dark:text-teal-400" href="./">
          Back to the simulator
        </a>
      </p>
    </section>
  );
}
