import { describe, expect, it } from 'vitest';
import { BASELINE_RULES } from '../../shared/defaults';
import type { RuleSet } from '../../shared/schema';
import { assertSupportedRules, doubleAllowedOnTotal, ruleSetKey } from './rules';

describe('assertSupportedRules', () => {
  it.each<Partial<RuleSet>>([
    {},
    { decks: 1 },
    { decks: 2 },
    { decks: 4 },
    { decks: 8 },
    { soft17: 'H17' },
    { doubleAfterSplit: false },
    { blackjackPayout: '6:5' },
    { doubleOn: '9-11' },
    { doubleOn: '10-11' },
    { lateSurrender: true },
    { maxSplitHands: 2 },
    { maxSplitHands: 3 },
    { resplitAces: true },
    { penetrationPercent: 50 },
    { penetrationPercent: 90 },
  ])('accepts %o', (change) => {
    expect(() => {
      assertSupportedRules({ ...BASELINE_RULES, ...change });
    }).not.toThrow();
  });

  it.each([
    { decks: 3 },
    { penetrationPercent: 45 },
    { penetrationPercent: 95 },
    { penetrationPercent: 72 },
  ])('refuses %o', (change) => {
    expect(() => {
      assertSupportedRules({ ...BASELINE_RULES, ...change } as RuleSet);
    }).toThrow(/Unsupported rule set/);
  });
});

describe('doubleAllowedOnTotal (spec 5.3, pinned in 2.6)', () => {
  it.each([
    ['any-two', 5, true],
    ['any-two', 18, true],
    ['9-11', 8, false],
    ['9-11', 9, true],
    ['9-11', 11, true],
    ['9-11', 12, false],
    ['9-11', 19, false], // soft 19 (A,8) is 19, not 9
    ['10-11', 9, false],
    ['10-11', 10, true],
    ['10-11', 11, true],
  ] as const)('%s, total %i -> %s', (doubleOn, total, expected) => {
    expect(doubleAllowedOnTotal({ ...BASELINE_RULES, doubleOn }, total)).toBe(expected);
  });
});

describe('ruleSetKey', () => {
  it('differs whenever any rule differs, including payout and penetration', () => {
    const changes: Partial<RuleSet>[] = [
      {},
      { decks: 8 },
      { soft17: 'H17' },
      { blackjackPayout: '6:5' },
      { doubleAfterSplit: false },
      { doubleOn: '9-11' },
      { lateSurrender: true },
      { maxSplitHands: 3 },
      { resplitAces: true },
      { penetrationPercent: 80 },
    ];
    const keys = new Set(changes.map((change) => ruleSetKey({ ...BASELINE_RULES, ...change })));
    expect(keys.size).toBe(changes.length);
  });
});
