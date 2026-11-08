import { useState } from 'react';
import { GOALS, GOAL_TEXT, type Goal, rankByGoal } from '../../engine/statistics/rankings';
import type { StrategySummary } from '../../engine/statistics/summary';
import { STRATEGIES } from '../../shared/strategies';
import { TARGET_IDS, TARGET_MULTIPLES, type TargetId } from '../../shared/targets';
import { count, money, percent, rate } from './resultsData';

// Rankings by goal (plan 1 and 7.2, spec 2.7). Always "best under this selected configuration";
// overlapping 95% intervals are reported as inconclusive, never as a winner.

const VERDICTS = {
  leader: 'Highest',
  inconclusive: 'Inconclusive vs highest (intervals overlap)',
  behind: 'Lower (intervals do not overlap)',
  no_interval: 'Lower (no interval for this measure)',
} as const;

interface RankingsPanelProps {
  readonly strategies: readonly StrategySummary[];
  readonly checkpointRounds: readonly number[];
  readonly defaultTarget: TargetId;
}

export function RankingsPanel({ strategies, checkpointRounds, defaultTarget }: RankingsPanelProps) {
  const [goal, setGoal] = useState<Goal>('overall');
  const [target, setTarget] = useState<TargetId>(defaultTarget);
  const [checkpointIndex, setCheckpointIndex] = useState(0);
  const goals = GOALS.filter((entry) => entry !== 'checkpoint' || checkpointRounds.length > 0);
  const ranking = rankByGoal(strategies, goal, { target, checkpointIndex });

  const format = (value: number): string => {
    switch (goal) {
      case 'overall':
        return rate.format(value);
      case 'minimal_loss':
      case 'target':
        return percent.format(value);
      case 'maximum_win':
      case 'checkpoint':
        return money(value);
    }
  };

  return (
    <section
      aria-label="Rankings by goal"
      className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="text-base font-semibold">Rankings by goal</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Best under this selected configuration only. No betting system changes the house edge;
        systems reshape how results are spread.
      </p>
      <div role="tablist" aria-label="Goal" className="mt-3 flex flex-wrap gap-2">
        {goals.map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={goal === entry}
            onClick={() => {
              setGoal(entry);
            }}
            className="rounded-full border border-slate-300 px-3 py-1 text-sm aria-selected:border-teal-700 aria-selected:bg-teal-700 aria-selected:text-white dark:border-slate-700"
          >
            {GOAL_TEXT[entry].question}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-3 text-sm">
        <p className="text-slate-600 dark:text-slate-400">Ranked by: {GOAL_TEXT[goal].metric}.</p>
        {goal === 'target' && (
          <label className="mt-2 block">
            Target{' '}
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
              value={target}
              onChange={(event) => {
                const next = TARGET_IDS.find((id) => id === event.target.value);
                if (next !== undefined) setTarget(next);
              }}
            >
              {TARGET_IDS.map((id) => (
                <option key={id} value={id}>
                  {TARGET_MULTIPLES[id].label}
                </option>
              ))}
            </select>
          </label>
        )}
        {goal === 'checkpoint' && (
          <label className="mt-2 block">
            Checkpoint round{' '}
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
              value={checkpointIndex}
              onChange={(event) => {
                setCheckpointIndex(Number(event.target.value));
              }}
            >
              {checkpointRounds.map((round, index) => (
                <option key={round} value={index}>
                  {count.format(round)}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="mt-3 font-medium">
          {ranking.clearLeader
            ? `Best under this selected configuration: ${STRATEGIES[ranking.entries[0]?.strategyId ?? 'flat'].name}.`
            : 'No clear leader: the differences that matter are inside the 95% intervals, so they are inconclusive.'}
        </p>
        <ol className="mt-2 space-y-1">
          {ranking.entries.map((entry, position) => (
            <li key={entry.strategyId} className="flex flex-wrap gap-x-3 tabular-nums">
              <span className="w-5 text-right">{position + 1}.</span>
              <span className="min-w-48 font-medium">{STRATEGIES[entry.strategyId].name}</span>
              <span>{format(entry.value)}</span>
              {entry.interval !== null && (
                <span className="text-slate-500 dark:text-slate-400">
                  95% CI {format(entry.interval.low)} to {format(entry.interval.high)}
                </span>
              )}
              <span className="text-slate-600 dark:text-slate-400">{VERDICTS[entry.verdict]}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
