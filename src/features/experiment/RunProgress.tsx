import { formatCentsGrouped } from '../../shared/money';
import { STRATEGIES } from '../../shared/strategies';
import type { RunSnapshot } from './run/RunController';

// Live progress (plan 8.2), redrawn from controller snapshots every 250-500 ms, never per round.

const whole = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('en-AU', { style: 'percent', maximumFractionDigits: 1 });

const STATUS_TEXT: Record<RunSnapshot['status'], string> = {
  running: 'Running',
  complete: 'Complete',
  cancelled: 'Stopped (partial results)',
  failed: 'Failed (partial results)',
};

function formatElapsed(ms: number): string {
  const seconds = ms / 1000;
  return seconds < 60
    ? `${seconds.toFixed(1)} s`
    : `${String(Math.floor(seconds / 60))} min ${String(Math.round(seconds % 60))} s`;
}

interface RunProgressProps {
  readonly snapshot: RunSnapshot;
  readonly onStop: () => void;
}

export function RunProgress({ snapshot, onStop }: RunProgressProps) {
  const running = snapshot.status === 'running';
  const fraction = snapshot.completedSimulations / snapshot.totalSimulations;
  return (
    <section
      aria-label="Run progress"
      className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold" aria-live="polite">
          {STATUS_TEXT[snapshot.status]}
        </h2>
        <button
          type="button"
          onClick={onStop}
          disabled={!running}
          className="rounded-md bg-red-700 px-5 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Stop all
        </button>
      </div>

      <div
        role="progressbar"
        aria-label="Simulations finished"
        aria-valuemin={0}
        aria-valuemax={snapshot.totalSimulations}
        aria-valuenow={snapshot.completedSimulations}
        className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
      >
        <div className="h-full bg-teal-600" style={{ width: `${String(fraction * 100)}%` }} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-slate-600 dark:text-slate-400">Simulations</dt>
          <dd className="font-medium tabular-nums">
            {whole.format(snapshot.completedSimulations)} /{' '}
            {whole.format(snapshot.totalSimulations)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-600 dark:text-slate-400">Rounds per second</dt>
          <dd className="font-medium tabular-nums">{whole.format(snapshot.roundsPerSecond)}</dd>
        </div>
        <div>
          <dt className="text-slate-600 dark:text-slate-400">Elapsed</dt>
          <dd className="font-medium tabular-nums">{formatElapsed(snapshot.elapsedMs)}</dd>
        </div>
        <div>
          <dt className="text-slate-600 dark:text-slate-400">Workers</dt>
          <dd className="font-medium tabular-nums">{snapshot.workers}</dd>
        </div>
      </dl>

      {snapshot.error !== null && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {snapshot.error}
        </p>
      )}

      {running && (
        <div className="mt-3 text-sm">
          <p className="text-slate-600 dark:text-slate-400">
            Provisional, finished simulations only:
          </p>
          <ul className="mt-1 space-y-0.5 tabular-nums">
            {snapshot.provisional.map((strategy) => (
              <li key={strategy.strategyId} className="flex justify-between gap-4">
                <span>{STRATEGIES[strategy.strategyId].name}</span>
                <span>
                  {strategy.meanProfit === null
                    ? '—'
                    : `mean ${formatCentsGrouped(Math.round(strategy.meanProfit))}, in profit ${percent.format(strategy.profitableShare ?? 0)} (n = ${whole.format(strategy.simulations)})`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
