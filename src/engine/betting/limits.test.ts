import { describe, expect, it } from 'vitest';
import { DEFAULT_SETUP, cents, replay } from './__tests__/replay';
import { checkRequiredBet } from './betCheck';
import { flat } from './flat';
import { martingale } from './martingale';
import { RoundResult, roundResultFromNet } from './roundResult';
import type { StrategyStateBase } from './strategy';

describe('roundResultFromNet (spec 1)', () => {
  it.each([
    [1, RoundResult.Win],
    [3000, RoundResult.Win],
    [0, RoundResult.Push],
    [-1, RoundResult.Loss],
    [-4000, RoundResult.Loss],
  ])('net %i -> %i', (net, expected) => {
    expect(roundResultFromNet(net)).toBe(expected);
  });
});

describe('checkRequiredBet (spec 2.2, D1-D3)', () => {
  it.each([
    // bet, bankroll, table maximum, expected
    [2000, 50_000, null, null],
    [2000, 2000, null, null], // D3: whole bankroll is allowed
    [2001, 2000, null, 'bust'],
    [32_000, 20_000, null, 'bust'], // bust with money left
    [16_000, 50_000, 10_000, 'blocked_table_max'],
    [10_000, 50_000, 10_000, null], // equal to the maximum is allowed
    [32_000, 20_000, 30_000, 'blocked_table_max'], // D2: both broken -> table maximum
  ] as const)('bet %i, bankroll %i, max %s -> %s', (bet, bankroll, tableMaximum, expected) => {
    expect(checkRequiredBet(bet, bankroll, tableMaximum)).toBe(expected);
  });
});

describe('spec 7.9 stop cases X1-X5', () => {
  const setup = (bankroll: number, tableMaximum: number | null) => ({
    ...DEFAULT_SETUP,
    startingBankroll: cents(bankroll),
    tableMaximum: tableMaximum === null ? null : cents(tableMaximum),
  });

  it.each([
    ['X1', martingale, setup(500, null), ['L', 'L', 'L', 'L'], [20, 40, 80, 160], 200, 'bust', 320],
    [
      'X2',
      martingale,
      setup(500, 100),
      ['L', 'L', 'L', 'L'],
      [20, 40, 80],
      360,
      'blocked_table_max',
      160,
    ],
    [
      'X3',
      martingale,
      setup(500, 300),
      ['L', 'L', 'L', 'L'],
      [20, 40, 80, 160],
      200,
      'blocked_table_max',
      320,
    ],
    ['X4', flat, setup(50, null), ['L', 'L', 'L'], [20, 20], 10, 'bust', 20],
  ] as const)('%s', (_id, strategy, testSetup, outcomes, bets, bankroll, reason, requiredBet) => {
    const result = replay<StrategyStateBase>(strategy, testSetup, outcomes);
    expect(result.rows.map((row) => row.bet)).toEqual(bets.map(cents));
    expect(result.finalBankroll).toBe(cents(bankroll));
    expect(result.stop).toEqual({ reason, requiredBet: cents(requiredBet) });
  });

  it('X5: a bet equal to the remaining bankroll is placed', () => {
    const result = replay(flat, setup(40, null), ['L', 'W']);
    expect(result.rows.map((row) => row.bet)).toEqual([cents(20), cents(20)]);
    expect(result.rows[1]?.bankroll).toBe(cents(40));
    expect(result.stop).toBeNull();
  });
});
