import { describe, expect, it } from 'vitest';
import { bestTotal, isNaturalPair, isSoft } from './cards';

// Hands are tracked as a hard sum (every ace counted as 1) plus whether an ace is present.
describe('hand totals (spec 5.3)', () => {
  it.each([
    // cards, hard sum, has ace, best total, soft
    ['10,6', 16, false, 16, false],
    ['A,6', 7, true, 17, true],
    ['A,A', 2, true, 12, true],
    ['A,A,9', 11, true, 21, true],
    ['A,6,10', 17, true, 17, false],
    ['A,A,A,8', 11, true, 21, true],
    ['A,5,5,A', 12, true, 12, false],
    ['A,10', 11, true, 21, true],
    ['10,10,2', 22, false, 22, false],
    ['A,A,10,10', 22, true, 22, false],
  ])('%s: best %i', (_cards, hardSum, hasAce, best, soft) => {
    expect(bestTotal(hardSum, hasAce)).toBe(best);
    expect(isSoft(hardSum, hasAce)).toBe(soft);
  });
});

describe('isNaturalPair', () => {
  it.each([
    [1, 10, true],
    [10, 1, true],
    [1, 1, false],
    [10, 10, false],
    [5, 6, false],
    [2, 9, false],
  ])('%i,%i -> %s', (first, second, expected) => {
    expect(isNaturalPair(first, second)).toBe(expected);
  });
});
