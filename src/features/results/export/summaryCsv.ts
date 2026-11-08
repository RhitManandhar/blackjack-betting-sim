import type { StrategySummary } from '../../../engine/statistics/summary';
import { TARGET_IDS } from '../../../shared/targets';
import { averageCell, booleanCell, csvRow, integerCell, moneyCell, rateCell } from './csv';
import type { ExportMeta } from './exportMeta';

// CSV 1, summary (spec 10.6): one row per strategy, from the same summaries the dashboard shows.

export const SUMMARY_COLUMNS = [
  'experiment_id',
  'experiment_seed',
  'spec_version',
  'run_status',
  'currency',
  'strategy_id',
  'strategy_version',
  'simulations',
  'status_target_reached',
  'status_bust',
  'status_blocked_table_max',
  'status_round_limit',
  'share_profit',
  'share_profit_ci_low',
  'share_profit_ci_high',
  'share_break_even',
  'share_loss',
  'profit_mean',
  'profit_mean_ci_low',
  'profit_mean_ci_high',
  'profit_sd',
  'profit_p5',
  'profit_p25',
  'profit_median',
  'profit_p75',
  'profit_p95',
  'largest_win',
  'largest_loss',
  'profit_upside_truncated',
  'return_per_unit_wagered',
  'rpuw_ci_low',
  'rpuw_ci_high',
  'total_wagered',
  'avg_wager',
  'max_wager',
  'avg_rounds_played',
  'max_drawdown',
  'avg_max_drawdown',
  ...TARGET_IDS.flatMap((target) => [
    `hit_rate_${target}`,
    `hit_rate_${target}_ci_low`,
    `hit_rate_${target}_ci_high`,
    `avg_rounds_to_${target}`,
    `bust_before_${target}`,
  ]),
  'bust_rate',
  'block_rate',
  'freq_blackjack',
  'freq_win',
  'freq_push',
  'freq_loss',
  'unavailable_actions',
  'minimum_overshoot_count',
] as const;

function summaryCells(meta: ExportMeta, s: StrategySummary): string[] {
  const targetCells = TARGET_IDS.flatMap((target) => {
    const summary = s.targets.find((entry) => entry.target === target);
    if (summary === undefined) return ['', '', '', '', ''];
    return [
      rateCell(summary.hitRate),
      rateCell(summary.hitRateInterval.low),
      rateCell(summary.hitRateInterval.high),
      averageCell(summary.meanRoundsToTarget),
      rateCell(summary.bustBefore),
    ];
  });
  return [
    meta.experimentId,
    String(meta.experimentSeed),
    meta.specVersion,
    meta.runStatus,
    meta.currency,
    s.strategyId,
    s.strategyVersion,
    integerCell(s.simulations),
    integerCell(s.statusCounts.target_reached),
    integerCell(s.statusCounts.bust),
    integerCell(s.statusCounts.blocked_table_max),
    integerCell(s.statusCounts.round_limit),
    rateCell(s.profitShare),
    rateCell(s.profitShareInterval.low),
    rateCell(s.profitShareInterval.high),
    rateCell(s.breakEvenShare),
    rateCell(s.lossShare),
    moneyCell(s.profitMean),
    moneyCell(s.profitMeanInterval?.low ?? null),
    moneyCell(s.profitMeanInterval?.high ?? null),
    moneyCell(s.profitSd),
    moneyCell(s.profitPercentiles.p5),
    moneyCell(s.profitPercentiles.p25),
    moneyCell(s.profitPercentiles.median),
    moneyCell(s.profitPercentiles.p75),
    moneyCell(s.profitPercentiles.p95),
    moneyCell(s.largestWin),
    moneyCell(s.largestLoss),
    booleanCell(s.profitUpsideTruncated),
    rateCell(s.returnPerUnitWagered),
    rateCell(s.returnPerUnitWageredInterval?.low ?? null),
    rateCell(s.returnPerUnitWageredInterval?.high ?? null),
    moneyCell(s.totalWagered),
    moneyCell(s.averageWager),
    moneyCell(s.maxWager),
    averageCell(s.averageRoundsPlayed),
    moneyCell(s.maxDrawdown),
    moneyCell(s.averageMaxDrawdown),
    ...targetCells,
    rateCell(s.bustRate),
    rateCell(s.blockRate),
    rateCell(s.outcomeFrequencies.blackjack),
    rateCell(s.outcomeFrequencies.win),
    rateCell(s.outcomeFrequencies.push),
    rateCell(s.outcomeFrequencies.loss),
    integerCell(s.unavailableActions),
    integerCell(s.minimumOvershootCount),
  ];
}

export function summaryCsv(meta: ExportMeta, strategies: readonly StrategySummary[]): string {
  return [
    csvRow(SUMMARY_COLUMNS),
    ...strategies.map((summary) => csvRow(summaryCells(meta, summary))),
  ].join('');
}
