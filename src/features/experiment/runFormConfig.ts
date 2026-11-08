import { DEFAULTS, LIMITS } from '../../shared/constants';
import { type ExperimentConfig, type RuleSet, experimentConfigSchema } from '../../shared/schema';
import { STRATEGIES, STRATEGY_IDS, type StrategyId } from '../../shared/strategies';

// Turns the run form into a validated ExperimentConfig. Table rules are editable from Phase 7;
// the remaining settings keep their defaults until the full setup screen (Phase 8). Validation runs through the shared Zod schema,
// the same one used for imported JSON and worker messages.

export interface RunFormDraft {
  readonly simulations: string;
  readonly roundLimit: string;
  readonly seed: string;
  readonly strategies: readonly StrategyId[];
  readonly workerCount: ExperimentConfig['workerCount'];
  readonly rules: RuleSet;
}

export type RunFormField = 'simulations' | 'roundLimit' | 'seed' | 'strategies' | 'form';

export type RunFormResult =
  | { readonly ok: true; readonly config: ExperimentConfig; readonly notes: readonly string[] }
  | { readonly ok: false; readonly errors: Partial<Record<RunFormField, string>> };

const WHOLE_NUMBER = /^\d+$/;

function parseWhole(text: string): number | null {
  const trimmed = text.trim().replaceAll(',', '');
  return WHOLE_NUMBER.test(trimmed) ? Number(trimmed) : null;
}

export function draftFromConfig(config: ExperimentConfig): RunFormDraft {
  return {
    simulations: String(config.simulations),
    roundLimit: String(config.roundLimit),
    seed: String(config.experimentSeed),
    strategies: config.strategies.map((strategy) => strategy.id),
    workerCount: config.workerCount,
    rules: config.rules,
  };
}

export function buildConfig(draft: RunFormDraft, base: ExperimentConfig): RunFormResult {
  const errors: Partial<Record<RunFormField, string>> = {};
  const simulations = parseWhole(draft.simulations);
  const roundLimit = parseWhole(draft.roundLimit);
  const seed = parseWhole(draft.seed);

  if (simulations === null || simulations < 1 || simulations > LIMITS.maxSimulations) {
    errors.simulations = `Enter a whole number from 1 to ${LIMITS.maxSimulations.toLocaleString('en-AU')}.`;
  }
  if (roundLimit === null || roundLimit < 1 || roundLimit > LIMITS.maxRoundLimit) {
    errors.roundLimit = `Enter a whole number from 1 to ${LIMITS.maxRoundLimit.toLocaleString('en-AU')}.`;
  }
  if (seed === null || seed > LIMITS.maxUint32) {
    errors.seed = `Enter a whole number from 0 to ${LIMITS.maxUint32.toLocaleString('en-AU')}.`;
  }
  if (draft.strategies.length === 0) errors.strategies = 'Choose at least one strategy.';
  if (
    simulations === null ||
    roundLimit === null ||
    seed === null ||
    Object.keys(errors).length > 0
  ) {
    return { ok: false, errors };
  }

  const notes: string[] = [];
  // Spec 9: checkpoints above the round limit are removed, and the UI says so.
  const checkpoints = DEFAULTS.checkpoints.filter((round) => round <= roundLimit);
  if (checkpoints.length < DEFAULTS.checkpoints.length) {
    notes.push(
      `Checkpoints above ${roundLimit.toLocaleString('en-AU')} rounds were removed: ${DEFAULTS.checkpoints
        .filter((round) => round > roundLimit)
        .map((round) => round.toLocaleString('en-AU'))
        .join(', ')}.`,
    );
  }
  // Spec 9: displayedSimulations is lowered to the number of simulations, and the UI says so.
  const displayedSimulations = Math.min(DEFAULTS.displayedSimulations, simulations);
  if (displayedSimulations < DEFAULTS.displayedSimulations) {
    notes.push(
      `Only ${String(simulations)} simulation(s) will run, so only that many can be shown.`,
    );
  }

  const parsed = experimentConfigSchema.safeParse({
    ...base,
    simulations,
    roundLimit,
    experimentSeed: seed,
    // Keep the canonical strategy order so colours and tables are stable.
    strategies: STRATEGY_IDS.filter((id) => draft.strategies.includes(id)).map((id) => ({
      id,
      version: STRATEGIES[id].version,
    })),
    workerCount: draft.workerCount,
    rules: draft.rules,
    checkpoints,
    displayedSimulations,
  });
  if (!parsed.success) {
    return {
      ok: false,
      errors: { form: parsed.error.issues.map((issue) => issue.message).join(' ') },
    };
  }
  return { ok: true, config: parsed.data, notes };
}
