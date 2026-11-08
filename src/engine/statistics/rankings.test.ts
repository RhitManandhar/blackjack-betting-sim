import { describe, expect, it } from 'vitest';
import type { StrategyId } from '../../shared/strategies';
import { rankByGoal } from './rankings';
import type { StrategySummary } from './summary';

// Minimal summaries carrying only what rankings read.
function summary(
  strategyId: StrategyId,
  fields: {
    rpuw?: [number, number, number];
    breakEven?: [number, number, number];
    p75?: number;
    hit1x?: [number, number, number];
    checkpoint?: [number, number, number] | null;
  },
): StrategySummary {
  const interval = (triple?: [number, number, number]) =>
    triple === undefined ? { low: 0, high: 0 } : { low: triple[1], high: triple[2] };
  return {
    strategyId,
    returnPerUnitWagered: fields.rpuw?.[0] ?? 0,
    returnPerUnitWageredInterval: interval(fields.rpuw),
    atLeastBreakEvenShare: fields.breakEven?.[0] ?? 0,
    atLeastBreakEvenInterval: interval(fields.breakEven),
    profitPercentiles: { p5: 0, p25: 0, median: 0, p75: fields.p75 ?? 0, p95: 0 },
    targets: ['0_5x', '1x', '2x', '2_5x'].map((target) => ({
      target,
      hitRate: target === '1x' ? (fields.hit1x?.[0] ?? 0) : 0,
      hitRateInterval: target === '1x' ? interval(fields.hit1x) : { low: 0, high: 0 },
    })),
    checkpoints:
      fields.checkpoint === null
        ? []
        : [
            {
              meanProfit: fields.checkpoint?.[0] ?? 0,
              meanProfitInterval: interval(fields.checkpoint ?? undefined),
            },
          ],
  } as unknown as StrategySummary;
}

describe('rankByGoal (spec 2.7)', () => {
  it('overall: ranks by return per unit wagered and marks overlapping intervals inconclusive', () => {
    const ranking = rankByGoal(
      [
        summary('flat', { rpuw: [-0.005, -0.007, -0.003] }),
        summary('martingale', { rpuw: [-0.004, -0.009, 0.001] }),
        summary('paroli-1326', { rpuw: [-0.02, -0.024, -0.016] }),
      ],
      'overall',
    );
    expect(ranking.entries.map((entry) => [entry.strategyId, entry.verdict])).toEqual([
      ['martingale', 'leader'],
      ['flat', 'inconclusive'],
      ['paroli-1326', 'behind'],
    ]);
    expect(ranking.clearLeader).toBe(false);
  });

  it('declares a clear leader only when every other interval is below it', () => {
    const ranking = rankByGoal(
      [
        summary('flat', { breakEven: [0.6, 0.58, 0.62] }),
        summary('martingale', { breakEven: [0.8, 0.78, 0.82] }),
      ],
      'minimal_loss',
    );
    expect(ranking.entries[0]?.strategyId).toBe('martingale');
    expect(ranking.clearLeader).toBe(true);
  });

  it('gives no verdict for a percentile, which has no interval', () => {
    const ranking = rankByGoal(
      [summary('flat', { p75: 1000 }), summary('martingale', { p75: 3000 })],
      'maximum_win',
    );
    expect(ranking.entries.map((entry) => entry.verdict)).toEqual(['leader', 'no_interval']);
    expect(ranking.clearLeader).toBe(false);
  });

  it('ranks the chosen target and checkpoint, skipping strategies without the data', () => {
    const target = rankByGoal(
      [
        summary('flat', { hit1x: [0.1, 0.08, 0.12] }),
        summary('martingale', { hit1x: [0.3, 0.28, 0.32] }),
      ],
      'target',
      { target: '1x' },
    );
    expect(target.entries[0]?.strategyId).toBe('martingale');
    const checkpoint = rankByGoal(
      [
        summary('flat', { checkpoint: [-500, -900, -100] }),
        summary('martingale', { checkpoint: null }),
      ],
      'checkpoint',
      { checkpointIndex: 0 },
    );
    expect(checkpoint.entries.map((entry) => entry.strategyId)).toEqual(['flat']);
  });

  it('treats an exact tie as inconclusive and keeps configuration order', () => {
    const ranking = rankByGoal(
      [
        summary('flat', { rpuw: [-0.01, -0.01, -0.01] }),
        summary('martingale', { rpuw: [-0.01, -0.01, -0.01] }),
      ],
      'overall',
    );
    expect(ranking.entries.map((entry) => [entry.strategyId, entry.verdict])).toEqual([
      ['flat', 'leader'],
      ['martingale', 'inconclusive'],
    ]);
  });
});
