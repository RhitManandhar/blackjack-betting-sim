import { ACE, TEN, bestTotal, isSoft } from './cards';
import { type Shoe, drawCard } from './shoe';

/** Spec 5.2 step 3: the dealer peeks only with an ace or ten-value upcard. */
export function dealerPeeks(upcard: number): boolean {
  return upcard === ACE || upcard === TEN;
}

export function isDealerBlackjack(upcard: number, holeCard: number): boolean {
  return (upcard === ACE && holeCard === TEN) || (upcard === TEN && holeCard === ACE);
}

/** Whether the dealer must draw: below 17, or on soft 17 under H17 (spec 5.2 step 6). */
export function dealerMustHit(hardSum: number, hasAce: boolean, hitSoft17: boolean): boolean {
  const total = bestTotal(hardSum, hasAce);
  if (total < 17) return true;
  return total === 17 && hitSoft17 && isSoft(hardSum, hasAce);
}

/** Draws the dealer's hand to completion. Returns the final total; above 21 means bust. */
export function playDealerHand(
  shoe: Shoe,
  upcard: number,
  holeCard: number,
  hitSoft17: boolean,
): number {
  let hardSum = upcard + holeCard;
  let hasAce = upcard === ACE || holeCard === ACE;
  while (dealerMustHit(hardSum, hasAce, hitSoft17)) {
    const card = drawCard(shoe);
    hardSum += card;
    if (card === ACE) hasAce = true;
  }
  return bestTotal(hardSum, hasAce);
}
