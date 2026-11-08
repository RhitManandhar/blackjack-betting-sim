import { describe, expect, it } from 'vitest';
import { DEFAULT_SETUP, SHARED_SEQUENCE, cents, replay } from './__tests__/replay';
import { flat } from './flat';
import { martingale } from './martingale';
import { oscarsGrind } from './oscarsGrind';
import { paroli1326 } from './paroli1326';
import { paroliClassic } from './paroliClassic';
import type { StrategyStateBase } from './strategy';

// Golden data: spec 7.2-7.8. Rows are [bet, net, profit, bankroll, next] in currency units,
// copied from the spec tables. Every sequence contains blackjacks, doubles and mixed split rounds.

type Row = readonly [bet: number, net: number, profit: number, bankroll: number, next: number];

function expectRows(actual: ReturnType<typeof replay>['rows'], expected: readonly Row[]): void {
  expect(actual).toEqual(
    expected.map(([bet, net, profit, bankroll, next]) => ({
      bet: cents(bet),
      net: cents(net),
      profit: cents(profit),
      bankroll: cents(bankroll),
      next: cents(next),
    })),
  );
}

describe('spec 7.2 Flat (flat-v1)', () => {
  it('replays the shared sequence', () => {
    const result = replay(flat, DEFAULT_SETUP, SHARED_SEQUENCE);
    expectRows(result.rows, [
      [20, 20, 20, 520, 20],
      [20, 30, 50, 550, 20],
      [20, 20, 70, 570, 20],
      [20, 0, 70, 570, 20],
      [20, 40, 110, 610, 20],
      [20, -20, 90, 590, 20],
      [20, 0, 90, 590, 20],
      [20, -40, 50, 550, 20],
      [20, -20, 30, 530, 20],
      [20, 20, 50, 550, 20],
      [20, 20, 70, 570, 20],
      [20, -20, 50, 550, 20],
      [20, 20, 70, 570, 20],
      [20, 30, 100, 600, 20],
    ]);
  });
});

describe('spec 7.3 Martingale (martingale-v1)', () => {
  it('replays the shared sequence, doubling the previous bet rather than the amount lost', () => {
    const result = replay(martingale, DEFAULT_SETUP, SHARED_SEQUENCE);
    expectRows(result.rows, [
      [20, 20, 20, 520, 20],
      [20, 30, 50, 550, 20],
      [20, 20, 70, 570, 20],
      [20, 0, 70, 570, 20],
      [20, 40, 110, 610, 20],
      [20, -20, 90, 590, 40],
      [40, 0, 90, 590, 40],
      [40, -80, 10, 510, 80],
      [80, -80, -70, 430, 160],
      [160, 160, 90, 590, 20],
      [20, 20, 110, 610, 20],
      [20, -20, 90, 590, 40],
      [40, 40, 130, 630, 20],
      [20, 30, 160, 660, 20],
    ]);
  });
});

describe('spec 7.4 Paroli classic (paroli-classic-v1, N = 3)', () => {
  it('replays the shared sequence', () => {
    const result = replay(paroliClassic, DEFAULT_SETUP, SHARED_SEQUENCE);
    expectRows(result.rows, [
      [20, 20, 20, 520, 40],
      [40, 60, 80, 580, 80],
      [80, 80, 160, 660, 20],
      [20, 0, 160, 660, 20],
      [20, 40, 200, 700, 40],
      [40, -40, 160, 660, 20],
      [20, 0, 160, 660, 20],
      [20, -40, 120, 620, 20],
      [20, -20, 100, 600, 20],
      [20, 20, 120, 620, 40],
      [40, 40, 160, 660, 80],
      [80, -80, 80, 580, 20],
      [20, 20, 100, 600, 40],
      [40, 60, 160, 660, 80],
    ]);
    expect(result.states.map((state) => state.consecutiveWins)).toEqual([
      1, 2, 0, 0, 1, 0, 0, 0, 0, 1, 2, 0, 1, 2,
    ]);
  });
});

describe('spec 7.5 Paroli 1-3-2-6 (paroli-1326-v1)', () => {
  it('replays the shared sequence', () => {
    const result = replay(paroli1326, DEFAULT_SETUP, SHARED_SEQUENCE);
    expectRows(result.rows, [
      [20, 20, 20, 520, 60],
      [60, 90, 110, 610, 40],
      [40, 40, 150, 650, 120],
      [120, 0, 150, 650, 120],
      [120, 240, 390, 890, 20],
      [20, -20, 370, 870, 20],
      [20, 0, 370, 870, 20],
      [20, -40, 330, 830, 20],
      [20, -20, 310, 810, 20],
      [20, 20, 330, 830, 60],
      [60, 60, 390, 890, 40],
      [40, -40, 350, 850, 20],
      [20, 20, 370, 870, 60],
      [60, 90, 460, 960, 40],
    ]);
    // "Next step" column: steps 3, 2, 6, 6, 1, ... are indexes 1, 2, 3, 3, 0, ...
    expect(result.states.map((state) => state.stepIndex)).toEqual([
      1, 2, 3, 3, 0, 0, 0, 0, 0, 1, 2, 0, 1, 2,
    ]);
  });
});

describe("spec 7.6 Oscar's Grind (oscars-grind-bj-v1)", () => {
  it('replays the shared sequence', () => {
    const result = replay(oscarsGrind, DEFAULT_SETUP, SHARED_SEQUENCE);
    expectRows(result.rows, [
      [20, 20, 20, 520, 20],
      [20, 30, 50, 550, 20],
      [20, 20, 70, 570, 20],
      [20, 0, 70, 570, 20],
      [20, 40, 110, 610, 20],
      [20, -20, 90, 590, 20],
      [20, 0, 90, 590, 20],
      [20, -40, 50, 550, 20],
      [20, -20, 30, 530, 20],
      [20, 20, 50, 550, 40],
      [40, 40, 90, 590, 40],
      [40, -40, 50, 550, 40],
      [40, 40, 90, 590, 40],
      [40, 60, 150, 650, 20],
    ]);
    expect(result.states.map((state) => state.cycleProfit)).toEqual(
      [0, 0, 0, 0, 0, -20, -20, -60, -80, -60, -20, -60, -20, 0].map(cents),
    );
    expect(result.finalState.minimumOvershootCount).toBe(0);
    expect(result.finalState.minimumOvershootTotal).toBe(0);
  });
});

describe('spec 7.7 totals for the shared sequence', () => {
  it.each([
    ['Flat', flat, 600, 100, 420, 20],
    ['Martingale', martingale, 660, 160, 720, 160],
    ['Paroli classic', paroliClassic, 660, 160, 780, 80],
    ['Paroli 1-3-2-6', paroli1326, 960, 460, 1000, 120],
    ["Oscar's Grind", oscarsGrind, 650, 150, 580, 40],
  ] as const)(
    '%s: final bankroll %i, net %i, wagered %i, max wager %i',
    (_name, strategy, finalBankroll, netProfit, totalWagered, maxWager) => {
      const result = replay<StrategyStateBase>(strategy, DEFAULT_SETUP, SHARED_SEQUENCE);
      expect(result.finalBankroll).toBe(cents(finalBankroll));
      expect(result.netProfit).toBe(cents(netProfit));
      expect(result.totalWagered).toBe(cents(totalWagered));
      expect(result.maxWager).toBe(cents(maxWager));
      expect(result.finalBankroll).toBe(DEFAULT_SETUP.startingBankroll + result.netProfit);
    },
  );
});

describe('spec 7.8 additional transition cases', () => {
  const withParams = (unit: number, tableMinimum: number, paroliStreakLength = 3) => ({
    ...DEFAULT_SETUP,
    params: { unit: cents(unit), tableMinimum: cents(tableMinimum), paroliStreakLength },
  });

  it.each([
    ['T1', paroliClassic, withParams(20, 20, 3), ['W', 'P', 'W', 'W'], [20, 40, 40, 80], 20],
    ['T2', paroliClassic, withParams(20, 20, 2), ['W', 'W', 'W'], [20, 40, 20], 40],
    ['T3', paroliClassic, withParams(20, 20, 3), ['W', 'W', 'L'], [20, 40, 80], 20],
    ['T4', paroli1326, withParams(20, 20), ['W', 'W', 'W', 'L'], [20, 60, 40, 120], 20],
    ['T5', martingale, withParams(20, 20), ['L', 'P', 'L', 'W'], [20, 40, 40, 80], 20],
    ['T6', oscarsGrind, withParams(20, 20), ['L', 'BJ'], [20, 20], 20],
    ['T7', oscarsGrind, withParams(40, 20), ['L', 'BJ'], [40, 40], 20],
    ['T8', oscarsGrind, withParams(20, 20), ['L', 'L', 'L', 'W', 'W'], [20, 20, 20, 20, 40], 20],
  ] as const)('%s', (_id, strategy, setup, outcomes, bets, next) => {
    const result = replay<StrategyStateBase>(strategy, setup, outcomes);
    expect(result.rows.map((row) => row.bet)).toEqual(bets.map(cents));
    expect(result.rows.at(-1)?.next).toBe(cents(next));
  });

  it('T6 records the overshoot: candidate 10.00 is below the 20.00 minimum', () => {
    const setup = withParams(20, 20);
    const result = replay(oscarsGrind, setup, ['L', 'BJ']);
    expect(result.finalState.cycleProfit).toBe(cents(10));
    expect(result.finalState.minimumOvershootCount).toBe(1);
    expect(result.finalState.minimumOvershootTotal).toBe(cents(10));
  });

  it('T7 needs no overshoot when the candidate meets the minimum', () => {
    const result = replay(oscarsGrind, withParams(40, 20), ['L', 'BJ']);
    expect(result.finalState.cycleProfit).toBe(cents(20));
    expect(result.finalState.minimumOvershootCount).toBe(0);
    expect(result.finalState.minimumOvershootTotal).toBe(0);
  });

  it('T8 lowers the bet after a win while the cycle stays open', () => {
    const result = replay(oscarsGrind, withParams(20, 20), ['L', 'L', 'L', 'W', 'W']);
    expect(result.states.map((state) => state.cycleProfit)).toEqual(
      [-20, -40, -60, -40, 0].map(cents),
    );
  });
});
