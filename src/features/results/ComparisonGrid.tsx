import { useEffect, useRef, useState } from 'react';
import type { StrategySimulationResult } from '../../engine/simulation/runSimulation';
import { STRATEGIES } from '../../shared/strategies';
import { STOP_LABELS } from './charts/panelChart';
import { SimulationPanel } from './SimulationPanel';
import { strategyColor } from './strategyColors';
import { usePrefersDark } from './usePrefersDark';

// Per-simulation comparison grid (spec 10.9, plan 8.2): simulations 1..n, one panel each,
// overlaying every chosen strategy's bankroll on the same cards. Click a panel to enlarge it
// with tooltips (round, bankroll, bet), legend toggles and zoom.

interface ComparisonGridProps {
  readonly displayed: readonly (readonly StrategySimulationResult[] | null)[];
  readonly startingBankroll: number;
  readonly targetBankroll: number | null;
  readonly runEnded: boolean;
}

export function ComparisonGrid({
  displayed,
  startingBankroll,
  targetBankroll,
  runEnded,
}: ComparisonGridProps) {
  const [enlarged, setEnlarged] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dark = usePrefersDark();
  const strategies = displayed.find((entry) => entry !== null) ?? null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (enlarged !== null && !dialog.open) dialog.showModal();
    if (enlarged === null && dialog.open) dialog.close();
  }, [enlarged]);

  const enlargedResults = enlarged === null ? null : (displayed[enlarged] ?? null);

  return (
    <section
      aria-label="Per-simulation comparison"
      className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="text-base font-semibold">Simulations side by side</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Each panel is one simulation: every strategy played the same cards. Lines end where a
        strategy stopped. Click a panel to enlarge it.
      </p>
      {strategies !== null && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Legend">
          {strategies.map((result) => (
            <li key={result.strategyId} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-4"
                style={{ background: strategyColor(result.strategyId, dark) }}
              />
              {STRATEGIES[result.strategyId].name}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {displayed.map((results, index) => (
          <button
            key={index}
            type="button"
            disabled={results === null}
            onClick={() => {
              setEnlarged(index);
            }}
            aria-label={`Enlarge simulation ${String(index + 1)}`}
            className="rounded-md border border-slate-200 p-2 text-left hover:border-teal-600 focus-visible:outline-2 focus-visible:outline-teal-600 disabled:cursor-default disabled:hover:border-slate-200 dark:border-slate-800"
          >
            <span className="block text-xs font-medium">
              Simulation {index + 1}
              {results?.[0] !== undefined && (
                <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">
                  seed {results[0].simulationSeed}
                </span>
              )}
            </span>
            <SimulationPanel
              simulationNumber={index + 1}
              results={results}
              startingBankroll={startingBankroll}
              targetBankroll={targetBankroll}
              runEnded={runEnded}
              compact
            />
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => {
          setEnlarged(null);
        }}
        className="m-auto w-[min(64rem,calc(100vw-2rem))] rounded-lg bg-white p-4 text-slate-900 backdrop:bg-slate-900/60 dark:bg-slate-900 dark:text-slate-100"
      >
        {enlarged !== null && enlargedResults !== null && (
          <>
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-base font-semibold">
                Simulation {enlarged + 1}
                <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                  seed {enlargedResults[0]?.simulationSeed}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEnlarged(null);
                }}
                className="rounded-md border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
              >
                Close
              </button>
            </div>
            <SimulationPanel
              simulationNumber={enlarged + 1}
              results={enlargedResults}
              startingBankroll={startingBankroll}
              targetBankroll={targetBankroll}
              runEnded={runEnded}
              compact={false}
            />
            <ul className="mt-2 text-sm">
              {enlargedResults.map((result) => (
                <li key={result.strategyId}>
                  {STRATEGIES[result.strategyId].name}: {STOP_LABELS[result.stopReason]} after{' '}
                  {result.roundsPlayed.toLocaleString('en-AU')} rounds
                </li>
              ))}
            </ul>
          </>
        )}
      </dialog>
    </section>
  );
}
