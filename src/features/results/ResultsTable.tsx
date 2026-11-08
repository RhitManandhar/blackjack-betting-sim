import type { ExperimentSummary, StrategySummary } from '../../engine/statistics/summary';
import { formatCentsGrouped } from '../../shared/money';
import { STRATEGIES } from '../../shared/strategies';
import type { RunStatus } from '../experiment/run/RunController';

// Minimal Phase 6 results table. Every average and rate shows its simulation count and interval
// (CLAUDE.md, Statistics). Return per unit wagered sits beside currency profit, because profit
// in currency mostly follows how much a system wagers. No ranking yet (Phase 8).

const percent = new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 1 });
const rate = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 4, minimumFractionDigits: 4 });

/** Statistics may be fractional; they are rounded to whole cents only here, for display. */
const money = (cents: number) => formatCentsGrouped(Math.round(cents));

function Row({ summary }: { readonly summary: StrategySummary }) {
  const interval = summary.profitMeanInterval;
  const rpuw = summary.returnPerUnitWageredInterval;
  const { statusCounts } = summary;
  return (
    <tr className="border-t border-slate-200 dark:border-slate-800">
      <th scope="row" className="py-2 pr-3 text-left font-medium">
        {STRATEGIES[summary.strategyId].name}
        <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
          {summary.strategyVersion}
        </span>
      </th>
      <td className="px-3 py-2 text-right">{summary.simulations.toLocaleString('en-AU')}</td>
      <td className="px-3 py-2 text-right">
        {money(summary.profitMean)}
        {interval !== null && (
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            95% CI {money(interval.low)} to {money(interval.high)}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right">{money(summary.profitPercentiles.median)}</td>
      <td className="px-3 py-2 text-right">
        {percent.format(summary.profitShare)}
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          95% CI {percent.format(summary.profitShareInterval.low)} to{' '}
          {percent.format(summary.profitShareInterval.high)}
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        {rate.format(summary.returnPerUnitWagered)}
        {rpuw !== null && (
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            95% CI {rate.format(rpuw.low)} to {rate.format(rpuw.high)}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right text-xs">
        Target {statusCounts.target_reached} · Bust {statusCounts.bust} · Blocked{' '}
        {statusCounts.blocked_table_max} · Limit {statusCounts.round_limit}
      </td>
    </tr>
  );
}

interface ResultsTableProps {
  readonly summary: ExperimentSummary;
  readonly status: RunStatus;
  readonly totalSimulations: number;
}

export function ResultsTable({ summary, status, totalSimulations }: ResultsTableProps) {
  const partial = status !== 'complete';
  const smallSample = summary.strategies.some((strategy) => strategy.smallSample);
  return (
    <section
      aria-label="Results"
      className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="text-base font-semibold">Results{partial && ' (partial)'}</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {summary.completedSimulations.toLocaleString('en-AU')} of{' '}
        {totalSimulations.toLocaleString('en-AU')} simulations
        {partial
          ? ' finished before the run stopped. Figures cover finished simulations only.'
          : '.'}{' '}
        No betting system changes the house edge; compare return per unit wagered, not only profit.
      </p>
      {smallSample && (
        <p role="note" className="mt-2 text-sm text-amber-800 dark:text-amber-300">
          Fewer than 100 simulations: treat these figures as rough.
        </p>
      )}
      {summary.completedSimulations === 0 ? (
        <p className="mt-3 text-sm">No simulation finished, so there is nothing to show.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">Per-strategy results under this configuration</caption>
            <thead className="text-left text-slate-600 dark:text-slate-400">
              <tr>
                <th scope="col" className="py-1 pr-3 font-normal">
                  Strategy
                </th>
                <th scope="col" className="px-3 py-1 text-right font-normal">
                  Simulations
                </th>
                <th scope="col" className="px-3 py-1 text-right font-normal">
                  Mean profit
                </th>
                <th scope="col" className="px-3 py-1 text-right font-normal">
                  Median profit
                </th>
                <th scope="col" className="px-3 py-1 text-right font-normal">
                  Ended in profit
                </th>
                <th scope="col" className="px-3 py-1 text-right font-normal">
                  Return per unit wagered
                </th>
                <th scope="col" className="px-3 py-1 text-right font-normal">
                  Stop reasons
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.strategies.map((strategy) => (
                <Row key={strategy.strategyId} summary={strategy} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
