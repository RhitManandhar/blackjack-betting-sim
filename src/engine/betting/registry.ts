import type { StrategyId } from '../../shared/strategies';
import { flat } from './flat';
import { martingale } from './martingale';
import { oscarsGrind } from './oscarsGrind';
import { paroli1326 } from './paroli1326';
import { paroliClassic } from './paroliClassic';
import type { BettingStrategy, StrategyStateBase } from './strategy';

// Strategy registry (plan 6.6). A strategy appears here only with a written rule in the spec,
// a version id and table-driven tests. The runner treats every state as opaque.

export const BETTING_STRATEGIES: Readonly<Record<StrategyId, BettingStrategy<StrategyStateBase>>> =
  {
    flat,
    martingale,
    'paroli-classic': paroliClassic,
    'paroli-1326': paroli1326,
    'oscars-grind-bj': oscarsGrind,
  };

export function getBettingStrategy(id: StrategyId): BettingStrategy<StrategyStateBase> {
  return BETTING_STRATEGIES[id];
}
