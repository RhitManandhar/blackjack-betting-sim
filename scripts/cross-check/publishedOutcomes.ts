import type { RuleSet } from '../../src/shared/schema';

// Reference for cross-check 2 (outcome frequencies). See docs/validation.md.
//
// Source: Michael Shackleford, "Variance in Blackjack: Standard Deviation & Multiple Hands",
//   Wizard of Odds, https://wizardofodds.com/games/blackjack/appendix/4/ (last updated
//   3 Aug 2026, retrieved 22 Nov 2026). Table "net win probabilities, one hand", for basic
//   strategy in a cut-card game under the page's "liberal Strip rules": six decks, dealer
//   stands on soft 17, double on any first two cards, double after split, late surrender,
//   re-split aces, re-split up to three times (four hands). Blackjack pays 3:2 (the +1.5 row).
//   The page does not state its penetration; the engine uses its 75% default.

export const REFERENCE_RULES: RuleSet = {
  decks: 6,
  soft17: 'S17',
  blackjackPayout: '3:2',
  doubleAfterSplit: true,
  doubleOn: 'any-two',
  lateSurrender: true,
  maxSplitHands: 4,
  resplitAces: true,
  penetrationPercent: 75,
};

/** Net round result in initial bets → probability, copied from the page. */
export const NET_WIN_PROBABILITIES: ReadonlyMap<number, number> = new Map([
  [-8, 0.00000019],
  [-7, 0.00000235],
  [-6, 0.00001785],
  [-5, 0.00008947],
  [-4, 0.00048248],
  [-3, 0.00207909],
  [-2, 0.04180923],
  [-1, 0.40171191],
  [-0.5, 0.04470705],
  [0, 0.0848329],
  [1, 0.31697909],
  [1.5, 0.04529632],
  [2, 0.05844299],
  [3, 0.00259645],
  [4, 0.00076323],
  [5, 0.00014491],
  [6, 0.00003774],
  [7, 0.00000609],
  [8, 0.00000066],
]);

/**
 * The spec's four outcome categories (spec 1) from the table. With these rules a net of +1.5 can
 * only come from an unsplit natural, so it is exactly the `blackjack` category; surrender
 * (−0.5) is a loss.
 */
export function referenceCategories(): Record<'blackjack' | 'win' | 'push' | 'loss', number> {
  let win = 0;
  let loss = 0;
  for (const [net, probability] of NET_WIN_PROBABILITIES) {
    if (net === 1.5) continue;
    if (net > 0) win += probability;
    else if (net < 0) loss += probability;
  }
  return {
    blackjack: NET_WIN_PROBABILITIES.get(1.5) ?? 0,
    win,
    push: NET_WIN_PROBABILITIES.get(0) ?? 0,
    loss,
  };
}

/** Expected net result per initial bet implied by the table (minus the house edge). */
export function referenceExpectation(): number {
  let sum = 0;
  for (const [net, probability] of NET_WIN_PROBABILITIES) sum += net * probability;
  return sum;
}
