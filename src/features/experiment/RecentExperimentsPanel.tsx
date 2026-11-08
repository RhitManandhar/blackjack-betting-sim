import { formatCentsGrouped } from '../../shared/money';
import type { ExperimentConfig } from '../../shared/schema';
import { STRATEGIES } from '../../shared/strategies';
import type { RecentExperiment } from './recentExperiments';
import { SettingsSection } from './SettingsSection';

// Recent experiment summaries kept in this browser (plan 8.4). Each can be expanded to see its
// headline figures, or its settings reused. Nothing here leaves the browser.

const percent = new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 1 });
const rate = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 4, minimumFractionDigits: 4 });
const dateTime = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' });

const STATUS: Record<RecentExperiment['status'], string> = {
  complete: 'complete',
  cancelled: 'stopped, partial',
  failed: 'failed, partial',
};

interface RecentExperimentsPanelProps {
  readonly entries: readonly RecentExperiment[];
  readonly disabled: boolean;
  readonly onReuse: (config: ExperimentConfig) => void;
  readonly onClear: () => void;
}

export function RecentExperimentsPanel({
  entries,
  disabled,
  onReuse,
  onClear,
}: RecentExperimentsPanelProps) {
  if (entries.length === 0) return null;
  return (
    <SettingsSection title="Recent experiments (this browser)">
      <ul className="space-y-2 text-sm">
        {entries.map((entry) => (
          <li
            key={entry.config.experimentId}
            className="rounded-md border border-slate-200 p-2 dark:border-slate-800"
          >
            <details>
              <summary className="cursor-pointer">
                {dateTime.format(entry.savedAt)} · seed {entry.config.experimentSeed} ·{' '}
                {entry.completedSimulations.toLocaleString('en-AU')} simulations ·{' '}
                {STATUS[entry.status]}
              </summary>
              <table className="mt-2 w-full tabular-nums">
                <caption className="sr-only">Headline results</caption>
                <thead className="text-left text-slate-600 dark:text-slate-400">
                  <tr>
                    <th scope="col" className="py-1 font-normal">
                      Strategy
                    </th>
                    <th scope="col" className="py-1 text-right font-normal">
                      Mean profit
                    </th>
                    <th scope="col" className="py-1 text-right font-normal">
                      Median
                    </th>
                    <th scope="col" className="py-1 text-right font-normal">
                      In profit
                    </th>
                    <th scope="col" className="py-1 text-right font-normal">
                      Return per unit wagered
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entry.strategies.map((strategy) => (
                    <tr key={strategy.strategyId}>
                      <th scope="row" className="py-1 text-left font-normal">
                        {STRATEGIES[strategy.strategyId].name}
                      </th>
                      <td className="py-1 text-right">
                        {formatCentsGrouped(Math.round(strategy.profitMean))}
                      </td>
                      <td className="py-1 text-right">
                        {formatCentsGrouped(Math.round(strategy.profitMedian))}
                      </td>
                      <td className="py-1 text-right">{percent.format(strategy.profitShare)}</td>
                      <td className="py-1 text-right">
                        {rate.format(strategy.returnPerUnitWagered)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onReuse(entry.config);
                }}
                className="mt-2 rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50 dark:border-slate-700"
              >
                Use these settings
              </button>
            </details>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 text-sm text-slate-600 underline dark:text-slate-400"
      >
        Clear recent experiments
      </button>
    </SettingsSection>
  );
}
