import type { StrategySummary } from '../../engine/statistics/summary';
import { STRATEGIES } from '../../shared/strategies';
import { count, money, percent, rate } from './resultsData';
import { strategyColor } from './strategyColors';
import { usePrefersDark } from './usePrefersDark';

// Summary cards (plan 8.3): one per strategy, the headline figures with n beside them.

export function SummaryCards({ strategies }: { readonly strategies: readonly StrategySummary[] }) {
  const dark = usePrefersDark();
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Summary per strategy">
      {strategies.map((summary) => (
        <li
          key={summary.strategyId}
          className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
          style={{ borderTopColor: strategyColor(summary.strategyId, dark), borderTopWidth: 4 }}
        >
          <p className="font-semibold">{STRATEGIES[summary.strategyId].name}</p>
          <dl className="mt-2 space-y-1 tabular-nums">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600 dark:text-slate-400">Mean profit</dt>
              <dd>{money(summary.profitMean)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600 dark:text-slate-400">Median</dt>
              <dd>{money(summary.profitPercentiles.median)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600 dark:text-slate-400">Ended in profit</dt>
              <dd>{percent.format(summary.profitShare)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600 dark:text-slate-400">Return per unit wagered</dt>
              <dd>{rate.format(summary.returnPerUnitWagered)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-600 dark:text-slate-400">Bust rate</dt>
              <dd>{percent.format(summary.bustRate)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            n = {count.format(summary.simulations)} simulations
          </p>
        </li>
      ))}
    </ul>
  );
}
