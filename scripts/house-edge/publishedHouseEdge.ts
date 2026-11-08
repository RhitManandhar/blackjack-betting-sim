import type { RuleSet } from '../../src/shared/schema';

// Published house edges for the gated rule sets (spec 6.3, gate 2). See docs/validation.md.
//
// Source: Michael Shackleford, "Blackjack House Edge Calculator", Wizard of Odds,
//   https://wizardofodds.com/games/blackjack/calculator/ (last updated 3 Aug 2026,
//   retrieved 8 Nov 2026). Values are copied from the page's embedded edgeTable and its
//   CalculateResult() function:
//   - base: edgeTable[decks][soft17][das][doubleOn][resplitTo][rsa][hitSplitAces=0]
//           [lose only original bet to dealer BJ=1][surrender]
//     ("optimal results": composition-dependent strategy, shuffle every hand);
//   - plus the page's "basic strategy with cut card" adjustment for the deck count
//     (total-dependent strategy and a cut card), which is what this engine simulates;
//   - plus the page's 6:5 adjustment for the deck count when blackjack pays 6:5.
// The calculator has no penetration setting, so penetration does not change the published value.
// All values are percentages of the initial bet.

const BASE: Record<string, number> = {
  // Tier 1. Index order: decks, soft17, das, doubleOn, resplitTo, rsa, hsa, obo, surrender.
  '6|S17|nodas': 0.544889, // [4,0,0,0,2,0,0,1,0]
  '6|S17|das': 0.403115, // [4,0,1,0,2,0,0,1,0]
  '6|H17|nodas': 0.760168, // [4,1,0,0,2,0,0,1,0]
  '6|H17|das': 0.615626, // [4,1,1,0,2,0,0,1,0]
  '8|S17|nodas': 0.572499, // [5,0,0,0,2,0,0,1,0]
  '8|S17|das': 0.430961, // [5,0,1,0,2,0,0,1,0]
  '8|H17|nodas': 0.789206, // [5,1,0,0,2,0,0,1,0]
  '8|H17|das': 0.644928, // [5,1,1,0,2,0,0,1,0]
  // Tier 2: deck counts.
  '1|S17|das': -0.182895, // [0,0,1,0,2,0,0,1,0]
  '1|S17|nodas': -0.04162, // [0,0,0,0,2,0,0,1,0]
  '1|H17|das': 0.007747, // [0,1,1,0,2,0,0,1,0]
  '1|H17|nodas': 0.151762, // [0,1,0,0,2,0,0,1,0]
  '2|S17|das': 0.178315, // [1,0,1,0,2,0,0,1,0]
  '2|S17|nodas': 0.321003, // [1,0,0,0,2,0,0,1,0]
  '2|H17|das': 0.379879, // [1,1,1,0,2,0,0,1,0]
  '2|H17|nodas': 0.525253, // [1,1,0,0,2,0,0,1,0]
  '4|S17|das': 0.347486, // [2,0,1,0,2,0,0,1,0]
  '4|S17|nodas': 0.4896, // [2,0,0,0,2,0,0,1,0]
  '4|H17|das': 0.557183, // [2,1,1,0,2,0,0,1,0]
  '4|H17|nodas': 0.702116, // [2,1,0,0,2,0,0,1,0]
  // Tier 2: one option at a time.
  '6|S17|das|ls': 0.330512, // [4,0,1,0,2,0,0,1,1]
  '6|H17|das|ls': 0.527409, // [4,1,1,0,2,0,0,1,1]
  '1|S17|das|ls': -0.204943, // [0,0,1,0,2,0,0,1,1]
  '6|S17|das|9-11': 0.499221, // [4,0,1,1,2,0,0,1,0]
  '6|S17|das|10-11': 0.595195, // [4,0,1,2,2,0,0,1,0]
  '6|S17|das|sp2': 0.456886, // [4,0,1,0,0,0,0,1,0]
  '6|S17|das|sp3': 0.411761, // [4,0,1,0,1,0,0,1,0]
  '6|S17|das|rsa': 0.334573, // [4,0,1,0,2,1,0,1,0]
};

const CUT_CARD_ADJUSTMENT: Record<RuleSet['decks'], number> = {
  1: 0.1517,
  2: 0.077,
  4: 0.0395,
  6: 0.0231,
  8: 0.0159,
};

const SIX_TO_FIVE_ADJUSTMENT: Record<RuleSet['decks'], number> = {
  1: 1.394773,
  2: 1.373499,
  4: 1.363115,
  6: 1.35969,
  8: 1.357984,
};

export function publishedKey(rules: RuleSet): string {
  const parts = [String(rules.decks), rules.soft17, rules.doubleAfterSplit ? 'das' : 'nodas'];
  if (rules.lateSurrender) parts.push('ls');
  if (rules.doubleOn !== 'any-two') parts.push(rules.doubleOn);
  if (rules.maxSplitHands !== 4) parts.push(`sp${String(rules.maxSplitHands)}`);
  if (rules.resplitAces) parts.push('rsa');
  return parts.join('|');
}

/** Published house edge in percent, or an error if the rule set has no recorded source value. */
export function publishedHouseEdge(rules: RuleSet): number {
  const base = BASE[publishedKey(rules)];
  if (base === undefined) throw new Error(`No published value for ${publishedKey(rules)}`);
  const payoutAdjustment =
    rules.blackjackPayout === '6:5' ? SIX_TO_FIVE_ADJUSTMENT[rules.decks] : 0;
  return base + CUT_CARD_ADJUSTMENT[rules.decks] + payoutAdjustment;
}
