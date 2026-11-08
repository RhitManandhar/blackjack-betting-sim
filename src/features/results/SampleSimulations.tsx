import { useMemo } from 'react';
import type { ExperimentResults } from '../../engine/statistics/experimentResults';
import { STRATEGIES, type StrategyId } from '../../shared/strategies';
import { STOP_LABELS } from './charts/panelChart';
import { SAMPLE_LIMIT, count, money, sampleRows } from './resultsData';

// Sample-simulation table (plan 8.3): the first finished simulations by id (spec 10.8), for the
// strategy picked in the comparison table or here.

interface SampleSimulationsProps {
  readonly results: ExperimentResults;
  readonly experimentSeed: number;
  readonly strategyId: StrategyId;
  readonly onStrategyChange: (strategyId: StrategyId) => void;
}

export function SampleSimulations({
  results,
  experimentSeed,
  strategyId,
  onStrategyChange,
}: SampleSimulationsProps) {
  const strategyIndex = results.shape.strategies.findIndex((entry) => entry.id === strategyId);
  const rows = useMemo(
    () => sampleRows(results, strategyIndex, experimentSeed),
    [results, strategyIndex, experimentSeed],
  );
  return (
    <section
      id="sample-simulations"
      aria-label="Sample simulations"
      className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Sample simulations</h2>
        <label className="text-sm">
          Strategy{' '}
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
            value={strategyId}
            onChange={(event) => {
              const next = results.shape.strategies.find(
                (entry) => entry.id === event.target.value,
              );
              if (next !== undefined) onStrategyChange(next.id);
            }}
          >
            {results.shape.strategies.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {STRATEGIES[entry.id].name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        The first {count.format(Math.min(SAMPLE_LIMIT, rows.length))} finished simulations by
        number. Any one can be replayed from its seed.
      </p>
      <div className="mt-2 max-h-96 overflow-auto">
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">
            Sample simulations for {STRATEGIES[strategyId].name}
          </caption>
          <thead className="sticky top-0 bg-white text-left text-slate-600 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th scope="col" className="py-1 pr-3 font-normal">
                Simulation
              </th>
              <th scope="col" className="px-2 py-1 font-normal">
                Seed
              </th>
              <th scope="col" className="px-2 py-1 text-right font-normal">
                Rounds
              </th>
              <th scope="col" className="px-2 py-1 text-right font-normal">
                Final profit
              </th>
              <th scope="col" className="px-2 py-1 text-right font-normal">
                Max bet
              </th>
              <th scope="col" className="px-2 py-1 text-right font-normal">
                Max drawdown
              </th>
              <th scope="col" className="px-2 py-1 font-normal">
                Stop reason
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.simulationId}
                className="border-t border-slate-200 dark:border-slate-800"
              >
                <td className="py-1 pr-3">{row.simulationId + 1}</td>
                <td className="px-2 py-1">{row.seed}</td>
                <td className="px-2 py-1 text-right">{count.format(row.roundsPlayed)}</td>
                <td className="px-2 py-1 text-right">{money(row.netProfit)}</td>
                <td className="px-2 py-1 text-right">{money(row.maxWager)}</td>
                <td className="px-2 py-1 text-right">{money(row.maxDrawdown)}</td>
                <td className="px-2 py-1">{STOP_LABELS[row.stopReason]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
