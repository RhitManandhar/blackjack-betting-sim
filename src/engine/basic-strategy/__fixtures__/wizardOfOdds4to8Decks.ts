import type { ChartCode } from '../chart';

// Reference charts for the chart gate (spec 6.3). Test-only: the engine never reads these.
//
// Source: Michael Shackleford, "4-Deck to 8-Deck Blackjack Strategy", Wizard of Odds,
//   https://wizardofodds.com/games/blackjack/strategy/4-decks/ (last updated 3 Aug 2026,
//   retrieved 8 Nov 2026).
// The source chart allows late surrender. Tier 1 has no surrender, so each surrender cell
// takes the source's hit/stand or split rule instead (noted where it applies).
//
// Columns: dealer upcard 2, 3, 4, 5, 6, 7, 8, 9, 10, A.
// Codes: H hit, S stand, Dh double else hit, Ds double else stand, P split, - do not split.

type Row = readonly ChartCode[];
type ReferenceChart = Record<string, Row>;

const H: Row = ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'];
const S: Row = ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'];
const P: Row = ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'];
const NO_SPLIT: Row = ['-', '-', '-', '-', '-', '-', '-', '-', '-', '-'];
// "Stand on hard 13-16 against a dealer 2-6, otherwise hit." Surrender of 15 and 16 falls back to this.
const STIFF: Row = ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'];

/** Dealer stands on soft 17, double after split allowed. */
export const S17_DAS: ReferenceChart = {
  // "Always hit hard 11 or less."
  'hard 5': H,
  'hard 6': H,
  'hard 7': H,
  'hard 8': H,
  // "Double hard 9 vs. dealer 3-6."
  'hard 9': ['H', 'Dh', 'Dh', 'Dh', 'Dh', 'H', 'H', 'H', 'H', 'H'],
  // "Double hard 10 except against a dealer 10 or A."
  'hard 10': ['Dh', 'Dh', 'Dh', 'Dh', 'Dh', 'Dh', 'Dh', 'Dh', 'H', 'H'],
  // "Double hard 11 except against a dealer A."
  'hard 11': ['Dh', 'Dh', 'Dh', 'Dh', 'Dh', 'Dh', 'Dh', 'Dh', 'Dh', 'H'],
  // "Stand on hard 12 against a dealer 4-6, otherwise hit."
  'hard 12': ['H', 'H', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  'hard 13': STIFF,
  'hard 14': STIFF,
  'hard 15': STIFF,
  'hard 16': STIFF,
  // "Always stand on hard 17 or more."
  'hard 17': S,
  'hard 18': S,
  'hard 19': S,
  'hard 20': S,
  // "Double soft 13 or 14 vs. dealer 5-6." / "Always hit soft 17 or less."
  'soft 13': ['H', 'H', 'H', 'Dh', 'Dh', 'H', 'H', 'H', 'H', 'H'],
  'soft 14': ['H', 'H', 'H', 'Dh', 'Dh', 'H', 'H', 'H', 'H', 'H'],
  // "Double soft 15 or 16 vs. dealer 4-6."
  'soft 15': ['H', 'H', 'Dh', 'Dh', 'Dh', 'H', 'H', 'H', 'H', 'H'],
  'soft 16': ['H', 'H', 'Dh', 'Dh', 'Dh', 'H', 'H', 'H', 'H', 'H'],
  // "Double soft 17 or 18 vs. dealer 3-6."
  'soft 17': ['H', 'Dh', 'Dh', 'Dh', 'Dh', 'H', 'H', 'H', 'H', 'H'],
  // ... and "Stand on soft 18 except hit against a dealer 9, 10, or A."
  'soft 18': ['S', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H'],
  // "Always stand on soft 19 or more."
  'soft 19': S,
  'soft 20': S,
  // "Always split aces and 8s."
  'pair A': P,
  // "Split 2s and 3s against a dealer 4-7, and against a 2 or 3 if DAS is allowed."
  'pair 2': ['P', 'P', 'P', 'P', 'P', 'P', '-', '-', '-', '-'],
  'pair 3': ['P', 'P', 'P', 'P', 'P', 'P', '-', '-', '-', '-'],
  // "Split 4s only if DAS is allowed and the dealer shows a 5 or 6."
  'pair 4': ['-', '-', '-', 'P', 'P', '-', '-', '-', '-', '-'],
  // "Never split 5s and 10s."
  'pair 5': NO_SPLIT,
  // "Split 6s against a dealer 3-6, and against a 2 if DAS is allowed."
  'pair 6': ['P', 'P', 'P', 'P', 'P', '-', '-', '-', '-', '-'],
  // "Split 7s against a dealer 2-7."
  'pair 7': ['P', 'P', 'P', 'P', 'P', 'P', '-', '-', '-', '-'],
  'pair 8': P,
  // "Split 9s against a dealer 2-6 or 8-9."
  'pair 9': ['P', 'P', 'P', 'P', 'P', '-', 'P', 'P', '-', '-'],
  'pair 10': NO_SPLIT,
};

/** No double after split: the DAS-only splits are removed. */
export const S17_NO_DAS: ReferenceChart = {
  ...S17_DAS,
  'pair 2': ['-', '-', 'P', 'P', 'P', 'P', '-', '-', '-', '-'],
  'pair 3': ['-', '-', 'P', 'P', 'P', 'P', '-', '-', '-', '-'],
  'pair 4': NO_SPLIT,
  'pair 6': ['-', 'P', 'P', 'P', 'P', '-', '-', '-', '-', '-'],
};

// Hit-soft-17 changes: "Double 11 vs. dealer A." "Double soft 18 vs. dealer 2."
// "Double soft 19 vs. dealer 6." The surrender changes (15, 8-8 and 17 vs A) fall back to
// hit 15, split 8s and stand on 17, which the base chart already has.
const H17_CHANGES: ReferenceChart = {
  'hard 11': ['Dh', 'Dh', 'Dh', 'Dh', 'Dh', 'Dh', 'Dh', 'Dh', 'Dh', 'Dh'],
  'soft 18': ['Ds', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H'],
  'soft 19': ['S', 'S', 'S', 'S', 'Ds', 'S', 'S', 'S', 'S', 'S'],
};

export const H17_DAS: ReferenceChart = { ...S17_DAS, ...H17_CHANGES };
export const H17_NO_DAS: ReferenceChart = { ...S17_NO_DAS, ...H17_CHANGES };
