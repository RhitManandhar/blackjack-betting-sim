import { STRATEGIES } from '../../shared/strategies';
import { RoundResult } from './roundResult';
import { type BettingStrategy, type StrategyStateBase, emptyOvershoot } from './strategy';

/**
 * Spec 4.3, paroli-classic-v1. Bet unit x 2^consecutiveWins. Win: extend the streak, and reset
 * after N wins. Loss: reset. Push: neither extends nor breaks the streak (D7).
 * Separate from Paroli 1-3-2-6 on purpose: no shared state or code.
 */
export interface ParoliClassicState extends StrategyStateBase {
  consecutiveWins: number;
}

export const paroliClassic: BettingStrategy<ParoliClassicState> = {
  id: 'paroli-classic',
  version: STRATEGIES['paroli-classic'].version,
  createState: () => ({ ...emptyOvershoot(), consecutiveWins: 0 }),
  nextBet: (state, params) => params.unit * 2 ** state.consecutiveWins,
  update: (state, result, _netProfit, params) => {
    if (result === RoundResult.Win) {
      const wins = state.consecutiveWins + 1;
      state.consecutiveWins = wins === params.paroliStreakLength ? 0 : wins;
    } else if (result === RoundResult.Loss) {
      state.consecutiveWins = 0;
    }
  },
};
