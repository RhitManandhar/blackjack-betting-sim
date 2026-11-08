import type { RuleSet } from '../../shared/schema';

// Table-rule options offered on screen. An option is listed here only after it passed both
// correctness gates for its tier (spec 5.1, 6.3; results in docs/validation.md). All Tier 1-3
// options passed on 8 Nov 2026.

export const DECK_OPTIONS: readonly RuleSet['decks'][] = [1, 2, 4, 6, 8];
export const SPLIT_HAND_OPTIONS: readonly RuleSet['maxSplitHands'][] = [2, 3, 4];
export const DOUBLE_OPTIONS: readonly { value: RuleSet['doubleOn']; label: string }[] = [
  { value: 'any-two', label: 'Any first two cards' },
  { value: '9-11', label: 'Hard 9, 10 or 11 only' },
  { value: '10-11', label: 'Hard 10 or 11 only' },
];
export const PENETRATION_OPTIONS: readonly number[] = [50, 55, 60, 65, 70, 75, 80, 85, 90];
