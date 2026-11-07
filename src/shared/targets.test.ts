import { describe, expect, it } from 'vitest';
import { targetAmount, type TargetId } from './targets';

describe('targetAmount (spec 3.1)', () => {
  const cases: readonly { bankroll: number; target: TargetId; expected: number }[] = [
    // Spec table with B = 500.00
    { bankroll: 50_000, target: '0_5x', expected: 25_000 },
    { bankroll: 50_000, target: '1x', expected: 50_000 },
    { bankroll: 50_000, target: '2x', expected: 100_000 },
    { bankroll: 50_000, target: '2_5x', expected: 125_000 },
    // Odd cents round up
    { bankroll: 50_001, target: '0_5x', expected: 25_001 },
    { bankroll: 50_001, target: '2_5x', expected: 125_003 },
    { bankroll: 1, target: '0_5x', expected: 1 },
  ];

  it.each(cases)('$target of $bankroll cents → $expected', ({ bankroll, target, expected }) => {
    expect(targetAmount(bankroll, target)).toBe(expected);
  });
});
