import { LIMITS } from '../../shared/constants';
import type { ExperimentConfig } from '../../shared/schema';

export interface WorkEstimate {
  /** Upper bound: strategies can stop before the round limit. */
  readonly totalRounds: number;
  readonly budget: number;
  readonly isOverBudget: boolean;
}

export function estimateWork(
  config: Pick<ExperimentConfig, 'simulations' | 'strategies' | 'roundLimit'>,
): WorkEstimate {
  const totalRounds = config.simulations * config.strategies.length * config.roundLimit;
  return {
    totalRounds,
    budget: LIMITS.totalRoundsBudget,
    isOverBudget: totalRounds > LIMITS.totalRoundsBudget,
  };
}
