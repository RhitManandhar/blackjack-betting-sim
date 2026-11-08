import type { RuleSet } from '../../shared/schema';
import { ACE, TEN, bestTotal, cardsPerDeckOfValue } from '../blackjack/cards';
import { assertSupportedRules, doubleAllowedOnTotal, ruleSetKey } from '../blackjack/rules';
import { SURRENDER_EV } from './decision';
import {
  DEALER_BUST_SLOT,
  DealerOutcomeEvaluator,
  type DealerPatterns,
  buildDealerPatterns,
} from './dealerOutcomes';
import {
  type StrategyTable,
  UPCARDS,
  cellIndex,
  createEmptyTable,
  hardRow,
  pairCellIndex,
  softRow,
} from './table';

// Expected-value solver for total-dependent basic strategy (spec 6.1, pins P3-P5 in spec 2.2).
//
// - Card removal is exact: EVs use the shoe minus the dealer upcard and every player card
//   in the hand so far, recalculated after each further card.
// - The dealer has peeked: with an ace or ten up, the hole card is conditioned on no blackjack.
// - A total cell's EV is the average over all two-card hands making that total, weighted by
//   the probability of being dealt each one from the shoe minus the upcard.
// - Split EV uses the standard resplit approximation (P4): the shoe minus the upcard and both
//   pair cards, a fixed probability of drawing another pair card, and the expected number of
//   finished hands and of hands left unsplit once the hand limit is reached.
// - Spec 2.6: the cells store the raw EV of doubling; whether a double is legal (doubling
//   restriction, double after split) is decided per hand at play time. The pair decision's
//   "not splitting" value respects those rules and includes late surrender (EV −0.5) when on.
//
// Plain floating point is correct here: these are probabilities, never money.

const CARD_VALUE_COUNT = 11; // index 0 unused
const KEY_BASE = 22; // more than the most cards of one value a non-busted hand can hold

const KEY_WEIGHTS: readonly number[] = Array.from({ length: CARD_VALUE_COUNT }, (_, value) =>
  value === 0 ? 0 : KEY_BASE ** (value - 1),
);

function keyWeight(value: number): number {
  return KEY_WEIGHTS[value] ?? 0;
}

const patternCache = new Map<string, DealerPatterns>();

function getDealerPatterns(upcard: number, hitSoft17: boolean): DealerPatterns {
  const key = `${upcard}|${hitSoft17 ? 'H17' : 'S17'}`;
  let patterns = patternCache.get(key);
  if (patterns === undefined) {
    patterns = buildDealerPatterns(upcard, hitSoft17);
    patternCache.set(key, patterns);
  }
  return patterns;
}

class SolverContext {
  readonly counts = new Int32Array(CARD_VALUE_COUNT);
  remaining = 0;
  private readonly dealer: DealerOutcomeEvaluator;
  private readonly standMemo = new Map<number, number>();
  private readonly playOnMemo = new Map<number, number>();

  constructor(decks: number, upcard: number, hitSoft17: boolean) {
    this.dealer = new DealerOutcomeEvaluator(getDealerPatterns(upcard, hitSoft17));
    for (let value = 1; value <= 10; value += 1) {
      this.counts[value] = decks * cardsPerDeckOfValue(value);
    }
    this.remaining = decks * 52;
    this.remove(upcard);
  }

  count(value: number): number {
    return this.counts[value] ?? 0;
  }

  remove(value: number): void {
    this.counts[value] = this.count(value) - 1;
    this.remaining -= 1;
  }

  restore(value: number): void {
    this.counts[value] = this.count(value) + 1;
    this.remaining += 1;
  }

  /** Memos are valid only while the removed cards outside the hand stay the same. */
  resetMemos(): void {
    this.standMemo.clear();
    this.playOnMemo.clear();
  }

  /** EV of standing on `total`. `handKey` identifies the hand's cards for memoisation. */
  standEv(total: number, handKey: number): number {
    const cached = this.standMemo.get(handKey);
    if (cached !== undefined) return cached;
    const outcomes = this.dealer.evaluate(this.counts, this.remaining);
    const dealerBust = outcomes[DEALER_BUST_SLOT] ?? 0;
    let ev = dealerBust;
    for (let slot = 0; slot < DEALER_BUST_SLOT; slot += 1) {
      const dealerTotal = 17 + slot;
      const probability = outcomes[slot] ?? 0;
      if (total > dealerTotal) ev += probability;
      else if (total < dealerTotal) ev -= probability;
    }
    this.standMemo.set(handKey, ev);
    return ev;
  }

  /** EV of the best of stand and hit, with no double, for the current hand. */
  playOnEv(hardSum: number, hasAce: boolean, handKey: number): number {
    const cached = this.playOnMemo.get(handKey);
    if (cached !== undefined) return cached;
    const total = bestTotal(hardSum, hasAce);
    const stand = this.standEv(total, handKey);
    const ev = total === 21 ? stand : Math.max(stand, this.hitEv(hardSum, hasAce, handKey));
    this.playOnMemo.set(handKey, ev);
    return ev;
  }

  hitEv(hardSum: number, hasAce: boolean, handKey: number): number {
    let ev = 0;
    const remaining = this.remaining;
    for (let value = 1; value <= 10; value += 1) {
      const available = this.count(value);
      if (available === 0) continue;
      const probability = available / remaining;
      const nextHard = hardSum + value;
      if (nextHard > 21) {
        ev -= probability;
        continue;
      }
      this.remove(value);
      ev +=
        probability * this.playOnEv(nextHard, hasAce || value === ACE, handKey + keyWeight(value));
      this.restore(value);
    }
    return ev;
  }

  doubleEv(hardSum: number, hasAce: boolean, handKey: number): number {
    let ev = 0;
    const remaining = this.remaining;
    for (let value = 1; value <= 10; value += 1) {
      const available = this.count(value);
      if (available === 0) continue;
      const probability = available / remaining;
      const nextHard = hardSum + value;
      if (nextHard > 21) {
        ev -= probability;
        continue;
      }
      this.remove(value);
      ev +=
        probability *
        this.standEv(bestTotal(nextHard, hasAce || value === ACE), handKey + keyWeight(value));
      this.restore(value);
    }
    return 2 * ev;
  }
}

interface ActionEvs {
  stand: number;
  hit: number;
  double: number;
}

function twoCardEvs(context: SolverContext, first: number, second: number): ActionEvs {
  context.remove(first);
  context.remove(second);
  const hardSum = first + second;
  const hasAce = first === ACE || second === ACE;
  const handKey = keyWeight(first) + keyWeight(second);
  const evs = {
    stand: context.standEv(bestTotal(hardSum, hasAce), handKey),
    hit: context.hitEv(hardSum, hasAce, handKey),
    double: context.doubleEv(hardSum, hasAce, handKey),
  };
  context.restore(second);
  context.restore(first);
  return evs;
}

/** Best EV of playing the initial two-card pair unsplit, never surrendering. */
function unsplitPairEvWithoutSurrender(rules: RuleSet, pairValue: number, evs: ActionEvs): number {
  const total = bestTotal(2 * pairValue, pairValue === ACE);
  const best = Math.max(evs.stand, evs.hit);
  return doubleAllowedOnTotal(rules, total) ? Math.max(best, evs.double) : best;
}

/** Fills the stand, hit and double cells and the no-split pair EVs for one upcard. */
function solveTotals(
  table: StrategyTable,
  context: SolverContext,
  upcard: number,
  rules: RuleSet,
): void {
  const weights = new Float64Array(table.stand.length);
  const accumulate = (row: number, weight: number, evs: ActionEvs): void => {
    const index = cellIndex(row, upcard);
    weights[index] = (weights[index] ?? 0) + weight;
    table.stand[index] = (table.stand[index] ?? 0) + weight * evs.stand;
    table.hit[index] = (table.hit[index] ?? 0) + weight * evs.hit;
    table.double[index] = (table.double[index] ?? 0) + weight * evs.double;
  };

  context.resetMemos();
  for (let first = 1; first <= 10; first += 1) {
    for (let second = first; second <= 10; second += 1) {
      if (first === ACE && second === TEN) continue; // a natural is never a decision
      const firstCount = context.count(first);
      const weight =
        first === second ? firstCount * (firstCount - 1) : 2 * firstCount * context.count(second);
      if (weight === 0) continue;
      const evs = twoCardEvs(context, first, second);
      const hasAce = first === ACE;
      const row = hasAce ? softRow(first + second + 10) : hardRow(first + second);
      accumulate(row, weight, evs);
      if (first === second) {
        const index = pairCellIndex(first, upcard);
        const withoutSurrender = unsplitPairEvWithoutSurrender(rules, first, evs);
        table.noSplitWithoutSurrender[index] = withoutSurrender;
        table.noSplit[index] = rules.lateSurrender
          ? Math.max(withoutSurrender, SURRENDER_EV)
          : withoutSurrender;
      }
    }
  }

  for (let index = 0; index < weights.length; index += 1) {
    const weight = weights[index] ?? 0;
    if (weight === 0) continue;
    table.stand[index] = (table.stand[index] ?? 0) / weight;
    table.hit[index] = (table.hit[index] ?? 0) / weight;
    table.double[index] = (table.double[index] ?? 0) / weight;
  }
}

/**
 * Expected numbers of [finished non-pair hands, hands left as an unsplit pair] when splitting,
 * with `splitsLeft` further splits allowed and probability `pairChance` of drawing a pair card.
 */
export function expectedSplitHands(pairChance: number, splitsLeft: number): [number, number] {
  const solve = (pending: number, splits: number): [number, number] => {
    if (pending === 0) return [0, 0];
    const [finishedA, unsplitA] = solve(pending - 1, splits);
    const noPair: [number, number] = [finishedA + 1, unsplitA];
    const pair: [number, number] =
      splits > 0 ? solve(pending + 1, splits - 1) : [finishedA, unsplitA + 1];
    return [
      (1 - pairChance) * noPair[0] + pairChance * pair[0],
      (1 - pairChance) * noPair[1] + pairChance * pair[1],
    ];
  };
  return solve(2, splitsLeft);
}

/** EV of one post-split hand after its second card; aces get one card, doubling needs DAS. */
function postSplitHandEv(
  context: SolverContext,
  pairValue: number,
  second: number,
  rules: RuleSet,
): number {
  context.remove(second);
  const hardSum = pairValue + second;
  const hasAce = pairValue === ACE || second === ACE;
  const handKey = keyWeight(pairValue) + keyWeight(second);
  const stand = context.standEv(bestTotal(hardSum, hasAce), handKey);
  let ev = stand;
  if (pairValue !== ACE) {
    ev = Math.max(stand, context.hitEv(hardSum, hasAce, handKey));
    if (rules.doubleAfterSplit && doubleAllowedOnTotal(rules, bestTotal(hardSum, hasAce))) {
      ev = Math.max(ev, context.doubleEv(hardSum, hasAce, handKey));
    }
  }
  context.restore(second);
  return ev;
}

function solveSplit(
  table: StrategyTable,
  context: SolverContext,
  upcard: number,
  pairValue: number,
  rules: RuleSet,
): void {
  // Remove both pair cards: the other hand's card stays out of the shoe, this hand's is in its key.
  context.remove(pairValue);
  context.remove(pairValue);
  context.resetMemos();

  const pairCount = context.count(pairValue);
  const nonPairRemaining = context.remaining - pairCount;
  let finishedEv = 0;
  for (let second = 1; second <= 10; second += 1) {
    if (second === pairValue) continue;
    const available = context.count(second);
    if (available === 0) continue;
    finishedEv +=
      (available / nonPairRemaining) * postSplitHandEv(context, pairValue, second, rules);
  }
  const unsplitEv = pairCount > 0 ? postSplitHandEv(context, pairValue, pairValue, rules) : 0;

  const splitsLeft = pairValue === ACE && !rules.resplitAces ? 0 : rules.maxSplitHands - 2;
  const [finishedHands, unsplitHands] = expectedSplitHands(
    pairCount / context.remaining,
    splitsLeft,
  );
  table.split[pairCellIndex(pairValue, upcard)] =
    finishedHands * finishedEv + unsplitHands * unsplitEv;

  context.restore(pairValue);
  context.restore(pairValue);
}

export function solveStrategyTable(rules: RuleSet): StrategyTable {
  assertSupportedRules(rules);
  const table = createEmptyTable(ruleSetKey(rules));
  for (let upcard = 1; upcard <= UPCARDS; upcard += 1) {
    const context = new SolverContext(rules.decks, upcard, rules.soft17 === 'H17');
    solveTotals(table, context, upcard, rules);
    for (let pairValue = 1; pairValue <= 10; pairValue += 1) {
      solveSplit(table, context, upcard, pairValue, rules);
    }
  }
  return table;
}

const tableCache = new Map<string, StrategyTable>();

/** Generated once per rule set and cached by its canonical key (spec 6.1). */
export function getStrategyTable(rules: RuleSet): StrategyTable {
  const key = ruleSetKey(rules);
  const cached = tableCache.get(key);
  if (cached !== undefined) return cached;
  const table = solveStrategyTable(rules);
  tableCache.set(key, table);
  return table;
}
