import { STRATEGIES } from '../../shared/strategies';
import { type BettingStrategy, type StrategyStateBase, emptyOvershoot } from './strategy';

/** Spec 4.3, flat-v1: bet one unit every round. No state beyond the shared overshoot record. */
export type FlatState = StrategyStateBase;

export const flat: BettingStrategy<FlatState> = {
  id: 'flat',
  version: STRATEGIES.flat.version,
  createState: () => emptyOvershoot(),
  nextBet: (_state, params) => params.unit,
  update: () => {
    // Flat betting never changes its bet.
  },
};
