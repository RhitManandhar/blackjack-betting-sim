import type { ExperimentConfig } from '../../shared/schema';
import type { StrategyId } from '../../shared/strategies';
import { TARGET_IDS, targetAmount } from '../../shared/targets';
import { type RoundSettlement, createRoundSettlement } from '../blackjack/round';
import { getBettingStrategy } from '../betting/registry';
import type { BettingStrategy, StrategyParams, StrategyStateBase } from '../betting/strategy';
import { type RoundSourceFactory, blackjackRoundSources } from './roundSource';

// Everything a simulation needs that depends only on the configuration, prepared once per run
// (or once per worker) so the per-simulation code does no setup work.

export interface PlannedStrategy {
  readonly id: StrategyId;
  readonly version: string;
  readonly strategy: BettingStrategy<StrategyStateBase>;
}

export interface SimulationPlan {
  readonly experimentSeed: number;
  readonly startingBankroll: number;
  readonly tableMaximum: number | null;
  readonly roundLimit: number;
  readonly params: StrategyParams;
  readonly strategies: readonly PlannedStrategy[];
  /** Target amounts in TARGET_IDS order (spec 3.1). */
  readonly targetAmounts: readonly number[];
  /** Cumulative profit at which a strategy stops with `target_reached`, or null (spec 3.2). */
  readonly stopTarget: number | null;
  readonly checkpoints: readonly number[];
  readonly displayedSimulations: number;
  /** Curve sampling stride k = max(1, ceil(roundLimit / 200)) (spec 10.9). */
  readonly curveStride: number;
  readonly createRoundSource: RoundSourceFactory;
  /** Scratch settlement reused for every round. */
  readonly settlement: RoundSettlement;
}

const CURVE_POINTS_TARGET = 200;

export function stopTargetFor(config: ExperimentConfig): number | null {
  switch (config.targetMode) {
    case 'none':
      return null;
    case 'single':
      if (config.singleTarget === null) throw new Error('Single-target mode needs a target');
      return targetAmount(config.startingBankroll, config.singleTarget);
    case 'compare_all':
      return targetAmount(config.startingBankroll, '2_5x');
  }
}

export function createSimulationPlan(
  config: ExperimentConfig,
  createRoundSource: RoundSourceFactory = blackjackRoundSources(config.rules),
): SimulationPlan {
  return {
    experimentSeed: config.experimentSeed,
    startingBankroll: config.startingBankroll,
    tableMaximum: config.tableMaximum,
    roundLimit: config.roundLimit,
    params: {
      unit: config.unit,
      tableMinimum: config.tableMinimum,
      paroliStreakLength: config.paroliStreakLength,
    },
    strategies: config.strategies.map(({ id, version }) => {
      const strategy = getBettingStrategy(id);
      if (strategy.version !== version) {
        throw new Error(`Strategy ${id} is ${strategy.version}, but ${version} was requested`);
      }
      return { id, version, strategy };
    }),
    targetAmounts: TARGET_IDS.map((target) => targetAmount(config.startingBankroll, target)),
    stopTarget: stopTargetFor(config),
    checkpoints: [...config.checkpoints],
    displayedSimulations: Math.min(config.displayedSimulations, config.simulations),
    curveStride: Math.max(1, Math.ceil(config.roundLimit / CURVE_POINTS_TARGET)),
    createRoundSource,
    settlement: createRoundSettlement(),
  };
}
