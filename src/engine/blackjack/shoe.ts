import type { Rng } from '../simulation/rng';
import { CARDS_PER_DECK, TEN } from './cards';

// Spec 8.3 with the pins from spec 2.2:
// - fixed build order: deck by deck, ranks A, 2..10, J, Q, K, four cards of each rank;
// - Fisher-Yates from the last index down, j = rng.nextBelow(i + 1);
// - a reshuffle shuffles the current card array in place with the same RNG stream;
// - the reshuffle check runs only before a round, never in the middle of one.

const RANKS_PER_DECK = 13;
const SUITS = 4;

export interface Shoe {
  readonly cards: Uint8Array;
  /** Index of the next card to deal; equals the number of cards dealt since the last shuffle. */
  next: number;
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
  return { cards: Uint8Array.from(cards), next: 0, cutCard: cards.length + 1, rng: null };
}

export function shuffleShoe(shoe: Shoe): void {
  const { cards, rng } = shoe;
  if (rng === null) throw new Error('A stacked shoe cannot be shuffled');
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = rng.nextBelow(i + 1);
    const swap = cards[i] ?? 0;
    cards[i] = cards[j] ?? 0;
    cards[j] = swap;
  }
  shoe.next = 0;
}

/** Spec 5.2 step 1. Returns true if the shoe was reshuffled. */
export function reshuffleIfDue(shoe: Shoe): boolean {
  if (shoe.next < shoe.cutCard) return false;
  shuffleShoe(shoe);
  return true;
}

export function drawCard(shoe: Shoe): number {
  const card = shoe.cards[shoe.next];
  if (card === undefined) {
    throw new Error('The shoe ran out of cards in the middle of a round');
  }
  shoe.next += 1;
  return card;
}
