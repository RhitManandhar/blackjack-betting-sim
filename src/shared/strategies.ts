// Strategy identities from spec section 4.2, with the "About this system" text the UI shows
// (plan 6.6). The rules themselves live in src/engine/betting.
//
// Wording rule (CLAUDE.md rule 7): describe what a system does and its main risk. Never say or
// imply that a system wins, is guaranteed or beats the casino. No betting system changes the
// house edge.

export const STRATEGY_IDS = [
  'flat',
  'martingale',
  'paroli-classic',
  'paroli-1326',
  'oscars-grind-bj',
] as const;

export type StrategyId = (typeof STRATEGY_IDS)[number];

export interface StrategyInfo {
  readonly id: StrategyId;
  readonly version: string;
  readonly name: string;
  /** One-paragraph rule summary. Paroli classic's streak length appears as {N}. */
  readonly rule: string;
  readonly mainRisk: string;
}

export const STRATEGIES: Readonly<Record<StrategyId, StrategyInfo>> = {
  flat: {
    id: 'flat',
    version: 'flat-v1',
    name: 'Flat',
    rule: 'Bets one base unit every round, whatever happened before. This is the baseline every other system is compared against.',
    mainRisk:
      'Results follow the house edge directly, so the expected loss grows steadily with the number of rounds played.',
  },
  martingale: {
    id: 'martingale',
    version: 'martingale-v1',
    name: 'Martingale',
    rule: 'Starts at one unit. After a loss the next bet is double the previous bet; after a win it returns to one unit; after a push it repeats.',
    mainRisk:
      'Bets grow very fast during a losing run. The bankroll or the table maximum can stop the system after only a few losses in a row, so many small wins can be followed by one large loss.',
  },
  'paroli-classic': {
    id: 'paroli-classic',
    version: 'paroli-classic-v1',
    name: 'Paroli (classic, 1-2-4)',
    rule: 'Starts at one unit and doubles the bet after each win. It returns to one unit after {N} wins in a row or after any loss. A push keeps the current step.',
    mainRisk:
      'A loss near the top of a streak gives back what the streak had won, and long winning streaks are uncommon.',
  },
  'paroli-1326': {
    id: 'paroli-1326',
    version: 'paroli-1326-v1',
    name: 'Paroli (1-3-2-6)',
    rule: 'Bets 1, 3, 2 and then 6 units, moving one step on after each win. A loss, or a win at the 6-unit step, returns to 1 unit. A push keeps the current step.',
    mainRisk:
      'Most sequences end before the 6-unit step, and a loss at a later step gives back most or all of what the sequence had won.',
  },
  'oscars-grind-bj': {
    id: 'oscars-grind-bj',
    version: 'oscars-grind-bj-v1',
    name: "Oscar's Grind (blackjack-adapted)",
    rule: "Plays in cycles that each aim for one unit of profit. The bet stays the same after a loss or push and rises by one unit after a win, but never above what one even-money win needs to finish the cycle. This variant is adapted for blackjack's larger payouts, doubles and splits.",
    mainRisk:
      'A losing run can leave a cycle open for a long time, and an open cycle can use up a large part of the bankroll before it closes.',
  },
};
