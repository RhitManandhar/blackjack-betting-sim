import type { StrategyId } from '../../shared/strategies';
import { TARGET_IDS, type TargetId } from '../../shared/targets';
import type { Interval } from './descriptive';
import type { StrategySummary } from './summary';

// Rankings by goal (plan 1 and 7.2, defined in spec 2.7). Every ranking is "best under this
// selected configuration", never a universal best. A strategy whose 95% interval overlaps the
// leader's is "inconclusive" against it (spec 10.2). Metrics without an interval get no verdict.

export const GOALS = ['overall', 'minimal_loss', 'maximum_win', 'target', 'checkpoint'] as const;
export type Goal = (typeof GOALS)[number];

export const GOAL_TEXT: Record<Goal, { readonly question: string; readonly metric: string }> = {
  overall: {
    question: 'Best overall under perfect basic strategy',
    metric: 'Return per unit wagered (higher is better)',
  },
  minimal_loss: {
    question: 'Smallest loss most of the time',
    metric: 'Share of simulations ending at or above break-even',
  },
  maximum_win: {
    question: 'Largest win most of the time',
    metric: '75th-percentile final profit',
  },
  target: {
    question: 'Most likely to reach the target',
    metric: 'Hit rate for the target',
  },
  checkpoint: {
    question: 'Furthest ahead (or least behind) at the checkpoint',
    metric: 'Mean profit at the checkpoint round',
  },
};

export type Verdict = 'leader' | 'inconclusive' | 'behind' | 'no_interval';

export interface RankedStrategy {
  readonly strategyId: StrategyId;
  readonly value: number;
  readonly interval: Interval | null;
  readonly verdict: Verdict;
}

export interface Ranking {
  readonly goal: Goal;
  readonly entries: readonly RankedStrategy[];
  /** True only when every other strategy's interval is clearly below the leader's. */
  readonly clearLeader: boolean;
}

export interface RankingOptions {
  readonly target?: TargetId;
  readonly checkpointIndex?: number;
}

function metricFor(
  summary: StrategySummary,
  goal: Goal,
  options: RankingOptions,
): { value: number; interval: Interval | null } | null {
  switch (goal) {
    case 'overall':
      return {
        value: summary.returnPerUnitWagered,
        interval: summary.returnPerUnitWageredInterval,
      };
    case 'minimal_loss':
      return { value: summary.atLeastBreakEvenShare, interval: summary.atLeastBreakEvenInterval };
    case 'maximum_win':
      return { value: summary.profitPercentiles.p75, interval: null };
    case 'target': {
      const target = summary.targets[TARGET_IDS.indexOf(options.target ?? '1x')];
      return target === undefined
        ? null
        : { value: target.hitRate, interval: target.hitRateInterval };
    }
    case 'checkpoint': {
      const checkpoint = summary.checkpoints[options.checkpointIndex ?? 0];
      return checkpoint === undefined
        ? null
        : { value: checkpoint.meanProfit, interval: checkpoint.meanProfitInterval };
    }
  }
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.low <= b.high && b.low <= a.high;
}

export function rankByGoal(
  strategies: readonly StrategySummary[],
  goal: Goal,
  options: RankingOptions = {},
): Ranking {
  const measured = strategies
    .map((summary, order) => ({ summary, order, metric: metricFor(summary, goal, options) }))
    .filter((entry) => entry.metric !== null)
    // Higher is better for every goal; ties keep the configuration order.
    .sort((a, b) => (b.metric?.value ?? 0) - (a.metric?.value ?? 0) || a.order - b.order);

  const leader = measured[0]?.metric ?? null;
  const entries = measured.map((entry, position): RankedStrategy => {
    const metric = entry.metric ?? { value: 0, interval: null };
    let verdict: Verdict;
    if (position === 0) verdict = 'leader';
    else if (leader?.interval == null || metric.interval === null) verdict = 'no_interval';
    else if (metric.value === leader.value || overlaps(metric.interval, leader.interval)) {
      verdict = 'inconclusive';
    } else verdict = 'behind';
    return {
      strategyId: entry.summary.strategyId,
      value: metric.value,
      interval: metric.interval,
      verdict,
    };
  });
  return {
    goal,
    entries,
    clearLeader:
      entries.length > 1 && entries.slice(1).every((entry) => entry.verdict === 'behind'),
  };
}
