import { ceilDivide, type Cents } from './money';

// Spec section 3.1. Multiples are exact fractions so amounts stay integer.
export const TARGET_IDS = ['0_5x', '1x', '2x', '2_5x'] as const;

export type TargetId = (typeof TARGET_IDS)[number];

interface TargetMultiple {
  readonly numerator: number;
  readonly denominator: number;
  readonly label: string;
}

export const TARGET_MULTIPLES: Readonly<Record<TargetId, TargetMultiple>> = {
  '0_5x': { numerator: 1, denominator: 2, label: '0.5x' },
  '1x': { numerator: 1, denominator: 1, label: '1x' },
  '2x': { numerator: 2, denominator: 1, label: '2x' },
  '2_5x': { numerator: 5, denominator: 2, label: '2.5x' },
};

/** Net-profit amount for a target, rounded up so reaching it never needs less than the exact multiple. */
export function targetAmount(startingBankroll: Cents, target: TargetId): Cents {
  const { numerator, denominator } = TARGET_MULTIPLES[target];
  return ceilDivide(startingBankroll * numerator, denominator);
}
