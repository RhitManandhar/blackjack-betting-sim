import { ACE, TEN, bestTotal } from '../blackjack/cards';
import { dealerMustHit } from '../blackjack/dealer';

// Exact dealer final-total probabilities for a finite shoe, given the dealer has peeked
// and has no blackjack.
//
// Drawing a particular sequence of cards without replacement has probability
//   product over values v of fallingFactorial(n_v, k_v) / fallingFactorial(N, k),
// which depends only on the multiset of cards drawn, not their order. So each upcard's
// dealer hands are enumerated once as terminal multisets with the number of valid draw
// orders (orders where the dealer stops exactly at the last card and the hole card does
// not make a blackjack). Evaluating a shoe is then one pass over those multisets.

export const DEALER_OUTCOME_SLOTS = 6; // 17, 18, 19, 20, 21, bust
export const DEALER_BUST_SLOT = 5;
const VALUES = 10;
const KEY_BASE = 32;

export interface DealerPatterns {
  readonly upcard: number;
  readonly excludedHole: number;
  readonly slot: Uint8Array;
  readonly orders: Float64Array;
  readonly size: Uint8Array;
  /** Card counts per multiset, VALUES entries each (index value - 1). */
  readonly cardCounts: Uint8Array;
  readonly maxCountOfValue: Uint8Array;
  readonly maxSize: number;
}

export function excludedHoleCard(upcard: number): number {
  if (upcard === ACE) return TEN;
  if (upcard === TEN) return ACE;
  return 0;
}

export function buildDealerPatterns(upcard: number, hitSoft17: boolean): DealerPatterns {
  const excludedHole = excludedHoleCard(upcard);
  const indexByKey = new Map<number, number>();
  const slots: number[] = [];
  const orders: number[] = [];
  const sizes: number[] = [];
  const counts: number[][] = [];
  const current = new Array<number>(VALUES).fill(0);

  const record = (hardSum: number, hasAce: boolean, drawn: number): void => {
    let key = 0;
    for (let index = VALUES - 1; index >= 0; index -= 1)
      key = key * KEY_BASE + (current[index] ?? 0);
    const existing = indexByKey.get(key);
    if (existing !== undefined) {
      orders[existing] = (orders[existing] ?? 0) + 1;
      return;
    }
    indexByKey.set(key, slots.length);
    slots.push(hardSum > 21 ? DEALER_BUST_SLOT : bestTotal(hardSum, hasAce) - 17);
    orders.push(1);
    sizes.push(drawn);
    counts.push([...current]);
  };

  const walk = (hardSum: number, hasAce: boolean, drawn: number): void => {
    if (hardSum > 21 || !dealerMustHit(hardSum, hasAce, hitSoft17)) {
      record(hardSum, hasAce, drawn);
      return;
    }
    for (let value = 1; value <= VALUES; value += 1) {
      if (drawn === 0 && value === excludedHole) continue;
      current[value - 1] = (current[value - 1] ?? 0) + 1;
      walk(hardSum + value, hasAce || value === ACE, drawn + 1);
      current[value - 1] = (current[value - 1] ?? 0) - 1;
    }
  };
  walk(upcard, upcard === ACE, 0);

  const cardCounts = new Uint8Array(slots.length * VALUES);
  const maxCountOfValue = new Uint8Array(VALUES);
  counts.forEach((perValue, multiset) => {
    perValue.forEach((count, index) => {
      cardCounts[multiset * VALUES + index] = count;
      maxCountOfValue[index] = Math.max(maxCountOfValue[index] ?? 0, count);
    });
  });

  return {
    upcard,
    excludedHole,
    slot: Uint8Array.from(slots),
    orders: Float64Array.from(orders),
    size: Uint8Array.from(sizes),
    cardCounts,
    maxCountOfValue,
    maxSize: Math.max(...sizes),
  };
}

/** Scratch buffers reused across evaluations so the solver does not allocate per call. */
export class DealerOutcomeEvaluator {
  readonly outcomes = new Float64Array(DEALER_OUTCOME_SLOTS);
  private readonly fallingByValue: Float64Array;
  private readonly fallingTotal: Float64Array;
  private readonly stride: number;

  constructor(private readonly patterns: DealerPatterns) {
    this.stride = Math.max(...patterns.maxCountOfValue) + 1;
    this.fallingByValue = new Float64Array(VALUES * this.stride);
    this.fallingTotal = new Float64Array(patterns.maxSize + 1);
  }

  /** `counts` is indexed by card value (index 0 unused); `remaining` is their sum. */
  evaluate(counts: Int32Array, remaining: number): Float64Array {
    const { patterns, stride, fallingByValue, fallingTotal, outcomes } = this;

    for (let index = 0; index < VALUES; index += 1) {
      const available = counts[index + 1] ?? 0;
      const maxCount = patterns.maxCountOfValue[index] ?? 0;
      let product = 1;
      fallingByValue[index * stride] = 1;
      for (let k = 1; k <= maxCount; k += 1) {
        product *= Math.max(available - k + 1, 0);
        fallingByValue[index * stride + k] = product;
      }
    }
    let product = 1;
    fallingTotal[0] = 1;
    for (let k = 1; k <= patterns.maxSize; k += 1) {
      product *= remaining - k + 1;
      fallingTotal[k] = product;
    }

    outcomes.fill(0);
    const multisets = patterns.slot.length;
    for (let multiset = 0; multiset < multisets; multiset += 1) {
      let probability = patterns.orders[multiset] ?? 0;
      const base = multiset * VALUES;
      for (let index = 0; index < VALUES; index += 1) {
        const count = patterns.cardCounts[base + index] ?? 0;
        if (count !== 0) probability *= fallingByValue[index * stride + count] ?? 0;
      }
      if (probability === 0) continue;
      const slot = patterns.slot[multiset] ?? 0;
      outcomes[slot] =
        (outcomes[slot] ?? 0) + probability / (fallingTotal[patterns.size[multiset] ?? 0] ?? 1);
    }

    const excluded = patterns.excludedHole;
    if (excluded !== 0) {
      const noBlackjack = (remaining - (counts[excluded] ?? 0)) / remaining;
      for (let slot = 0; slot < DEALER_OUTCOME_SLOTS; slot += 1) {
        outcomes[slot] = (outcomes[slot] ?? 0) / noBlackjack;
      }
    }
    return outcomes;
  }
}
