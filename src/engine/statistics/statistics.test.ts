import { describe, expect, it } from 'vitest';
import { STRATEGIES, STRATEGY_IDS } from '../../shared/strategies';
import { createSimulationPlan } from '../simulation/plan';
import { Rng } from '../simulation/rng';
import { type StrategySimulationResult, runSimulation } from '../simulation/runSimulation';
import { testConfig } from '../simulation/__tests__/scripted';
import { CheckpointAggregate, checkpointLayout, histogramSlot } from './checkpointAggregate';
import { meanInterval, percentileType7, ratioInterval, wilsonInterval } from './descriptive';
import { ExperimentResults } from './experimentResults';
import { IntegerMoments } from './integerMoments';
import { summarizeExperiment } from './summary';

describe('percentileType7 (spec 10.2, D14)', () => {
  // Hand calculation for [-20, 0, 10, 30, 100]: h = (n - 1)p = 4p.
  const sorted = [-20, 0, 10, 30, 100];
  it.each([
    [0, -20],
    [0.05, -16], // h = 0.2: -20 + 0.2 * 20
    [0.25, 0], // h = 1
    [0.5, 10], // h = 2
    [0.75, 30], // h = 3
    [0.95, 86], // h = 3.8: 30 + 0.8 * 70
    [1, 100],
  ])('p = %d -> %d', (p, expected) => {
    expect(percentileType7(sorted, p)).toBeCloseTo(expected, 10);
  });

  it('handles a single value and rejects an empty set', () => {
    expect(percentileType7([42], 0.95)).toBe(42);
    expect(() => percentileType7([], 0.5)).toThrow();
  });
});

describe('intervals (spec 10.2)', () => {
  it('Wilson 95% for 7 of 10 matches the textbook value (0.3968, 0.8922)', () => {
    const { low, high } = wilsonInterval(7, 10);
    expect(low).toBeCloseTo(0.3968, 4);
    expect(high).toBeCloseTo(0.8922, 4);
  });

  it('Wilson stays inside [0, 1] at the extremes', () => {
    expect(wilsonInterval(0, 20).low).toBe(0);
    expect(wilsonInterval(20, 20).high).toBe(1);
    expect(wilsonInterval(0, 20).high).toBeGreaterThan(0);
  });

  it('mean interval is mean ± 1.96·SD/√n', () => {
    const { low, high } = meanInterval(10, 4, 16);
    expect(low).toBeCloseTo(8.04, 10);
    expect(high).toBeCloseTo(11.96, 10);
  });

  it('ratio interval matches a hand calculation', () => {
    // p = [10, -20, 30], w = [100, 200, 100]: R = 20 / 400 = 0.05.
    // Residuals p - Rw = 5, -30, 25; squares sum 1550; /(3 * 2) = 258.33; sqrt / mean(w) 133.33.
    const interval = ratioInterval(
      0.05,
      3,
      400,
      100 + 400 + 900,
      1000 - 4000 + 3000,
      10_000 + 40_000 + 10_000,
    );
    const standardError = Math.sqrt(1550 / 6) / (400 / 3);
    expect(interval?.low).toBeCloseTo(0.05 - 1.96 * standardError, 12);
    expect(interval?.high).toBeCloseTo(0.05 + 1.96 * standardError, 12);
    expect(ratioInterval(0.05, 1, 100, 1, 1, 1)).toBeNull();
  });
});

describe('IntegerMoments', () => {
  it('gives the exact mean and sample variance', () => {
    const moments = new IntegerMoments();
    for (const value of [-2000, 0, 1000, 3000, 10_000]) moments.add(value);
    expect(moments.mean()).toBe(2400);
    expect(moments.sampleVariance()).toBe(21_300_000);
  });

  it('stays exact where squares pass 2^53', () => {
    const moments = new IntegerMoments();
    moments.add(3_000_000_000);
    moments.add(-3_000_000_000);
    expect(moments.sumSquares).toBe(18_000_000_000_000_000_000n);
    expect(moments.sampleVariance()).toBe(18_000_000_000_000_000_000);
  });

  it('merges to the same result in any order', () => {
    const values = [5, -7, 11, 13, -17, 19];
    const whole = new IntegerMoments();
    for (const value of values) whole.add(value);
    const left = new IntegerMoments();
    const right = new IntegerMoments();
    values.forEach((value, index) => {
      (index % 2 === 0 ? left : right).add(value);
    });
    right.merge(left);
    expect(right.sum).toBe(whole.sum);
    expect(right.sumSquares).toBe(whole.sumSquares);
    expect(right.sampleVariance()).toBe(whole.sampleVariance());
  });

  it('refuses non-integers', () => {
    expect(() => {
      new IntegerMoments().add(0.5);
    }).toThrow(RangeError);
  });
});

describe('checkpoint histogram (spec 10.3, layout pinned in 2.4)', () => {
  const layout = checkpointLayout(50_000); // -500.00 .. +1,500.00, bins of 5.00

  it('depends only on the starting bankroll', () => {
    expect(layout).toEqual({ lower: -50_000, upper: 150_000, bins: 400 });
  });

  it.each([
    [-50_001, 0], // underflow
    [-50_000, 1],
    [-49_501, 1],
    [-49_500, 2],
    [0, 101],
    [149_999, 400],
    [150_000, 401], // overflow
  ])('profit %i goes to slot %i', (profit, slot) => {
    expect(histogramSlot(layout, profit)).toBe(slot);
  });

  it('approximates percentiles to within one bin width', () => {
    const aggregate = new CheckpointAggregate(layout);
    const values: number[] = [];
    const rng = new Rng(4);
    for (let index = 0; index < 5000; index += 1) {
      const value = rng.nextBelow(120_000) - 40_000;
      values.push(value);
      aggregate.add(value);
    }
    const sorted = values.sort((a, b) => a - b);
    for (const p of [0.05, 0.5, 0.95]) {
      const approximate = aggregate.approximatePercentile(p) ?? Number.NaN;
      expect(Math.abs(approximate - percentileType7(sorted, p))).toBeLessThanOrEqual(500);
    }
    expect(aggregate.minimum).toBe(sorted[0]);
  });

  it('merges by adding counts', () => {
    const a = new CheckpointAggregate(layout);
    const b = new CheckpointAggregate(layout);
    const whole = new CheckpointAggregate(layout);
    [-3000, 0, 4000, 200_000].forEach((value, index) => {
      (index < 2 ? a : b).add(value);
      whole.add(value);
    });
    a.merge(b);
    expect(Array.from(a.counts)).toEqual(Array.from(whole.counts));
    expect(a.profitable).toBe(2);
    expect(a.minimum).toBe(-3000);
    expect(a.counts[401]).toBe(1);
  });
});

// A small known set (plan Phase 5 exit criterion): five hand-made simulations for one strategy.
function handMade(
  simulationId: number,
  fields: Partial<StrategySimulationResult>,
): StrategySimulationResult {
  return {
    simulationId,
    simulationSeed: simulationId,
    strategyId: 'flat',
    strategyVersion: 'flat-v1',
    roundsPlayed: 5,
    startingBankroll: 50_000,
    finalBankroll: 50_000 + (fields.netProfit ?? 0),
    netProfit: 0,
    totalWagered: 10_000,
    sumInitialBets: 10_000,
    maxWager: 2000,
    maxDrawdown: 0,
    firstCrossing: { '0_5x': null, '1x': null, '2x': null, '2_5x': null },
    stopReason: 'round_limit',
    requiredBetAtStop: null,
    outcomeCounts: { blackjack: 0, win: 2, push: 1, loss: 2 },
    unavailableActionCount: 0,
    minimumOvershootCount: 0,
    minimumOvershootTotal: 0,
    checkpointProfit: [],
    checkpointBet: [],
    curve: null,
    ...fields,
  };
}

describe('summarizeExperiment on a hand-calculated set', () => {
  const results = new ExperimentResults({
    simulations: 6, // one left unfinished: it must not count
    strategies: [{ id: 'flat', version: 'flat-v1' }],
    startingBankroll: 50_000,
    checkpoints: [],
  });
  results.add([
    handMade(0, {
      netProfit: -2000,
      maxDrawdown: 3000,
      stopReason: 'bust',
      requiredBetAtStop: 2000,
    }),
  ]);
  results.add([
    handMade(1, {
      netProfit: 0,
      totalWagered: 20_000,
      sumInitialBets: 20_000,
      roundsPlayed: 10,
      maxDrawdown: 1000,
    }),
  ]);
  results.add([
    handMade(2, {
      netProfit: 1000,
      maxDrawdown: 500,
      firstCrossing: { '0_5x': 3, '1x': null, '2x': null, '2_5x': null },
    }),
  ]);
  results.add([
    handMade(3, {
      netProfit: 3000,
      stopReason: 'target_reached',
      firstCrossing: { '0_5x': 4, '1x': null, '2x': null, '2_5x': null },
    }),
  ]);
  results.add([
    handMade(4, {
      netProfit: 10_000,
      totalWagered: 50_000,
      sumInitialBets: 40_000,
      roundsPlayed: 25,
      maxWager: 4000,
      maxDrawdown: 2000,
      stopReason: 'target_reached',
      firstCrossing: { '0_5x': 2, '1x': 20, '2x': null, '2_5x': null },
      outcomeCounts: { blackjack: 2, win: 10, push: 3, loss: 10 },
    }),
  ]);
  const { completedSimulations, strategies } = summarizeExperiment(results, true);
  const summary = strategies[0];

  it('counts only completed simulations', () => {
    expect(completedSimulations).toBe(5);
    expect(summary?.simulations).toBe(5);
    expect(summary?.smallSample).toBe(true);
  });

  it('matches the hand calculation for profit statistics', () => {
    expect(summary?.profitMean).toBe(2400);
    expect(summary?.profitSd).toBeCloseTo(Math.sqrt(21_300_000), 9);
    expect(summary?.profitPercentiles).toEqual({
      p5: -1600,
      p25: 0,
      median: 1000,
      p75: 3000,
      p95: 8600,
    });
    expect(summary?.profitShare).toBe(0.6);
    expect(summary?.breakEvenShare).toBe(0.2);
    expect(summary?.lossShare).toBe(0.2);
    expect(summary?.largestWin).toBe(10_000);
    expect(summary?.largestLoss).toBe(-2000);
    expect(summary?.profitUpsideTruncated).toBe(true);
  });

  it('matches the hand calculation for return per unit wagered', () => {
    // R = 12,000 / 100,000. Residuals p - Rw: -3200, -2400, -200, 1800, 4000; squares 35.28e6.
    const standardError = Math.sqrt(35_280_000 / 20) / 20_000;
    expect(summary?.returnPerUnitWagered).toBe(0.12);
    expect(summary?.returnPerUnitWageredInterval?.low).toBeCloseTo(0.12 - 1.96 * standardError, 12);
    expect(summary?.returnPerUnitWageredInterval?.high).toBeCloseTo(
      0.12 + 1.96 * standardError,
      12,
    );
  });

  it('matches the hand calculation for wagers, rounds, drawdown and stop reasons', () => {
    expect(summary).toMatchObject({
      totalWagered: 100_000,
      averageWager: 90_000 / 50,
      maxWager: 4000,
      averageRoundsPlayed: 10,
      maxDrawdown: 3000,
      averageMaxDrawdown: 1300,
      statusCounts: { target_reached: 2, bust: 1, blocked_table_max: 0, round_limit: 2 },
      bustRate: 0.2,
      blockRate: 0,
    });
  });

  it('matches the hand calculation for targets and outcome frequencies', () => {
    expect(summary?.targets[0]).toMatchObject({
      target: '0_5x',
      hits: 3,
      hitRate: 0.6,
      meanRoundsToTarget: 3,
      medianRoundsToTarget: 3,
      bustBefore: 0.2,
    });
    expect(summary?.targets[1]).toMatchObject({ target: '1x', hits: 1, meanRoundsToTarget: 20 });
    expect(summary?.targets[3]).toMatchObject({ hits: 0, meanRoundsToTarget: null });
    // Rounds 50: blackjack 2, win 2*4 + 10, push 1*4 + 3, loss 2*4 + 10.
    expect(summary?.outcomeFrequencies).toEqual({
      blackjack: 2 / 50,
      win: 18 / 50,
      push: 7 / 50,
      loss: 18 / 50,
    });
  });

  it('refuses to count a simulation twice', () => {
    expect(() => {
      results.add([handMade(2, {})]);
    }).toThrow(/already added/);
  });
});

describe('order independence (spec 8.4)', () => {
  it('gives an identical summary whatever order simulations arrive in', { timeout: 60_000 }, () => {
    const config = testConfig({
      simulations: 24,
      roundLimit: 200,
      strategies: STRATEGY_IDS.map((id) => ({ id, version: STRATEGIES[id].version })),
      targetMode: 'compare_all',
      checkpoints: [50, 100, 200],
    });
    const plan = createSimulationPlan(config);
    const all = Array.from({ length: config.simulations }, (_, index) =>
      runSimulation(plan, index),
    );
    const shape = { ...config, strategies: config.strategies };

    const inOrder = new ExperimentResults(shape);
    for (const simulation of all) inOrder.add(simulation);

    const shuffled = new ExperimentResults(shape);
    const order = all.map((_, index) => index);
    const rng = new Rng(17);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const swap = rng.nextBelow(index + 1);
      [order[index], order[swap]] = [order[swap] ?? 0, order[index] ?? 0];
    }
    for (const index of order) shuffled.add(all[index] ?? []);

    expect(summarizeExperiment(shuffled, true)).toEqual(summarizeExperiment(inOrder, true));
  });
});

describe('Phase 8b summary additions (spec 2.7)', () => {
  const config = testConfig({
    simulations: 30,
    roundLimit: 200,
    strategies: [
      { id: 'flat', version: 'flat-v1' },
      { id: 'martingale', version: 'martingale-v1' },
    ],
    checkpoints: [10, 100, 200],
  });
  const plan = createSimulationPlan(config);
  const results = new ExperimentResults(config);
  const all = Array.from({ length: config.simulations }, (_, index) => runSimulation(plan, index));
  for (const simulation of all) results.add(simulation);
  const summary = summarizeExperiment(results, false);

  it('records the bet at each checkpoint, null once a strategy has stopped', () => {
    for (const simulation of all) {
      for (const result of simulation) {
        result.checkpointBet.forEach((bet, index) => {
          const round = config.checkpoints[index] ?? 0;
          if (result.roundsPlayed >= round) expect(bet).toBeGreaterThanOrEqual(config.tableMinimum);
          else expect(bet).toBeNull();
        });
      }
    }
  });

  it('summarises bet progression from the strategies still playing', () => {
    const martingale = summary.strategies[1];
    for (const [index, checkpoint] of (martingale?.checkpoints ?? []).entries()) {
      const bets = all
        .map((simulation) => simulation[1]?.checkpointBet[index] ?? null)
        .filter((bet): bet is number => bet !== null)
        .sort((a, b) => a - b);
      expect(checkpoint.bets.stillPlaying).toBe(bets.length);
      expect(checkpoint.bets.stillPlayingShare).toBe(bets.length / 30);
      if (bets.length > 0) {
        expect(checkpoint.bets.meanBet).toBeCloseTo(
          bets.reduce((a, b) => a + b, 0) / bets.length,
          9,
        );
        expect(checkpoint.bets.p95Bet).toBeCloseTo(percentileType7(bets, 0.95), 9);
      }
    }
    // Flat never changes its bet, so every still-playing bet is the unit.
    for (const checkpoint of summary.strategies[0]?.checkpoints ?? []) {
      if (checkpoint.bets.stillPlaying > 0) expect(checkpoint.bets.meanBet).toBe(config.unit);
    }
  });

  it('reports the at-or-above-break-even share and drawdown percentiles', () => {
    const flat = summary.strategies[0];
    expect(flat?.atLeastBreakEvenShare).toBeCloseTo(
      (flat?.profitShare ?? 0) + (flat?.breakEvenShare ?? 0),
      12,
    );
    const drawdowns = all
      .map((simulation) => simulation[0]?.maxDrawdown ?? 0)
      .sort((a, b) => a - b);
    expect(flat?.maxDrawdownPercentiles.median).toBeCloseTo(percentileType7(drawdowns, 0.5), 9);
    expect(flat?.checkpoints[0]?.meanProfitInterval).not.toBeNull();
  });
});
