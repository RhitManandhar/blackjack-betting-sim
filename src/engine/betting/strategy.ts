import type { Cents } from '../../shared/money';
import type { StrategyId } from '../../shared/strategies';
import type { RoundResult } from './roundResult';

// Spec 4.1. A strategy decides only the next initial bet (CLAUDE.md rule 4). It never sees
// cards or hands, and it never decides `bust` or `blocked_table_max`; the runner does
// (see betCheck.ts).
//
// State is mutated in place by `update` so the round loop allocates nothing. Spec 4.1 allows
// this; the observable transitions are the ones in spec 4.3 and the worked examples in 7.

export interface StrategyParams {
  readonly unit: Cents;
  readonly tableMinimum: Cents;
  /** Paroli classic streak length N, 2-5. Ignored by the other strategies. */
  readonly paroliStreakLength: number;
}

/** Every state carries the Oscar's Grind overshoot record (spec 10.1); it stays 0 for the others. */
export interface StrategyStateBase {
  minimumOvershootCount: number;
  minimumOvershootTotal: Cents;
}

export interface BettingStrategy<State extends StrategyStateBase> {
  readonly id: StrategyId;
  readonly version: string;
  createState(params: StrategyParams): State;
  /** The required initial bet for the next round. Always at least the table minimum. */
  nextBet(state: State, params: StrategyParams): Cents;
  /** Moves the state on after a round. `result` comes from roundResultFromNet(netProfit). */
  update(state: State, result: RoundResult, netProfit: Cents, params: StrategyParams): void;
}

export function emptyOvershoot(): StrategyStateBase {
  return { minimumOvershootCount: 0, minimumOvershootTotal: 0 };
}
