import { describe, expect, it } from 'vitest';
import { BASELINE_RULES } from '../../shared/defaults';
import type { RuleSet } from '../../shared/schema';
import { Rng } from '../simulation/rng';
import {
  Outcome,
  type RoundContext,
  createRoundContext,
  createRoundResult,
  playRound,
} from './round';
import { createShoe, createStackedShoe } from './shoe';

// Spec 5.6 golden cases G1-G12 and 7.10 funds-short cases F1-F2, card-exact.
// Stacked shoe order: player card, dealer upcard, player card, dealer hole card, then draws.
// Money in cents: a 20.00 bet is 2000.

const contexts = new Map<string, RoundContext>();
function contextFor(change: Partial<RuleSet> = {}): RoundContext {
  const rules = { ...BASELINE_RULES, ...change };
  const key = JSON.stringify(rules);
  let context = contexts.get(key);
  if (context === undefined) {
    context = createRoundContext(rules);
    contexts.set(key, context);
  }
  return context;
}

interface Case {
  id: string;
  situation: string;
  cards: number[];
  rules?: Partial<RuleSet>;
  bet?: number;
  bankroll?: number;
  netProfit: number;
  totalWagered: number;
  outcome: Outcome;
  unavailable?: number;
  /** Cards dealt, when the stacked shoe deliberately holds more than the round uses. */
  cardsUsed?: number;
}

const CASES: Case[] = [
  {
    id: 'G1',
    situation: 'player natural, dealer 9,7 (no peek)',
    cards: [1, 9, 10, 7],
    netProfit: 3000,
    totalWagered: 2000,
    outcome: Outcome.Blackjack,
  },
  {
    id: 'G2',
    situation: 'player natural at 6:5',
    cards: [1, 9, 10, 7],
    rules: { blackjackPayout: '6:5' },
    netProfit: 2400,
    totalWagered: 2000,
    outcome: Outcome.Blackjack,
  },
  {
    id: 'G3',
    situation: 'player natural, dealer natural',
    cards: [1, 1, 10, 10],
    netProfit: 0,
    totalWagered: 2000,
    outcome: Outcome.Push,
  },
  {
    id: 'G4',
    situation: 'dealer natural after peek, player 20',
    cards: [10, 10, 10, 1],
    netProfit: -2000,
    totalWagered: 2000,
    outcome: Outcome.Loss,
  },
  {
    id: 'G5',
    situation: 'dealer natural after peek, player 8,8 never gets to split',
    cards: [8, 1, 8, 10],
    netProfit: -2000,
    totalWagered: 2000,
    outcome: Outcome.Loss,
  },
  {
    id: 'G6',
    situation: 'player 20, dealer 20',
    cards: [10, 10, 10, 10],
    netProfit: 0,
    totalWagered: 2000,
    outcome: Outcome.Push,
  },
  {
    id: 'G7',
    situation: 'split 8s vs 7: first hand 8,5,10 busts, second 8,10; dealer 7,5,10 busts',
    cards: [8, 7, 8, 5, 5, 10, 10, 10],
    netProfit: 0,
    totalWagered: 4000,
    outcome: Outcome.Push,
  },
  {
    id: 'G8',
    situation: 'double 6,5 vs 6, draws 10; dealer 6,10,4 = 20',
    cards: [6, 6, 5, 10, 10, 4],
    netProfit: 4000,
    totalWagered: 4000,
    outcome: Outcome.Win,
  },
  {
    id: 'G9',
    situation: 'split 8s vs 7: 8,10 wins, 8,6,10 busts; dealer 17',
    cards: [8, 7, 8, 10, 10, 6, 10],
    netProfit: 0,
    totalWagered: 4000,
    outcome: Outcome.Push,
  },
  {
    id: 'G10',
    situation: 'split 8s vs 6, double 8,3 (DAS) to 21, other 8,10 loses to dealer 20',
    cards: [8, 6, 8, 10, 3, 10, 10, 4],
    netProfit: 2000,
    totalWagered: 6000,
    outcome: Outcome.Win,
  },
  {
    id: 'G11',
    situation: 'split aces vs 10: A,10 = 21 paid 1:1, A,9 pushes dealer 20',
    cards: [1, 10, 1, 10, 10, 9],
    netProfit: 2000,
    totalWagered: 4000,
    outcome: Outcome.Win,
  },
  {
    id: 'G12-S17',
    situation: 'player 18 vs dealer 6,A: S17 stands on soft 17',
    cards: [10, 6, 8, 1, 4],
    cardsUsed: 4,
    netProfit: 2000,
    totalWagered: 2000,
    outcome: Outcome.Win,
  },
  {
    id: 'G12-H17',
    situation: 'player 18 vs dealer 6,A: H17 hits soft 17 to 21',
    cards: [10, 6, 8, 1, 4],
    rules: { soft17: 'H17' },
    netProfit: -2000,
    totalWagered: 2000,
    outcome: Outcome.Loss,
  },
  {
    id: 'F1',
    situation: 'bankroll 200, bet 160, hard 11 vs 6 cannot double: hits to 21, dealer 18',
    cards: [6, 6, 5, 10, 10, 2],
    bet: 16_000,
    bankroll: 20_000,
    netProfit: 16_000,
    totalWagered: 16_000,
    outcome: Outcome.Win,
    unavailable: 1,
  },
  {
    id: 'F2',
    situation: 'bankroll 30, bet 20, 8,8 vs 10 cannot split: hard 16 hits and busts',
    cards: [8, 10, 8, 7, 10],
    bankroll: 3000,
    netProfit: -2000,
    totalWagered: 2000,
    outcome: Outcome.Loss,
    unavailable: 1,
  },
  {
    id: 'X1',
    situation: 'resplit 8s vs 6 to the 4-hand limit; the fourth pair plays as 16 and stands',
    cards: [8, 6, 8, 10, 8, 8, 8, 10, 10, 10, 10],
    netProfit: 8000,
    totalWagered: 8000,
    outcome: Outcome.Win,
  },
  {
    id: 'X2',
    situation: 'no DAS: split 8s vs 6, 8,3 must hit (not counted as unavailable)',
    cards: [8, 6, 8, 10, 3, 10, 10, 4],
    rules: { doubleAfterSplit: false },
    netProfit: 0,
    totalWagered: 4000,
    outcome: Outcome.Push,
  },
  {
    id: 'X3',
    situation: 'player 10,6 vs dealer 10,7 hits 16 and busts; dealer draws nothing',
    cards: [10, 10, 6, 7, 10],
    netProfit: -2000,
    totalWagered: 2000,
    outcome: Outcome.Loss,
  },
  {
    id: 'X4',
    situation: 'soft 18 vs 4 doubles; A,7,2 = 21 beats dealer 4,10,5 = 19',
    cards: [1, 4, 7, 10, 2, 5],
    netProfit: 4000,
    totalWagered: 4000,
    outcome: Outcome.Win,
  },
  {
    id: 'X5',
    situation: 'odd bet natural rounds down: 25.01 at 3:2 pays 37.51',
    cards: [10, 9, 1, 7],
    bet: 2501,
    netProfit: 3751,
    totalWagered: 2501,
    outcome: Outcome.Blackjack,
  },
  {
    id: 'X6',
    situation: 'odd bet natural rounds down: 20.01 at 6:5 pays 24.01',
    cards: [10, 9, 1, 7],
    rules: { blackjackPayout: '6:5' },
    bet: 2001,
    netProfit: 2401,
    totalWagered: 2001,
    outcome: Outcome.Blackjack,
  },
];

describe('playRound golden cases (spec 5.6, 7.10)', () => {
  it.each(CASES)('$id: $situation', (testCase) => {
    const shoe = createStackedShoe(testCase.cards);
    const result = createRoundResult();
    playRound(
      contextFor(testCase.rules),
      shoe,
      testCase.bet ?? 2000,
      testCase.bankroll ?? 50_000,
      result,
    );
    expect(result.netProfit).toBe(testCase.netProfit);
    expect(result.totalWagered).toBe(testCase.totalWagered);
    expect(result.outcome).toBe(testCase.outcome);
    expect(result.unavailableActions).toBe(testCase.unavailable ?? 0);
    expect(shoe.next).toBe(testCase.cardsUsed ?? testCase.cards.length);
  });
});

describe('playRound guards', () => {
  it.each([
    [0, 50_000],
    [-100, 50_000],
    [20.5, 50_000],
    [60_000, 50_000],
  ])('rejects bet %d with bankroll %d', (bet, bankroll) => {
    const shoe = createStackedShoe([10, 10, 10, 10]);
    expect(() => {
      playRound(contextFor(), shoe, bet, bankroll, createRoundResult());
    }).toThrow(RangeError);
  });

  it('allows a bet equal to the whole bankroll (D3)', () => {
    const result = createRoundResult();
    playRound(contextFor(), createStackedShoe([10, 10, 10, 10]), 2000, 2000, result);
    expect(result.netProfit).toBe(0);
  });
});

describe('playRound with a real shoe', () => {
  it('reshuffles only before a round, once the cut card is reached', () => {
    const context = contextFor();
    const shoe = createShoe(6, 75, new Rng(123));
    const result = createRoundResult();
    let reshuffles = 0;
    for (let round = 0; round < 2000; round += 1) {
      const before = shoe.next;
      playRound(context, shoe, 2000, 1_000_000, result);
      if (result.reshuffled) {
        expect(before).toBeGreaterThanOrEqual(234);
        reshuffles += 1;
      } else {
        expect(before).toBeLessThan(234);
      }
    }
    expect(reshuffles).toBeGreaterThan(0);
  });

  it('is deterministic for the same seed', () => {
    const run = (): number[] => {
      const context = contextFor();
      const shoe = createShoe(6, 75, new Rng(77));
      const result = createRoundResult();
      const nets: number[] = [];
      for (let round = 0; round < 500; round += 1) {
        playRound(context, shoe, 2000, 1_000_000, result);
        nets.push(result.netProfit);
      }
      return nets;
    };
    expect(run()).toEqual(run());
  });

  it('keeps every result an integer, with wagers in whole bets and outcome matching the sign', () => {
    const context = contextFor();
    const shoe = createShoe(6, 75, new Rng(5));
    const result = createRoundResult();
    for (let round = 0; round < 5000; round += 1) {
      playRound(context, shoe, 2000, 1_000_000, result);
      expect(Number.isSafeInteger(result.netProfit)).toBe(true);
      expect(result.totalWagered % 2000).toBe(0);
      expect(result.totalWagered).toBeLessThanOrEqual(8 * 2000);
      expect(Math.abs(result.netProfit)).toBeLessThanOrEqual(result.totalWagered * 1.5);
      if (result.netProfit > 0) expect([Outcome.Win, Outcome.Blackjack]).toContain(result.outcome);
      if (result.netProfit < 0) expect(result.outcome).toBe(Outcome.Loss);
      if (result.netProfit === 0) expect(result.outcome).toBe(Outcome.Push);
    }
  });
});
