import { STRATEGIES } from '../../shared/strategies';
import { RoundResult } from './roundResult';
import { type BettingStrategy, type StrategyStateBase, emptyOvershoot } from './strategy';

/**
 * Spec 4.3, oscars-grind-bj-v1 (blackjack-adapted variant).
 * A cycle aims for one unit of profit, measured with actual net round profit.
 * 1. Add the round's net profit to the cycle.
 * 2. Cycle profit >= one unit: close the cycle, back to one unit; any excess is dropped (D8).
 * 3. Loss or push: keep the bet.
 * 4. Win: raise by one unit, but never above what an even-money win needs to finish the cycle.
 *    If that is below the table minimum, bet the minimum and record the overshoot.
 */
export interface OscarsGrindState extends StrategyStateBase {
  cycleProfit: number;
  currentBet: number;
}

export const oscarsGrind: BettingStrategy<OscarsGrindState> = {
  id: 'oscars-grind-bj',
  version: STRATEGIES['oscars-grind-bj'].version,
  createState: (params) => ({ ...emptyOvershoot(), cycleProfit: 0, currentBet: params.unit }),
  nextBet: (state) => state.currentBet,
  update: (state, result, netProfit, params) => {
    state.cycleProfit += netProfit;
    if (state.cycleProfit >= params.unit) {
      state.cycleProfit = 0;
      state.currentBet = params.unit;
      return;
    }
    if (result !== RoundResult.Win) return;

    const needed = params.unit - state.cycleProfit;
    const candidate = Math.min(state.currentBet + params.unit, needed);
    if (candidate >= params.tableMinimum) {
      state.currentBet = candidate;
      return;
    }
    state.currentBet = params.tableMinimum;
    state.minimumOvershootCount += 1;
    state.minimumOvershootTotal += params.tableMinimum - candidate;
  },
};
