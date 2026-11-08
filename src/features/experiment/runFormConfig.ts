import { LIMITS } from '../../shared/constants';
import { formatCentsPlain, parseUnitsToCents } from '../../shared/money';
import { type ExperimentConfig, type RuleSet, experimentConfigSchema } from '../../shared/schema';
import { STRATEGIES, STRATEGY_IDS, type StrategyId } from '../../shared/strategies';
import type { TargetId } from '../../shared/targets';

// Turns the setup form (plan 8.1) into a validated ExperimentConfig. Text inputs stay as typed;
// money is typed in currency units and converted to integer cents once, here (spec 9). Every
// value then goes through the shared Zod schema, the same one used for imported JSON.

export interface RunFormDraft {
  readonly simulations: string;
  readonly roundLimit: string;
  readonly seed: string;
  readonly displayedSimulations: string;
  readonly workerCount: ExperimentConfig['workerCount'];
  readonly startingBankroll: string;
  readonly tableMinimum: string;
  readonly unit: string;
  /** Blank means no table maximum. */
  readonly tableMaximum: string;
  readonly targetMode: ExperimentConfig['targetMode'];
  /** Used only in single-target mode, but kept so switching modes does not lose it. */
  readonly singleTarget: TargetId;
  readonly strategies: readonly StrategyId[];
  readonly paroliStreakLength: number;
  /** Comma- or space-separated round numbers. */
  readonly checkpoints: string;
  readonly rules: RuleSet;
}

export type RunFormField =
  | 'simulations'
  | 'roundLimit'
  | 'seed'
  | 'displayedSimulations'
  | 'startingBankroll'
  | 'tableMinimum'
  | 'unit'
  | 'tableMaximum'
  | 'singleTarget'
  | 'strategies'
  | 'checkpoints'
  | 'form';

export type RunFormErrors = Partial<Record<RunFormField, string>>;

export type RunFormResult =
  | { readonly ok: true; readonly config: ExperimentConfig; readonly notes: readonly string[] }
  | { readonly ok: false; readonly errors: RunFormErrors };

const WHOLE_NUMBER = /^\d+$/;
const FIELD_NAMES: readonly RunFormField[] = [
  'simulations',
  'roundLimit',
  'displayedSimulations',
  'startingBankroll',
  'tableMinimum',
  'unit',
  'tableMaximum',
  'singleTarget',
  'strategies',
  'checkpoints',
];

function parseWhole(text: string): number | null {
  const trimmed = text.trim().replaceAll(',', '');
  return WHOLE_NUMBER.test(trimmed) ? Number(trimmed) : null;
}

const formatCount = (value: number) => value.toLocaleString('en-AU');

export function draftFromConfig(config: ExperimentConfig): RunFormDraft {
  return {
    simulations: String(config.simulations),
    roundLimit: String(config.roundLimit),
    seed: String(config.experimentSeed),
    displayedSimulations: String(config.displayedSimulations),
    workerCount: config.workerCount,
    startingBankroll: formatCentsPlain(config.startingBankroll),
    tableMinimum: formatCentsPlain(config.tableMinimum),
    unit: formatCentsPlain(config.unit),
    tableMaximum: config.tableMaximum === null ? '' : formatCentsPlain(config.tableMaximum),
    targetMode: config.targetMode,
    singleTarget: config.singleTarget ?? '1x',
    strategies: config.strategies.map((strategy) => strategy.id),
    paroliStreakLength: config.paroliStreakLength,
    checkpoints: config.checkpoints.join(', '),
    rules: config.rules,
  };
}

function parseMoney(text: string, errors: RunFormErrors, field: RunFormField): number | null {
  const cents = parseUnitsToCents(text);
  if (cents === null || cents <= 0) {
    errors[field] = 'Enter an amount greater than zero, like 20 or 20.50.';
    return null;
  }
  return cents;
}

export function buildConfig(draft: RunFormDraft, base: ExperimentConfig): RunFormResult {
  const errors: RunFormErrors = {};
  const notes: string[] = [];

  const simulations = parseWhole(draft.simulations);
  if (simulations === null || simulations < 1 || simulations > LIMITS.maxSimulations) {
    errors.simulations = `Enter a whole number from 1 to ${formatCount(LIMITS.maxSimulations)}.`;
  }
  const roundLimit = parseWhole(draft.roundLimit);
  if (roundLimit === null || roundLimit < 1 || roundLimit > LIMITS.maxRoundLimit) {
    errors.roundLimit = `Enter a whole number from 1 to ${formatCount(LIMITS.maxRoundLimit)}.`;
  }
  const seed = parseWhole(draft.seed);
  if (seed === null || seed > LIMITS.maxUint32) {
    errors.seed = `Enter a whole number from 0 to ${formatCount(LIMITS.maxUint32)}.`;
  }
  const displayed = parseWhole(draft.displayedSimulations);
  if (displayed === null || displayed < 1 || displayed > LIMITS.maxDisplayedSimulations) {
    errors.displayedSimulations = `Enter a whole number from 1 to ${String(LIMITS.maxDisplayedSimulations)}.`;
  }
  const startingBankroll = parseMoney(draft.startingBankroll, errors, 'startingBankroll');
  const tableMinimum = parseMoney(draft.tableMinimum, errors, 'tableMinimum');
  const unit = parseMoney(draft.unit, errors, 'unit');
  const tableMaximum =
    draft.tableMaximum.trim() === ''
      ? null
      : parseMoney(draft.tableMaximum, errors, 'tableMaximum');
  if (draft.strategies.length === 0) errors.strategies = 'Choose at least one strategy.';

  const checkpointTexts = draft.checkpoints.split(/[\s,]+/).filter((text) => text !== '');
  const parsedCheckpoints = checkpointTexts.map(parseWhole);
  if (parsedCheckpoints.some((round) => round === null || round < 1)) {
    errors.checkpoints = 'List whole round numbers, for example 50, 100, 250.';
  }

  if (
    Object.keys(errors).length > 0 ||
    simulations === null ||
    roundLimit === null ||
    seed === null ||
    displayed === null ||
    startingBankroll === null ||
    tableMinimum === null ||
    unit === null
  ) {
    return { ok: false, errors };
  }

  // Spec 9: checkpoints are ascending and unique; any above the round limit are removed, and
  // the UI says so. Reordering or dropping duplicates is reported too, never done silently.
  const requested = parsedCheckpoints.filter((round): round is number => round !== null);
  const ordered = [...new Set(requested)].sort((a, b) => a - b);
  if (ordered.length !== requested.length || ordered.some((round, i) => round !== requested[i])) {
    notes.push('Checkpoints were sorted and duplicates removed.');
  }
  const checkpoints = ordered.filter((round) => round <= roundLimit);
  const removed = ordered.filter((round) => round > roundLimit);
  if (removed.length > 0) {
    notes.push(
      `Checkpoints above ${formatCount(roundLimit)} rounds were removed: ${removed.map(formatCount).join(', ')}.`,
    );
  }
  // Spec 9: displayedSimulations is lowered to the number of simulations, and the UI says so.
  const displayedSimulations = Math.min(displayed, simulations);
  if (displayedSimulations < displayed) {
    notes.push(
      `Only ${formatCount(simulations)} simulation(s) will run, so only that many panels can be shown.`,
    );
  }

  const parsed = experimentConfigSchema.safeParse({
    ...base,
    simulations,
    roundLimit,
    experimentSeed: seed,
    displayedSimulations,
    workerCount: draft.workerCount,
    startingBankroll,
    tableMinimum,
    unit,
    tableMaximum,
    targetMode: draft.targetMode,
    singleTarget: draft.targetMode === 'single' ? draft.singleTarget : null,
    // Keep the canonical strategy order so colours and tables are stable.
    strategies: STRATEGY_IDS.filter((id) => draft.strategies.includes(id)).map((id) => ({
      id,
      version: STRATEGIES[id].version,
    })),
    paroliStreakLength: draft.paroliStreakLength,
    rules: draft.rules,
    checkpoints,
  });
  if (!parsed.success) {
    // Map each schema issue (cross-field rules included) back to its input.
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      const field = FIELD_NAMES.find((name) => name === key) ?? 'form';
      errors[field] ??= issue.message;
    }
    return { ok: false, errors };
  }
  return { ok: true, config: parsed.data, notes };
}
