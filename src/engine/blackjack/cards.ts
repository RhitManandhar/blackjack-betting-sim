// Cards are stored only by blackjack value: 1 is an ace, 2-9 are pip cards and
// 10 is any ten-value card (10, J, Q, K). Suits never affect play.

export const ACE = 1;
export const TEN = 10;
export const CARD_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const CARDS_PER_DECK = 52;

/** Number of cards of each value in one deck, indexed by value (index 0 unused). */
export function cardsPerDeckOfValue(value: number): number {
  return value === TEN ? 16 : 4;
}

/** Best total: an ace counts 11 when that does not bust the hand (spec 5.3). */
export function bestTotal(hardSum: number, hasAce: boolean): number {
  return hasAce && hardSum <= 11 ? hardSum + 10 : hardSum;
}

/** A hand is soft while one ace is counted as 11. */
export function isSoft(hardSum: number, hasAce: boolean): boolean {
  return hasAce && hardSum <= 11;
}

/** Ace plus a ten-value card, as the first two cards of the initial hand. */
export function isNaturalPair(first: number, second: number): boolean {
  return first + second === ACE + TEN && (first === ACE || second === ACE);
}
