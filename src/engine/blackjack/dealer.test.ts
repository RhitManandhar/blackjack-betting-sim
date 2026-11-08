import { describe, expect, it } from 'vitest';
import { dealerMustHit, dealerPeeks, isDealerBlackjack, playDealerHand } from './dealer';
import { createStackedShoe } from './shoe';

describe('dealerPeeks', () => {
  it.each([
    [1, true],
    [10, true],
    [2, false],
    [9, false],
  ])('upcard %i -> %s', (upcard, expected) => {
    expect(dealerPeeks(upcard)).toBe(expected);
  });
});

describe('isDealerBlackjack', () => {
  it.each([
    [1, 10, true],
    [10, 1, true],
    [1, 1, false],
    [10, 10, false],
    [9, 2, false],
  ])('%i,%i -> %s', (up, hole, expected) => {
    expect(isDealerBlackjack(up, hole)).toBe(expected);
  });
});

describe('dealerMustHit (S17 / H17)', () => {
  it.each([
    // hard sum, has ace, H17, must hit
    [16, false, false, true],
    [17, false, false, false],
    [17, false, true, false],
    [7, true, false, false], // soft 17, S17 stands
    [7, true, true, true], // soft 17, H17 hits
    [8, true, true, false], // soft 18
    [17, true, true, false], // A,6,10 = hard 17
    [6, true, false, true], // soft 16
  ])('hard %i ace %s H17 %s -> %s', (hardSum, hasAce, h17, expected) => {
    expect(dealerMustHit(hardSum, hasAce, h17)).toBe(expected);
  });
});

describe('playDealerHand', () => {
  it('G12: dealer 6 up with ace in the hole stands on soft 17 under S17', () => {
    const shoe = createStackedShoe([5]);
    expect(playDealerHand(shoe, 6, 1, false)).toBe(17);
    expect(shoe.next).toBe(0);
  });

  it('G12: dealer 6 up with ace in the hole hits soft 17 under H17', () => {
    const shoe = createStackedShoe([4]);
    expect(playDealerHand(shoe, 6, 1, true)).toBe(21);
    expect(shoe.next).toBe(1);
  });

  it('draws until 17 and reports a bust above 21', () => {
    expect(playDealerHand(createStackedShoe([2, 10]), 10, 4, false)).toBe(26);
    expect(playDealerHand(createStackedShoe([1]), 5, 5, false)).toBe(21);
  });

  it('counts aces as 1 once 11 would bust: 2,2,A,A,10,3 = 19', () => {
    const shoe = createStackedShoe([1, 1, 10, 3]);
    expect(playDealerHand(shoe, 2, 2, false)).toBe(19);
    expect(shoe.next).toBe(4);
  });
});
