// Published house edges for the Tier 1 rule sets (spec 6.3, gate 2). See docs/validation.md.
//
// Source: Michael Shackleford, "Blackjack House Edge Calculator", Wizard of Odds,
//   https://wizardofodds.com/games/blackjack/calculator/ (last updated 3 Aug 2026,
//   retrieved 8 Nov 2026). Values are copied from the page's embedded edgeTable and its
//   CalculateResult() function:
//   - base: edgeTable[decks][soft17][das][double any=0][resplit to 4=2][no RSA=0]
//           [no hitting split aces=0][lose only original bet to dealer BJ=1][no surrender=0]
//     ("optimal results": composition-dependent strategy, shuffle every hand);
//   - plus the page's "basic strategy with cut card" adjustment for the deck count
//     (total-dependent strategy and a cut card), which is what this engine simulates;
//   - plus the page's 6:5 adjustment for the deck count when blackjack pays 6:5.
// All values are percentages of the initial bet.

export interface PublishedHouseEdge {
  readonly decks: 6 | 8;
  readonly soft17: 'S17' | 'H17';
  readonly doubleAfterSplit: boolean;
  readonly blackjackPayout: '3:2' | '6:5';
  readonly percent: number;
}

const BASE: Record<string, number> = {
  '6|S17|nodas': 0.544889,
  '6|S17|das': 0.403115,
  '6|H17|nodas': 0.760168,
  '6|H17|das': 0.615626,
  '8|S17|nodas': 0.572499,
  '8|S17|das': 0.430961,
  '8|H17|nodas': 0.789206,
  '8|H17|das': 0.644928,
};

const CUT_CARD_ADJUSTMENT: Record<6 | 8, number> = { 6: 0.0231, 8: 0.0159 };
const SIX_TO_FIVE_ADJUSTMENT: Record<6 | 8, number> = { 6: 1.35969, 8: 1.357984 };

export function publishedHouseEdge(
  decks: 6 | 8,
  soft17: 'S17' | 'H17',
  doubleAfterSplit: boolean,
  blackjackPayout: '3:2' | '6:5',
): PublishedHouseEdge {
  const base = BASE[`${String(decks)}|${soft17}|${doubleAfterSplit ? 'das' : 'nodas'}`];
  if (base === undefined) throw new Error('No published value for this rule set');
  const payoutAdjustment = blackjackPayout === '6:5' ? SIX_TO_FIVE_ADJUSTMENT[decks] : 0;
  return {
    decks,
    soft17,
    doubleAfterSplit,
    blackjackPayout,
    percent: base + CUT_CARD_ADJUSTMENT[decks] + payoutAdjustment,
  };
}
