import { z } from 'zod';
import { CONFIG_SCHEMA_VERSION, CURRENCY, LIMITS, SPEC_VERSION } from './constants';
import { isCents } from './money';
import { STRATEGIES, STRATEGY_IDS } from './strategies';
import { TARGET_IDS } from './targets';

// Spec section 9. This schema validates every external boundary:
// form input, imported JSON and worker messages.

const positiveCents = z
  .number()
  .refine(isCents, 'Must be a whole number of cents')
  .refine((value) => value > 0, 'Must be greater than zero');

/** Spec section 5.1. Which options the UI offers is gated separately, by validated tier. */
export const ruleSetSchema = z.strictObject({
  decks: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(6), z.literal(8)]),
  soft17: z.enum(['S17', 'H17']),
  blackjackPayout: z.enum(['3:2', '6:5']),
  doubleAfterSplit: z.boolean(),
  doubleOn: z.enum(['any-two', '9-11', '10-11']),
  lateSurrender: z.boolean(),
  maxSplitHands: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  resplitAces: z.boolean(),
  // The configurable penetration range is decided in Phase 7 (spec 5.1, Tier 3).
  penetrationPercent: z.literal(75),
});

export type RuleSet = z.infer<typeof ruleSetSchema>;

const strategySelectionSchema = z
  .strictObject({
    id: z.enum(STRATEGY_IDS),
    version: z.string(),
  })
  .refine((selection) => STRATEGIES[selection.id].version === selection.version, {
    message: 'Unknown strategy version for this strategy id',
    path: ['version'],
  });

export const experimentConfigSchema = z
  .strictObject({
    schemaVersion: z.literal(CONFIG_SCHEMA_VERSION),
    specVersion: z.literal(SPEC_VERSION),
    experimentId: z.string().min(1),
    experimentSeed: z.int().min(0).max(LIMITS.maxUint32),
    simulations: z.int().min(1).max(LIMITS.maxSimulations),
    roundLimit: z.int().min(1).max(LIMITS.maxRoundLimit),
    currency: z.literal(CURRENCY),
    startingBankroll: positiveCents,
    tableMinimum: positiveCents,
    unit: positiveCents,
    tableMaximum: positiveCents.nullable(),
    targetMode: z.enum(['none', 'single', 'compare_all']),
    singleTarget: z.enum(TARGET_IDS).nullable(),
    strategies: z.array(strategySelectionSchema).min(1).max(STRATEGY_IDS.length),
    paroliStreakLength: z.int().min(LIMITS.minParoliStreak).max(LIMITS.maxParoliStreak),
    rules: ruleSetSchema,
    checkpoints: z.array(z.int().min(1)),
    displayedSimulations: z.int().min(1).max(LIMITS.maxDisplayedSimulations),
    workerCount: z.union([
      z.literal('auto'),
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
    ]),
  })
  .superRefine((config, context) => {
    const issue = (path: string, message: string): void => {
      context.addIssue({ code: 'custom', path: [path], message });
    };

    if (config.tableMinimum > config.unit) {
      issue('unit', 'Starting bet must be at least the table minimum');
    }
    if (config.unit > config.startingBankroll) {
      issue('unit', 'Starting bet cannot exceed the starting bankroll');
    }
    if (config.tableMaximum !== null && config.tableMaximum < config.unit) {
      issue('tableMaximum', 'Table maximum must be at least the starting bet');
    }

    if (config.targetMode === 'single' && config.singleTarget === null) {
      issue('singleTarget', 'Choose a target for single-target mode');
    }
    if (config.targetMode !== 'single' && config.singleTarget !== null) {
      issue('singleTarget', 'A single target is only used in single-target mode');
    }

    const strategyIds = config.strategies.map((strategy) => strategy.id);
    if (new Set(strategyIds).size !== strategyIds.length) {
      issue('strategies', 'Each strategy can be selected only once');
    }

    const isStrictlyAscending = config.checkpoints.every(
      (round, index) => index === 0 || round > (config.checkpoints[index - 1] ?? 0),
    );
    if (!isStrictlyAscending) {
      issue('checkpoints', 'Checkpoints must be unique and in ascending order');
    }
    if (config.checkpoints.some((round) => round > config.roundLimit)) {
      issue('checkpoints', 'Checkpoints cannot exceed the round limit');
    }

    if (config.displayedSimulations > config.simulations) {
      issue('displayedSimulations', 'Cannot show more simulations than are run');
    }
  });

export type ExperimentConfig = z.infer<typeof experimentConfigSchema>;
