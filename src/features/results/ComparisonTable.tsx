import { useState } from 'react';
import type { StrategySummary } from '../../engine/statistics/summary';
import { STRATEGIES, type StrategyId } from '../../shared/strategies';
import { count, money, percent, rate } from './resultsData';

// Sortable comparison table (plan 8.3). Every average and rate shows its interval; return per
// unit wagered sits beside currency profit, because profit mostly follows how much is wagered.

type SortKey =
  | 'mean'
  | 'median'
  | 'p5'
  | 'p95'
  | 'profitShare'
  | 'rpuw'
  | 'bustRate'
  | 'maxDrawdown'
  | 'averageWager';

const COLUMNS: readonly { key: SortKey; label: string; value: (s: StrategySummary) => number }[] = [
  { key: 'mean', label: 'Mean profit', value: (s) => s.profitMean },
  { key: 'median', label: 'Median', value: (s) => s.profitPercentiles.median },
  { key: 'p5', label: '5th pct', value: (s) => s.profitPercentiles.p5 },
  { key: 'p95', label: '95th pct', value: (s) => s.profitPercentiles.p95 },
  { key: 'profitShare', label: 'Ended in profit', value: (s) => s.profitShare },
  { key: 'rpuw', label: 'Return per unit wagered', value: (s) => s.returnPerUnitWagered },
  { key: 'bustRate', label: 'Bust rate', value: (s) => s.bustRate },
  { key: 'maxDrawdown', label: 'Avg max drawdown', value: (s) => s.averageMaxDrawdown },
  { key: 'averageWager', label: 'Avg bet', value: (s) => s.averageWager },
];

function cell(key: SortKey, s: StrategySummary) {
  const small = 'block text-xs text-slate-500 dark:text-slate-400';
  switch (key) {
    case 'mean':
      return (
        <>
          {money(s.profitMean)}
          {s.profitMeanInterval !== null && (
            <span className={small}>
              {money(s.profitMeanInterval.low)} to {money(s.profitMeanInterval.high)}
            </span>
          )}
        </>
      );
    case 'median':
      return money(s.profitPercentiles.median);
    case 'p5':
      return money(s.profitPercentiles.p5);
    case 'p95':
      return money(s.profitPercentiles.p95);
    case 'profitShare':
      return (
        <>
          {percent.format(s.profitShare)}
          <span className={small}>
            {percent.format(s.profitShareInterval.low)} to{' '}
            {percent.format(s.profitShareInterval.high)}
          </span>
        </>
      );
    case 'rpuw':
      return (
        <>
          {rate.format(s.returnPerUnitWagered)}
          {s.returnPerUnitWageredInterval !== null && (
            <span className={small}>
              {rate.format(s.returnPerUnitWageredInterval.low)} to{' '}
              {rate.format(s.returnPerUnitWageredInterval.high)}
            </span>
          )}
        </>
      );
    case 'bustRate':
      return percent.format(s.bustRate);
    case 'maxDrawdown':
      return money(s.averageMaxDrawdown);
    case 'averageWager':
      return money(s.averageWager);
  }
}

interface ComparisonTableProps {
  readonly strategies: readonly StrategySummary[];
  readonly onShowSamples: (strategyId: StrategyId) => void;
}

export function ComparisonTable({ strategies, onShowSamples }: ComparisonTableProps) {
  const [sort, setSort] = useState<{ key: SortKey | null; descending: boolean }>({
    key: null,
    descending: true,
  });
  const column = COLUMNS.find((entry) => entry.key === sort.key);
  const rows =
    column === undefined
      ? strategies
      : [...strategies].sort((a, b) =>
          sort.descending ? column.value(b) - column.value(a) : column.value(a) - column.value(b),
        );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <caption className="sr-only">
          Per-strategy results under this configuration, with 95% intervals. Select a column heading
          to sort.
        </caption>
        <thead className="text-left text-slate-600 dark:text-slate-400">
          <tr>
            <th scope="col" className="py-1 pr-3 font-normal">
              Strategy
            </th>
            <th scope="col" className="px-2 py-1 text-right font-normal">
              Simulations
            </th>
            {COLUMNS.map((entry) => (
              <th
                key={entry.key}
                scope="col"
                className="px-2 py-1 text-right font-normal"
                aria-sort={
                  sort.key === entry.key ? (sort.descending ? 'descending' : 'ascending') : 'none'
                }
              >
                <button
                  type="button"
                  className="underline decoration-dotted underline-offset-2"
                  onClick={() => {
                    setSort({
                      key: entry.key,
                      descending: sort.key === entry.key ? !sort.descending : true,
                    });
                  }}
                >
                  {entry.label}
                  {sort.key === entry.key && (sort.descending ? ' ▼' : ' ▲')}
                </button>
              </th>
            ))}
            <th scope="col" className="px-2 py-1 font-normal">
              <span className="sr-only">Samples</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((summary) => (
            <tr
              key={summary.strategyId}
              className="border-t border-slate-200 align-top dark:border-slate-800"
            >
              <th scope="row" className="py-2 pr-3 text-left font-medium">
                {STRATEGIES[summary.strategyId].name}
                <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                  {summary.strategyVersion}
                </span>
              </th>
              <td className="px-2 py-2 text-right">{count.format(summary.simulations)}</td>
              {COLUMNS.map((entry) => (
                <td key={entry.key} className="px-2 py-2 text-right">
                  {cell(entry.key, summary)}
                </td>
              ))}
              <td className="px-2 py-2">
                <button
                  type="button"
                  className="text-teal-700 underline dark:text-teal-400"
                  onClick={() => {
                    onShowSamples(summary.strategyId);
                  }}
                >
                  Simulations
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
