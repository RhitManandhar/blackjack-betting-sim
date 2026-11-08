import { describe, expect, it } from 'vitest';
import { Rng } from '../simulation/rng';
import { CARD_VALUES, cardsPerDeckOfValue } from './cards';
import {
  buildOrderedCards,
  createShoe,
  createStackedShoe,
  cutCardPosition,
  drawCard,
  reshuffleIfDue,
} from './shoe';

function countValues(cards: Uint8Array): number[] {
  const counts = new Array<number>(11).fill(0);
  for (const card of cards) counts[card] = (counts[card] ?? 0) + 1;
  return counts;
}

describe('buildOrderedCards (spec 8.3, pinned order)', () => {
  it('lays out one deck as A x4, 2 x4 ... 9 x4, then 16 ten-value cards', () => {
    const deck = Array.from(buildOrderedCards(1));
    const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((v) => [v, v, v, v]);
    expected.push(...new Array<number>(16).fill(10));
    expect(deck).toEqual(expected);
  });

  it.each([6, 8])('%i decks repeat the deck and hold the right counts', (decks) => {
    const cards = buildOrderedCards(decks);
    expect(cards.length).toBe(decks * 52);
    const counts = countValues(cards);
    for (const value of CARD_VALUES) expect(counts[value]).toBe(decks * cardsPerDeckOfValue(value));
  });
});

describe('cutCardPosition', () => {
  it.each([
    [312, 75, 234],
    [416, 75, 312],
    [52, 75, 39],
  ])('%i cards at %i%% penetration cut at %i', (total, percent, expected) => {
    expect(cutCardPosition(total, percent)).toBe(expected);
  });
});

describe('createShoe', () => {
  it('is a permutation of the ordered shoe', () => {
    const shoe = createShoe(6, 75, new Rng(1));
    expect(countValues(shoe.cards)).toEqual(countValues(buildOrderedCards(6)));
    expect(shoe.next).toBe(0);
    expect(shoe.cutCard).toBe(234);
  });

  it('is identical for the same seed and different for another seed', () => {
    const a = createShoe(6, 75, new Rng(9));
    const b = createShoe(6, 75, new Rng(9));
    const c = createShoe(6, 75, new Rng(10));
    expect(Array.from(a.cards)).toEqual(Array.from(b.cards));
    expect(Array.from(a.cards)).not.toEqual(Array.from(c.cards));
  });

  it('matches the pinned first ten cards for seed 0 (Fisher-Yates, last index down)', () => {
    const shoe = createShoe(6, 75, new Rng(0));
    expect(Array.from(shoe.cards.subarray(0, 10))).toEqual(PINNED_FIRST_CARDS_SEED_0);
  });
});

describe('reshuffleIfDue (spec 8.3)', () => {
  it('does nothing before the cut card', () => {
    const shoe = createShoe(6, 75, new Rng(2));
    shoe.next = 233;
    expect(reshuffleIfDue(shoe)).toBe(false);
    expect(shoe.next).toBe(233);
  });

  it('reshuffles the whole shoe once the cut card is reached', () => {
    const shoe = createShoe(6, 75, new Rng(2));
    const before = Array.from(shoe.cards);
    shoe.next = 234;
    expect(reshuffleIfDue(shoe)).toBe(true);
    expect(shoe.next).toBe(0);
    expect(Array.from(shoe.cards)).not.toEqual(before);
    expect(countValues(shoe.cards)).toEqual(countValues(buildOrderedCards(6)));
  });
});

describe('stacked shoe', () => {
  it('deals in the given order and never reshuffles', () => {
    const shoe = createStackedShoe([10, 1, 5]);
    expect(reshuffleIfDue(shoe)).toBe(false);
    expect([drawCard(shoe), drawCard(shoe), drawCard(shoe)]).toEqual([10, 1, 5]);
    expect(reshuffleIfDue(shoe)).toBe(false);
  });

  it('throws instead of inventing a card when exhausted', () => {
    const shoe = createStackedShoe([2]);
    drawCard(shoe);
    expect(() => drawCard(shoe)).toThrow(/ran out/);
  });
});

// Pinned: changing the build order, shuffle or RNG changes these and needs a spec version bump.
const PINNED_FIRST_CARDS_SEED_0 = [10, 4, 3, 4, 9, 2, 2, 10, 5, 10];
