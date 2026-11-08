import { STRATEGIES } from '../../shared/strategies';
import { RoundResult } from './roundResult';
import { type BettingStrategy, type StrategyStateBase, emptyOvershoot } from './strategy';

/**
 * Spec 4.3, paroli-1326-v1. Bets 1, 3, 2, 6 units. Win: advance, and reset after winning the
 * 6-unit step. Loss: reset. Push: keep the step.
 * Separate from Paroli classic on purpose: no shared state or code.
 */
const STEP_UNITS = [1, 3, 2, 6] as const;
const LAST_STEP = STEP_UNITS.length - 1;

export interface Paroli1326State extends StrategyStateBase {
  stepIndex: number;
}

export const paroli1326: BettingStrategy<Paroli1326State> = {
  id: 'paroli-1326',
  version: STRATEGIES['paroli-1326'].version,
  createState: () => ({ ...emptyOvershoot(), stepIndex: 0 }),
  nextBet: (state, params) => params.unit * (STEP_UNITS[state.stepIndex] ?? 1),
  update: (state, result) => {
    if (result === RoundResult.Win) {
      state.stepIndex = state.stepIndex === LAST_STEP ? 0 : state.stepIndex + 1;
    } else if (result === RoundResult.Loss) {
      state.stepIndex = 0;
    }
  },
};
