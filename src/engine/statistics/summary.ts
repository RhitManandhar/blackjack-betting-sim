import type { StopReason } from '../../shared/stopReasons';
import type { StrategyId } from '../../shared/strategies';
import { TARGET_IDS, type TargetId } from '../../shared/targets';
import {
  type Interval,
  meanInterval,
  percentileType7,
  ratioInterval,
  wilsonInterval,
} from './descriptive';
import type { ExperimentResults, StrategyColumns } from './experimentResults';
import { IntegerMoments } from './integerMoments';

// Per-strategy statistics over completed simulations (spec 10.2, plan 7.1). Every value is
// computed from the full result table in simulation-id order with exact integer sums, so the
// summary is identical however the simulations were scheduled. Money stays in cents; rates
// and averages may be fractional and are rounded only for display.

export const SMALL_SAMPLE_THRESHOLD = 100;

export interface TargetSummary {
  readonly target: TargetId;
  readonly hits: number;
  readonly hitRate: number;
  readonly hitRateInterval: Interval;
  readonly meanRoundsToTarget: number | null;
  readonly medianRoundsToTarget: number | null;
  /** Share of simulations that went bust without ever reaching this target. */
  readonly bustBefore: number;
}

export interface CheckpointSummary {
  readonly round: number;
  readonly simulations: number;
  readonly meanProfit: number;
  readonly profitableShare: number;
  readonly worstProfit: number;
  readonly meanProfitInterval: Interval | null;
  /** From the fixed-bin histogram; label as approximate (spec 10.3). */
  readonly approximate: {
    readonly p5: number;
    readonly p25: number;
    readonly median: number;
    readonly p75: number;
    readonly p95: number;
  };
  /** Bet progression (spec 2.7): bets placed in this round by strategies still playing. */
  readonly bets: {
    readonly stillPlaying: number;
    readonly stillPlayingShare: number;
    readonly meanBet: number | null;
    readonly p95Bet: number | null;
  };
}

export interface PercentileSet {
  readonly p5: number;
  readonly p25: number;
  readonly median: number;
  readonly p75: number;
  readonly p95: number;
}

export interface StrategySummary {
  readonly strategyId: StrategyId;
  readonly strategyVersion: string;
  readonly simulations: number;
  readonly smallSample: boolean;
  readonly statusCounts: Readonly<Record<StopReason, number>>;
  readonly profitShare: number;
  readonly profitShareInterval: Interval;
  readonly breakEvenShare: number;
  /** Goal 2 (spec 2.7): share ending at or above break-even, with its Wilson interval. */
  readonly atLeastBreakEvenShare: number;
  readonly atLeastBreakEvenInterval: Interval;
  readonly lossShare: number;
  readonly profitMean: number;
  readonly profitMeanInterval: Interval | null;
  readonly profitSd: number | null;
  readonly profitPercentiles: {
    readonly p5: number;
    readonly p25: number;
    readonly median: number;
    readonly p75: number;
    readonly p95: number;
  };
  readonly largestWin: number;
  readonly largestLoss: number;
  /** True when a target mode was active, so final profit is upside truncated (spec 3.2). */
  readonly profitUpsideTruncated: boolean;
  readonly returnPerUnitWagered: number;
  readonly returnPerUnitWageredInterval: Interval | null;
  readonly totalWagered: number;
  readonly averageWager: number;
  readonly maxWager: number;
  readonly averageRoundsPlayed: number;
  readonly maxDrawdown: number;
  readonly averageMaxDrawdown: number;
  readonly maxDrawdownPercentiles: PercentileSet;
  readonly targets: readonly TargetSummary[];
  readonly bustRate: number;
  readonly blockRate: number;
  readonly outcomeFrequencies: {
    readonly blackjack: number;
    readonly win: number;
    readonly push: number;
    readonly loss: number;
  };
  readonly unavailableActions: number;
  readonly minimumOvershootCount: number;
  readonly minimumOvershootTotal: number;
  readonly checkpoints: readonly CheckpointSummary[];
}

export interface ExperimentSummary {
  readonly completedSimulations: number;
  readonly strategies: readonly StrategySummary[];
}

export function summarizeExperiment(
  results: ExperimentResults,
  targetModeActive: boolean,
): ExperimentSummary {
  const completed: number[] = [];
  for (let simulation = 0; simulation < results.shape.simulations; simulation += 1) {
    if (results.isCompleted(simulation)) completed.push(simulation);
  }
  if (completed.length === 0) return { completedSimulations: 0, strategies: [] };
  return {
    completedSimulations: completed.length,
    strategies: results.shape.strategies.map((strategy, index) => {
      const columns = results.columns[index];
      if (columns === undefined) throw new Error('Missing strategy columns');
      return summarizeStrategy(
        strategy.id,
        strategy.version,
        columns,
        completed,
        results.shape.checkpoints,
        targetModeActive,
      );
    }),
  };
}

function exactSum(values: ArrayLike<number>, simulations: readonly number[]): number {
  let sum = 0;
  for (const simulation of simulations) sum += values[simulation] ?? 0;
  if (!Number.isSafeInteger(sum)) throw new RangeError('Sum exceeded the safe integer range');
  return sum;
}

function sortedValues(values: ArrayLike<number>, simulations: readonly number[]): Float64Array {
  return Float64Array.from(simulations, (simulation) => values[simulation] ?? 0).sort();
}

function summarizeStrategy(
  strategyId: StrategyId,
  strategyVersion: string,
  columns: StrategyColumns,
  simulations: readonly number[],
  checkpointRounds: readonly number[],
  targetModeActive: boolean,
): StrategySummary {
  const n = simulations.length;

  const statusCounts: Record<StopReason, number> = {
    target_reached: 0,
    bust: 0,
    blocked_table_max: 0,
    round_limit: 0,
  };
  const profit = new IntegerMoments();
  let profitable = 0;
  let breakEven = 0;
  let sumWageredSquares = 0n;
  let sumProfitTimesWagered = 0n;
  for (const simulation of simulations) {
    statusCounts[columns.stopReasonAt(simulation)] += 1;
    const net = columns.netProfit[simulation] ?? 0;
    const wagered = columns.totalWagered[simulation] ?? 0;
    profit.add(net);
    if (net > 0) profitable += 1;
    else if (net === 0) breakEven += 1;
    sumWageredSquares += BigInt(wagered) * BigInt(wagered);
    sumProfitTimesWagered += BigInt(net) * BigInt(wagered);
  }

  const sortedProfit = sortedValues(columns.netProfit, simulations);
  const profitMean = profit.sum / n;
  const profitSd = profit.sampleSd();
  const totalWagered = exactSum(columns.totalWagered, simulations);
  const totalRounds = exactSum(columns.roundsPlayed, simulations);
  const returnPerUnitWagered = totalWagered > 0 ? profit.sum / totalWagered : 0;

  return {
    strategyId,
    strategyVersion,
    simulations: n,
    smallSample: n < SMALL_SAMPLE_THRESHOLD,
    statusCounts,
    profitShare: profitable / n,
    profitShareInterval: wilsonInterval(profitable, n),
    atLeastBreakEvenShare: (profitable + breakEven) / n,
    atLeastBreakEvenInterval: wilsonInterval(profitable + breakEven, n),
    breakEvenShare: breakEven / n,
    lossShare: (n - profitable - breakEven) / n,
    profitMean,
    profitMeanInterval: profitSd === null ? null : meanInterval(profitMean, profitSd, n),
    profitSd,
    profitPercentiles: {
      p5: percentileType7(sortedProfit, 0.05),
      p25: percentileType7(sortedProfit, 0.25),
      median: percentileType7(sortedProfit, 0.5),
      p75: percentileType7(sortedProfit, 0.75),
      p95: percentileType7(sortedProfit, 0.95),
    },
    largestWin: sortedProfit[n - 1] ?? 0,
    largestLoss: sortedProfit[0] ?? 0,
    profitUpsideTruncated: targetModeActive,
    returnPerUnitWagered,
    returnPerUnitWageredInterval: ratioInterval(
      returnPerUnitWagered,
      n,
      totalWagered,
      Number(profit.sumSquares),
      Number(sumProfitTimesWagered),
      Number(sumWageredSquares),
    ),
    totalWagered,
    averageWager: totalRounds > 0 ? exactSum(columns.sumInitialBets, simulations) / totalRounds : 0,
    maxWager: maxOf(columns.maxWager, simulations),
    averageRoundsPlayed: totalRounds / n,
    maxDrawdown: maxOf(columns.maxDrawdown, simulations),
    maxDrawdownPercentiles: percentileSet(sortedValues(columns.maxDrawdown, simulations)),
    averageMaxDrawdown: exactSum(columns.maxDrawdown, simulations) / n,
    targets: TARGET_IDS.map((target) => summarizeTarget(target, columns, simulations)),
    bustRate: statusCounts.bust / n,
    blockRate: statusCounts.blocked_table_max / n,
    outcomeFrequencies: {
      blackjack: exactSum(columns.blackjacks, simulations) / totalRounds,
      win: exactSum(columns.wins, simulations) / totalRounds,
      push: exactSum(columns.pushes, simulations) / totalRounds,
      loss: exactSum(columns.losses, simulations) / totalRounds,
    },
    unavailableActions: exactSum(columns.unavailableActions, simulations),
    minimumOvershootCount: exactSum(columns.overshootCount, simulations),
    minimumOvershootTotal: exactSum(columns.overshootTotal, simulations),
    checkpoints: columns.checkpoints.map((aggregate, index) => ({
      round: checkpointRounds[index] ?? 0,
      simulations: aggregate.moments.count,
      meanProfit: aggregate.moments.mean() ?? 0,
      profitableShare:
        aggregate.moments.count > 0 ? aggregate.profitable / aggregate.moments.count : 0,
      worstProfit: aggregate.minimum,
      meanProfitInterval: checkpointMeanInterval(aggregate.moments),
      approximate: {
        p5: aggregate.approximatePercentile(0.05) ?? 0,
        p25: aggregate.approximatePercentile(0.25) ?? 0,
        median: aggregate.approximatePercentile(0.5) ?? 0,
        p75: aggregate.approximatePercentile(0.75) ?? 0,
        p95: aggregate.approximatePercentile(0.95) ?? 0,
      },
      bets: summarizeCheckpointBets(columns.checkpointBets[index], simulations),
    })),
  };
}

function percentileSet(sorted: Float64Array): PercentileSet {
  return {
    p5: percentileType7(sorted, 0.05),
    p25: percentileType7(sorted, 0.25),
    median: percentileType7(sorted, 0.5),
    p75: percentileType7(sorted, 0.75),
    p95: percentileType7(sorted, 0.95),
  };
}

function checkpointMeanInterval(moments: IntegerMoments): Interval | null {
  const mean = moments.mean();
  const sd = moments.sampleSd();
  return mean === null || sd === null ? null : meanInterval(mean, sd, moments.count);
}

/** Spec 2.7: exact mean and 95th percentile of the bets placed by strategies still playing. */
function summarizeCheckpointBets(
  column: Float64Array | undefined,
  simulations: readonly number[],
): CheckpointSummary['bets'] {
  const bets: number[] = [];
  for (const simulation of simulations) {
    const bet = column?.[simulation] ?? Number.NaN;
    if (!Number.isNaN(bet)) bets.push(bet);
  }
  const sorted = Float64Array.from(bets).sort();
  const total = bets.reduce((sum, bet) => sum + bet, 0);
  return {
    stillPlaying: bets.length,
    stillPlayingShare: simulations.length > 0 ? bets.length / simulations.length : 0,
    meanBet: bets.length > 0 ? total / bets.length : null,
    p95Bet: bets.length > 0 ? percentileType7(sorted, 0.95) : null,
  };
}

function maxOf(values: ArrayLike<number>, simulations: readonly number[]): number {
  let max = 0;
  for (const simulation of simulations) max = Math.max(max, values[simulation] ?? 0);
  return max;
}

function summarizeTarget(
  target: TargetId,
  columns: StrategyColumns,
  simulations: readonly number[],
): TargetSummary {
  const n = simulations.length;
  const rounds: number[] = [];
  let bustBefore = 0;
  for (const simulation of simulations) {
    const crossing = columns.firstCrossingAt(target, simulation);
    if (crossing !== null) rounds.push(crossing);
    else if (columns.stopReasonAt(simulation) === 'bust') bustBefore += 1;
  }
  const sortedRounds = Float64Array.from(rounds).sort();
  return {
    target,
    hits: rounds.length,
    hitRate: rounds.length / n,
    hitRateInterval: wilsonInterval(rounds.length, n),
    meanRoundsToTarget:
      rounds.length > 0 ? rounds.reduce((sum, round) => sum + round, 0) / rounds.length : null,
    medianRoundsToTarget: rounds.length > 0 ? percentileType7(sortedRounds, 0.5) : null,
    bustBefore: bustBefore / n,
  };
}
