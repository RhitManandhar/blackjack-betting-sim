import { describe, expect, it } from 'vitest';
import { STRATEGIES, STRATEGY_IDS } from '../../shared/strategies';
import { BETTING_STRATEGIES, getBettingStrategy } from './registry';

describe('strategy registry', () => {
  it.each(STRATEGY_IDS)('%s is registered with the id and version from spec 4.2', (id) => {
    const strategy = getBettingStrategy(id);
    expect(strategy.id).toBe(id);
    expect(strategy.version).toBe(STRATEGIES[id].version);
    expect(strategy.version).toMatch(/-v\d+$/);
  });

  it('registers exactly the strategy ids', () => {
    expect(Object.keys(BETTING_STRATEGIES).sort()).toEqual([...STRATEGY_IDS].sort());
  });

  it('keeps Paroli classic and 1-3-2-6 as separate implementations', () => {
    const classic = getBettingStrategy('paroli-classic');
    const sequence = getBettingStrategy('paroli-1326');
    const params = { unit: 2000, tableMinimum: 2000, paroliStreakLength: 3 };
    expect(classic).not.toBe(sequence);
    expect(Object.keys(classic.createState(params))).toContain('consecutiveWins');
    expect(Object.keys(classic.createState(params))).not.toContain('stepIndex');
    expect(Object.keys(sequence.createState(params))).toContain('stepIndex');
    expect(Object.keys(sequence.createState(params))).not.toContain('consecutiveWins');
  });
});

describe('"About this system" text (CLAUDE.md rule 7)', () => {
  const FORBIDDEN =
    /\b(win(s|ning)? (system|strategy)|guarantee\w*|beat(s|ing)? the (house|casino)|sure|risk[- ]free|always (wins|profits?))\b/i;

  it.each(STRATEGY_IDS)('%s has a rule and a main risk with neutral wording', (id) => {
    const { rule, mainRisk } = STRATEGIES[id];
    expect(rule.length).toBeGreaterThan(20);
    expect(mainRisk.length).toBeGreaterThan(20);
    expect(rule).not.toMatch(FORBIDDEN);
    expect(mainRisk).not.toMatch(FORBIDDEN);
  });
});
