import { describe, expect, it } from 'vitest';
import { bestTotal } from '../blackjack/cards';
import { dealerMustHit } from '../blackjack/dealer';
import { DealerOutcomeEvaluator, buildDealerPatterns, excludedHoleCard } from './dealerOutcomes';

// Reference: walk every dealer draw sequence directly, without replacement.
function recursiveOutcomes(counts: number[], upcard: number, hitSoft17: boolean): number[] {
  const out = [0, 0, 0, 0, 0, 0];
  const shoe = [...counts];
  let remaining = shoe.reduce((sum, n) => sum + n, 0);
  const excluded = excludedHoleCard(upcard);
  const draw = (hardSum: number, hasAce: boolean, probability: number, isHole: boolean): void => {
    if (hardSum > 21) {
      out[5] = (out[5] ?? 0) + probability;
      return;
    }
    if (!isHole && !dealerMustHit(hardSum, hasAce, hitSoft17)) {
      const slot = bestTotal(hardSum, hasAce) - 17;
      out[slot] = (out[slot] ?? 0) + probability;
      return;
    }
    const denominator = isHole && excluded !== 0 ? remaining - (shoe[excluded] ?? 0) : remaining;
    for (let value = 1; value <= 10; value += 1) {
      const available = shoe[value] ?? 0;
      if (available === 0 || (isHole && value === excluded)) continue;
      shoe[value] = available - 1;
      remaining -= 1;
      draw(hardSum + value, hasAce || value === 1, (probability * available) / denominator, false);
      shoe[value] = available;
      remaining += 1;
    }
  };
  draw(upcard, upcard === 1, 1, true);
  return out;
}

const SHOES: Record<string, number[]> = {
  'full 6 decks minus a 2': [0, 24, 23, 24, 24, 24, 24, 24, 24, 24, 96],
  'ten-poor': [0, 24, 24, 24, 24, 24, 24, 24, 24, 24, 40],
  'nearly out of aces and sixes': [0, 1, 10, 10, 10, 10, 0, 10, 10, 10, 30],
};

describe('DealerOutcomeEvaluator', () => {
  for (const [name, counts] of Object.entries(SHOES)) {
    for (const hitSoft17 of [false, true]) {
      it.each([1, 2, 5, 6, 7, 10])(
        `${name}, H17=${String(hitSoft17)}, upcard %i matches the recursive walk`,
        (upcard) => {
          const evaluator = new DealerOutcomeEvaluator(buildDealerPatterns(upcard, hitSoft17));
          const remaining = counts.reduce((sum, n) => sum + n, 0);
          const actual = Array.from(evaluator.evaluate(Int32Array.from(counts), remaining));
          const expected = recursiveOutcomes(counts, upcard, hitSoft17);
          actual.forEach((probability, slot) => {
            expect(probability).toBeCloseTo(expected[slot] ?? Number.NaN, 12);
          });
          expect(actual.reduce((sum, p) => sum + p, 0)).toBeCloseTo(1, 12);
        },
      );
    }
  }
});
