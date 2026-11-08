import { describe, expect, it } from 'vitest';
import { BASELINE_RULES } from '../../shared/defaults';
import type { RuleSet } from '../../shared/schema';
import { assertTier1Rules, ruleSetKey } from './rules';

describe('assertTier1Rules', () => {
  it.each<Partial<RuleSet>>([
    {},
    { decks: 8 },
    { soft17: 'H17' },
    { doubleAfterSplit: false },
    { blackjackPayout: '6:5' },
  ])('accepts Tier 1 rule set %o', (change) => {
    expect(() => {
      assertTier1Rules({ ...BASELINE_RULES, ...change });
    }).not.toThrow();
  });

  it.each<Partial<RuleSet>>([
    { decks: 1 },
    { decks: 2 },
    { decks: 4 },
    { doubleOn: '9-11' },
    { lateSurrender: true },
    { maxSplitHands: 2 },
    { resplitAces: true },
  ])('refuses non-Tier-1 rule set %o', (change) => {
    expect(() => {
      assertTier1Rules({ ...BASELINE_RULES, ...change });
    }).toThrow(/outside Tier 1/);
  });
});

describe('ruleSetKey', () => {
  it('differs whenever any rule differs, including the payout', () => {
    const keys = new Set([
      ruleSetKey(BASELINE_RULES),
      ruleSetKey({ ...BASELINE_RULES, decks: 8 }),
      ruleSetKey({ ...BASELINE_RULES, soft17: 'H17' }),
      ruleSetKey({ ...BASELINE_RULES, blackjackPayout: '6:5' }),
      ruleSetKey({ ...BASELINE_RULES, doubleAfterSplit: false }),
    ]);
    expect(keys.size).toBe(5);
  });
});
