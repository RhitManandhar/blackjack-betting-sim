// Strategy identities from spec section 4.2. The rules themselves live in src/engine/betting.

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
}

export const STRATEGIES: Readonly<Record<StrategyId, StrategyInfo>> = {
  flat: { id: 'flat', version: 'flat-v1', name: 'Flat' },
  martingale: { id: 'martingale', version: 'martingale-v1', name: 'Martingale' },
  'paroli-classic': {
    id: 'paroli-classic',
    version: 'paroli-classic-v1',
    name: 'Paroli (classic, 1-2-4)',
  },
  'paroli-1326': { id: 'paroli-1326', version: 'paroli-1326-v1', name: 'Paroli (1-3-2-6)' },
  'oscars-grind-bj': {
    id: 'oscars-grind-bj',
    version: 'oscars-grind-bj-v1',
    name: "Oscar's Grind (blackjack-adapted)",
  },
};
