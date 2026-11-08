import type { StrategySummary } from '../../../engine/statistics/summary';
import { TARGET_IDS, TARGET_MULTIPLES } from '../../../shared/targets';
import { chartInk } from '../strategyColors';
import {
  type ChartOption,
  type ChartTheme,
  baseOption,
  categoryAxis,
  seriesColor,
  strategyName,
  toUnits,
  valueAxis,
} from './chartBase';

// Final dashboard charts (plan 8.3). Inputs are summaries only, so the HTML report can redraw
// identical charts from the same embedded summary.

const roundLabel = (round: number) => round.toLocaleString('en-AU');

/**
 * Profit at checkpoints with a 5th-95th percentile band and the median line (plan 7.4).
 * Percentiles come from the fixed-bin histograms and are approximate (spec 10.3). Strategies
 * that stopped early are carried forward at their final profit.
 */
export function checkpointBandsOption(
  strategies: readonly StrategySummary[],
  theme: ChartTheme,
): ChartOption {
  const rounds = strategies[0]?.checkpoints.map((checkpoint) => roundLabel(checkpoint.round)) ?? [];
  return {
    ...baseOption(theme),
    grid: { left: 72, right: 24, top: 48, bottom: 48 },
    tooltip: { trigger: 'axis' },
    xAxis: categoryAxis(theme, 'Round', rounds),
    yAxis: valueAxis(theme, 'Profit (AUD)'),
    series: strategies.flatMap((summary) => {
      const name = strategyName(summary.strategyId);
      const color = seriesColor(summary.strategyId, theme);
      const stack = `band-${summary.strategyId}`;
      return [
        {
          name,
          type: 'line',
          stack,
          data: summary.checkpoints.map((checkpoint) => toUnits(checkpoint.approximate.p5)),
          lineStyle: { opacity: 0 },
          symbol: 'none',
          color,
          tooltip: { show: false },
        },
        {
          name,
          type: 'line',
          stack,
          data: summary.checkpoints.map((checkpoint) =>
            toUnits(checkpoint.approximate.p95 - checkpoint.approximate.p5),
          ),
          lineStyle: { opacity: 0 },
          areaStyle: { color, opacity: 0.12 },
          symbol: 'none',
          color,
          tooltip: { show: false },
        },
        {
          name,
          type: 'line',
          data: summary.checkpoints.map((checkpoint) => toUnits(checkpoint.approximate.median)),
          color,
          lineStyle: { width: 2 },
          symbolSize: 8,
        },
      ];
    }),
  };
}

function boxOption(
  strategies: readonly StrategySummary[],
  theme: ChartTheme,
  axisName: string,
  pick: (summary: StrategySummary) => {
    p5: number;
    p25: number;
    median: number;
    p75: number;
    p95: number;
  },
): ChartOption {
  return {
    ...baseOption(theme),
    legend: { show: false },
    grid: { left: 72, right: 24, top: 24, bottom: 64 },
    tooltip: { trigger: 'item' },
    xAxis: categoryAxis(
      theme,
      '',
      strategies.map((summary) => strategyName(summary.strategyId)),
    ),
    yAxis: valueAxis(theme, axisName),
    series: [
      {
        name: axisName,
        type: 'boxplot',
        // ECharts boxplot order: lower whisker, Q1, median, Q3, upper whisker (here p5..p95).
        data: strategies.map((summary) => {
          const set = pick(summary);
          return {
            value: [set.p5, set.p25, set.median, set.p75, set.p95].map(toUnits),
            itemStyle: {
              color: `${seriesColor(summary.strategyId, theme)}33`,
              borderColor: seriesColor(summary.strategyId, theme),
              borderWidth: 2,
            },
          };
        }),
      },
    ],
  };
}

/** Final profit distribution: box from 25th to 75th percentile, whiskers at 5th and 95th (exact). */
export function finalProfitOption(
  strategies: readonly StrategySummary[],
  theme: ChartTheme,
): ChartOption {
  return boxOption(strategies, theme, 'Final profit (AUD)', (summary) => summary.profitPercentiles);
}

/** Maximum drawdown distribution, same box layout (exact percentiles). */
export function drawdownOption(
  strategies: readonly StrategySummary[],
  theme: ChartTheme,
): ChartOption {
  return boxOption(
    strategies,
    theme,
    'Maximum drawdown (AUD)',
    (summary) => summary.maxDrawdownPercentiles,
  );
}

/** Share of simulations that ever reached each target (first crossing, spec 3.3). */
export function targetAttainmentOption(
  strategies: readonly StrategySummary[],
  theme: ChartTheme,
): ChartOption {
  return {
    ...baseOption(theme),
    grid: { left: 64, right: 24, top: 48, bottom: 48 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: categoryAxis(
      theme,
      'Target (multiple of starting bankroll)',
      TARGET_IDS.map((target) => TARGET_MULTIPLES[target].label),
    ),
    yAxis: valueAxis(theme, 'Simulations reaching it (%)', { max: 100 }),
    series: strategies.map((summary) => ({
      name: strategyName(summary.strategyId),
      type: 'bar',
      barGap: '10%',
      color: seriesColor(summary.strategyId, theme),
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      data: summary.targets.map((target) => Math.round(target.hitRate * 1000) / 10),
    })),
  };
}

/**
 * Bet progression (spec 2.7): mean bet (solid) and 95th-percentile bet (dashed) at each
 * checkpoint among strategies still playing. Stopped strategies are excluded, not carried.
 */
export function betProgressionOption(
  strategies: readonly StrategySummary[],
  theme: ChartTheme,
): ChartOption {
  const rounds = strategies[0]?.checkpoints.map((checkpoint) => roundLabel(checkpoint.round)) ?? [];
  return {
    ...baseOption(theme),
    grid: { left: 72, right: 24, top: 48, bottom: 48 },
    tooltip: { trigger: 'axis' },
    xAxis: categoryAxis(theme, 'Round', rounds),
    yAxis: valueAxis(theme, 'Bet (AUD)'),
    series: strategies.flatMap((summary) => {
      const name = strategyName(summary.strategyId);
      const color = seriesColor(summary.strategyId, theme);
      return [
        {
          name,
          type: 'line',
          color,
          lineStyle: { width: 2 },
          data: summary.checkpoints.map((checkpoint) =>
            checkpoint.bets.meanBet === null ? null : toUnits(checkpoint.bets.meanBet),
          ),
        },
        {
          name,
          type: 'line',
          color,
          lineStyle: { width: 1.5, type: 'dashed' },
          data: summary.checkpoints.map((checkpoint) =>
            checkpoint.bets.p95Bet === null ? null : toUnits(checkpoint.bets.p95Bet),
          ),
        },
      ];
    }),
  };
}

/** Share of simulations in which each strategy is still playing at each checkpoint. */
export function stillPlayingOption(
  strategies: readonly StrategySummary[],
  theme: ChartTheme,
): ChartOption {
  const ink = chartInk(theme.dark);
  const rounds = strategies[0]?.checkpoints.map((checkpoint) => roundLabel(checkpoint.round)) ?? [];
  return {
    ...baseOption(theme),
    grid: { left: 64, right: 24, top: 48, bottom: 48 },
    tooltip: { trigger: 'axis' },
    xAxis: categoryAxis(theme, 'Round', rounds),
    yAxis: valueAxis(theme, 'Still playing (%)', { max: 100, nameTextStyle: { color: ink.muted } }),
    series: strategies.map((summary) => ({
      name: strategyName(summary.strategyId),
      type: 'line',
      color: seriesColor(summary.strategyId, theme),
      lineStyle: { width: 2 },
      data: summary.checkpoints.map(
        (checkpoint) => Math.round(checkpoint.bets.stillPlayingShare * 1000) / 10,
      ),
    })),
  };
}
