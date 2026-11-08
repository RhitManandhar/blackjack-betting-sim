import type { ExperimentResults } from '../../engine/statistics/experimentResults';
import { STRATEGIES } from '../../shared/strategies';
import { profitHistogram, profitHistogramOption } from './charts/liveHistogram';
import { EChart } from './EChart';
import { count, liveStopCounts } from './resultsData';
import { usePrefersDark } from './usePrefersDark';

// Live aggregates (plan 8.2), redrawn from controller snapshots (every 300 ms), never per round:
// stop reasons so far per strategy and the profit histogram of finished simulations.

interface LivePanelProps {
  readonly results: ExperimentResults;
  /** Changes with every snapshot, so the views recompute while the table fills. */
  readonly completed: number;
}

export function LivePanel({ results, completed }: LivePanelProps) {
  const dark = usePrefersDark();
  // The table fills in place, so recompute on every snapshot (cheap: one pass per 300 ms).
  const stops = liveStopCounts(results);
  const option = profitHistogramOption(results, profitHistogram(results), { dark });
  return (
    <section
      aria-label="Live results"
      className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="text-base font-semibold">
        So far ({count.format(completed)} finished simulations)
      </h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <caption className="sr-only">Stop reasons so far per strategy</caption>
          <thead className="text-left text-slate-600 dark:text-slate-400">
            <tr>
              <th scope="col" className="py-1 pr-3 font-normal">
                Strategy
              </th>
              <th scope="col" className="px-2 py-1 text-right font-normal">
                Target reached
              </th>
              <th scope="col" className="px-2 py-1 text-right font-normal">
                Bust
              </th>
              <th scope="col" className="px-2 py-1 text-right font-normal">
                Blocked
              </th>
              <th scope="col" className="px-2 py-1 text-right font-normal">
                Round limit
              </th>
            </tr>
          </thead>
          <tbody>
            {results.shape.strategies.map((strategy, index) => {
              const row = stops[index];
              return (
                <tr key={strategy.id} className="border-t border-slate-200 dark:border-slate-800">
                  <th scope="row" className="py-1 pr-3 text-left font-normal">
                    {STRATEGIES[strategy.id].name}
                  </th>
                  <td className="px-2 py-1 text-right">{count.format(row?.target_reached ?? 0)}</td>
                  <td className="px-2 py-1 text-right">{count.format(row?.bust ?? 0)}</td>
                  <td className="px-2 py-1 text-right">
                    {count.format(row?.blocked_table_max ?? 0)}
                  </td>
                  <td className="px-2 py-1 text-right">{count.format(row?.round_limit ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h3 className="mt-4 text-sm font-medium">Final profit of finished simulations</h3>
      <EChart
        option={option}
        height={260}
        ariaLabel="Histogram of final profit per strategy for finished simulations"
      />
    </section>
  );
}
