import { CONFIG_SCHEMA_VERSION, CURRENCY, DEFAULTS, SPEC_VERSION } from './constants';
import type { ExperimentConfig, RuleSet } from './schema';
import { STRATEGIES, STRATEGY_IDS } from './strategies';

/** Spec 5.1 defaults: the "Recommended baseline" preset. */
export const BASELINE_RULES: RuleSet = {
  decks: 6,
  soft17: 'S17',
  blackjackPayout: '3:2',
  doubleAfterSplit: true,
  doubleOn: 'any-two',
  lateSurrender: false,
  maxSplitHands: 4,
  resplitAces: false,
  penetrationPercent: 75,
};

/** The seed is created by the caller (the UI layer), never here. */
export function createDefaultConfig(
  experimentId: string,
  experimentSeed: number,
): ExperimentConfig {
  return {
    schemaVersion: CONFIG_SCHEMA_VERSION,
    specVersion: SPEC_VERSION,
    experimentId,
    experimentSeed,
    simulations: DEFAULTS.simulations,
    roundLimit: DEFAULTS.roundLimit,
    currency: CURRENCY,
    startingBankroll: DEFAULTS.startingBankroll,
    tableMinimum: DEFAULTS.tableMinimum,
    unit: DEFAULTS.tableMinimum,
    tableMaximum: null,
    targetMode: 'none',
    singleTarget: null,
    strategies: STRATEGY_IDS.map((id) => ({ id, version: STRATEGIES[id].version })),
    paroliStreakLength: DEFAULTS.paroliStreakLength,
    rules: { ...BASELINE_RULES },
    checkpoints: [...DEFAULTS.checkpoints],
    displayedSimulations: DEFAULTS.displayedSimulations,
    workerCount: 'auto',
  };
}
