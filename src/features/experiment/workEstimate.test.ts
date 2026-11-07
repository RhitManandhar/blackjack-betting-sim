import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '../../shared/defaults';
import { estimateWork } from './workEstimate';

describe('estimateWork', () => {
  const defaults = createDefaultConfig('test', 1);
  const oneStrategy = defaults.strategies.slice(0, 1);

  it.each([
    { name: 'plan defaults: 5,000 × 5 × 1,000', change: {}, total: 25_000_000, over: false },
    {
      name: 'exactly at budget',
      change: { simulations: 10_000, roundLimit: 10_000, strategies: oneStrategy },
      total: 100_000_000,
      over: false,
    },
    {
      name: 'just over budget',
      change: { simulations: 10_001, roundLimit: 10_000, strategies: oneStrategy },
      total: 100_010_000,
      over: true,
    },
    {
      name: 'maximum caps',
      change: { simulations: 50_000, roundLimit: 10_000 },
      total: 2_500_000_000,
      over: true,
    },
  ])('$name', ({ change, total, over }) => {
    const estimate = estimateWork({ ...defaults, ...change });
    expect(estimate.totalRounds).toBe(total);
    expect(estimate.isOverBudget).toBe(over);
  });
});
