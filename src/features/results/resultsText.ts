import type { Goal, Verdict } from '../../engine/statistics/rankings';
import type { ExperimentConfig } from '../../shared/schema';
import { targetAmount } from '../../shared/targets';
import { money, percent, rate } from './resultsData';

// Wording and formatting shared by the final dashboard and the standalone HTML report, so the
// report always says and shows exactly what the screen does (plan Phase 8 exit criteria).

export type EndedStatus = 'complete' | 'cancelled' | 'failed';

export const STATUS_NOTE: Readonly<Record<EndedStatus, string>> = {
  complete: '',
  cancelled: 'Partial results: the run was stopped. Figures cover finished simulations only.',
  failed: 'Partial results: the run failed. Figures cover finished simulations only.',
};

export const VERDICT_TEXT: Readonly<Record<Verdict, string>> = {
  leader: 'Highest',
  inconclusive: 'Inconclusive vs highest (intervals overlap)',
  behind: 'Lower (intervals do not overlap)',
  no_interval: 'Lower (no interval for this measure)',
};

export const NO_CLEAR_LEADER =
  'No clear leader: the differences that matter are inside the 95% intervals, so they are inconclusive.';

export const RANKINGS_NOTE =
  'Best under this selected configuration only. No betting system changes the house edge; systems reshape how results are spread.';

export const RETURN_NOTE =
  'Compare return per unit wagered as well as profit: profit in currency mostly follows how much a system wagers.';

export const SMALL_SAMPLE_NOTE = 'Fewer than 100 simulations: treat these figures as rough.';

export function formatRankingValue(goal: Goal, value: number): string {
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
}

export type DashboardChartKey =
  'bands' | 'finalProfit' | 'targets' | 'drawdown' | 'bets' | 'stillPlaying';

export function chartText(
  key: DashboardChartKey,
  upsideTruncated: boolean,
): { readonly title: string; readonly note: string; readonly ariaLabel: string } {
  switch (key) {
    case 'bands':
      return {
        title: 'Profit at checkpoints',
        note: 'Median line with the 5th–95th percentile band (approximate, from fixed bins). Strategies that stopped earlier are carried forward at their final profit. Click a legend entry to hide a strategy.',
        ariaLabel:
          'Profit at each checkpoint round, median and 5th to 95th percentile band per strategy',
      };
    case 'finalProfit':
      return {
        title: 'Final profit distribution',
        note: `Box: 25th to 75th percentile, line: median, whiskers: 5th and 95th percentile (exact).${upsideTruncated ? ' Upside truncated: strategies stop at their target.' : ''}`,
        ariaLabel: 'Final profit distribution per strategy',
      };
    case 'targets':
      return {
        title: 'Target attainment',
        note: 'Share of simulations that ever reached each target, even if profit fell back later.',
        ariaLabel: 'Share of simulations reaching each profit target per strategy',
      };
    case 'drawdown':
      return {
        title: 'Maximum drawdown',
        note: 'Largest fall from a previous bankroll peak within a simulation. Box and whiskers as above.',
        ariaLabel: 'Maximum drawdown distribution per strategy',
      };
    case 'bets':
      return {
        title: 'Bet progression',
        note: 'Mean bet (solid) and 95th-percentile bet (dashed) at each checkpoint, among strategies still playing then.',
        ariaLabel: 'Mean and 95th percentile bet at each checkpoint per strategy',
      };
    case 'stillPlaying':
      return {
        title: 'Still playing',
        note: 'Share of simulations in which each strategy had not yet stopped at each checkpoint.',
        ariaLabel: 'Share of simulations still playing at each checkpoint per strategy',
      };
  }
}

/** The bankroll at which the active target is reached, for panel reference lines (spec 10.9). */
export function targetBankrollFor(config: ExperimentConfig): number | null {
  if (config.targetMode === 'none') return null;
  const target = config.targetMode === 'single' ? config.singleTarget : '2_5x';
  return target === null
    ? null
    : config.startingBankroll + targetAmount(config.startingBankroll, target);
}
