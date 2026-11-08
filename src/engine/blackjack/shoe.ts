import type { Rng } from '../simulation/rng';
import { CARDS_PER_DECK, TEN } from './cards';

// Spec 8.3 with the pins from spec 2.2:
// - fixed build order: deck by deck, ranks A, 2..10, J, Q, K, four cards of each rank;
// - Fisher-Yates from the last index down, j = rng.nextBelow(i + 1);
// - a reshuffle shuffles the current card array in place with the same RNG stream;
// - the reshuffle check runs only before a round, never in the middle of one.
// Pinned in spec 2.6: if a small shoe runs out during a round, the discards (cards dealt in
// earlier rounds since the last shuffle, never the cards of the current round) are shuffled in
// their own positions with the same RNG, dealing continues from them, and the whole shoe is
// reshuffled before the next round.

const RANKS_PER_DECK = 13;
const SUITS = 4;

export interface Shoe {
  readonly cards: Uint8Array;
  /** Index of the next card to deal; equals the number of cards dealt since the last shuffle. */
  next: number;
  /** Cards before this index can be dealt: the whole shoe, or the reused discards. */
  limit: number;
  /** Index of the current round's first card; cards before it are discards. */
  roundStart: number;
  /** True after the discards were reused mid-round: the next round must reshuffle. */
  mustReshuffle: boolean;
  readonly cutCard: number;
  readonly rng: Rng | null;
}

export function buildOrderedCards(decks: number): Uint8Array {
  const cards = new Uint8Array(decks * CARDS_PER_DECK);
  let index = 0;
  for (let deck = 0; deck < decks; deck += 1) {
    for (let rank = 1; rank <= RANKS_PER_DECK; rank += 1) {
      const value = Math.min(rank, TEN);
      for (let suit = 0; suit < SUITS; suit += 1) {
        cards[index] = value;
        index += 1;
      }
    }
  }
  return cards;
}

export function cutCardPosition(totalCards: number, penetrationPercent: number): number {
  return Math.floor((totalCards * penetrationPercent) / 100);
}

/** Builds the shoe in the fixed order and shuffles it once. */
export function createShoe(decks: number, penetrationPercent: number, rng: Rng): Shoe {
  const cards = buildOrderedCards(decks);
  const shoe: Shoe = {
    cards,
    next: 0,
    limit: cards.length,
    roundStart: 0,
    mustReshuffle: false,
    cutCard: cutCardPosition(cards.length, penetrationPercent),
    rng,
  };
  shuffleShoe(shoe);
  return shoe;
}

/**
 * A shoe dealt in exactly the given order and never reshuffled.
 * Used by card-exact tests (spec 5.6, 7.10); the simulation never uses it.
 */
export function createStackedShoe(cards: readonly number[]): Shoe {
  return {
    cards: Uint8Array.from(cards),
    next: 0,
    limit: cards.length,
    roundStart: 0,
    mustReshuffle: false,
    cutCard: cards.length + 1,
    rng: null,
  };
}

/** Fisher-Yates over cards[from, to), last index down. */
function shuffleRange(cards: Uint8Array, rng: Rng, from: number, to: number): void {
  for (let i = to - 1; i > from; i -= 1) {
    const j = from + rng.nextBelow(i - from + 1);
    const swap = cards[i] ?? 0;
    cards[i] = cards[j] ?? 0;
    cards[j] = swap;
  }
}

export function shuffleShoe(shoe: Shoe): void {
  const { cards, rng } = shoe;
  if (rng === null) throw new Error('A stacked shoe cannot be shuffled');
  shuffleRange(cards, rng, 0, cards.length);
  shoe.next = 0;
  shoe.limit = cards.length;
  shoe.roundStart = 0;
  shoe.mustReshuffle = false;
}

/** Spec 5.2 step 1: the reshuffle check before a round. Returns true if the shoe was reshuffled. */
export function reshuffleIfDue(shoe: Shoe): boolean {
  const due = shoe.next >= shoe.cutCard || shoe.mustReshuffle;
  if (due) shuffleShoe(shoe);
  shoe.roundStart = shoe.next;
  return due;
}

/** Spec 8.3 (pinned in 2.6): reuse the discards when a small shoe runs out mid-round. */
function reuseDiscards(shoe: Shoe): void {
  const { rng, roundStart } = shoe;
  if (rng === null || shoe.mustReshuffle || roundStart === 0) {
    throw new Error('The shoe ran out of cards in the middle of a round');
  }
  shuffleRange(shoe.cards, rng, 0, roundStart);
  shoe.next = 0;
  shoe.limit = roundStart;
  shoe.mustReshuffle = true;
}

export function drawCard(shoe: Shoe): number {
  if (shoe.next >= shoe.limit) reuseDiscards(shoe);
  const card = shoe.cards[shoe.next] ?? 0;
  shoe.next += 1;
  return card;
}
