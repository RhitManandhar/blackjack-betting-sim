import { STRATEGIES } from '../../shared/strategies';
import { RoundResult } from './roundResult';
import { type BettingStrategy, type StrategyStateBase, emptyOvershoot } from './strategy';

/**
 * Spec 4.3, martingale-v1. Win: back to one unit. Loss: double the previous initial bet
 * (D6: not the amount lost). Push: repeat the bet.
 */
export interface MartingaleState extends StrategyStateBase {
  currentBet: number;
}

export const martingale: BettingStrategy<MartingaleState> = {
  id: 'martingale',
  version: STRATEGIES.martingale.version,
  createState: (params) => ({ ...emptyOvershoot(), currentBet: params.unit }),
  nextBet: (state) => state.currentBet,
  update: (state, result, _netProfit, params) => {
    if (result === RoundResult.Win) state.currentBet = params.unit;
    else if (result === RoundResult.Loss) state.currentBet = 2 * state.currentBet;
  },
};
