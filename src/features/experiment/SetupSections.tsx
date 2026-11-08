import { LIMITS } from '../../shared/constants';
import { formatCentsGrouped, parseUnitsToCents } from '../../shared/money';
import type { ExperimentConfig } from '../../shared/schema';
import { STRATEGIES, STRATEGY_IDS } from '../../shared/strategies';
import { TARGET_IDS, TARGET_MULTIPLES, type TargetId, targetAmount } from '../../shared/targets';
import { FieldError, TextField, inputClass } from './fields';
import type { RunFormDraft, RunFormErrors } from './runFormConfig';
import { SettingsSection } from './SettingsSection';

// The setup screen's sections (plan 8.1). Each edits part of the draft; validation messages come
// from buildConfig, so every rule lives in one place.

interface SectionProps {
  readonly draft: RunFormDraft;
  readonly errors: RunFormErrors;
  readonly onChange: (draft: RunFormDraft) => void;
}

export function SimulationSizeSection({
  draft,
  errors,
  onChange,
  autoWorkers,
  onNewSeed,
}: SectionProps & { readonly autoWorkers: number; readonly onNewSeed: () => void }) {
  return (
    <SettingsSection title="Simulation size">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Number of simulations"
          value={draft.simulations}
          error={errors.simulations}
          hint="Each simulation plays every chosen strategy on the same cards."
          onChange={(simulations) => {
            onChange({ ...draft, simulations });
          }}
        />
        <TextField
          label="Rounds per simulation (limit)"
          value={draft.roundLimit}
          error={errors.roundLimit}
          onChange={(roundLimit) => {
            onChange({ ...draft, roundLimit });
          }}
        />
        <div className="flex items-end gap-2">
          <div className="grow">
            <TextField
              label="Seed"
              value={draft.seed}
              error={errors.seed}
              onChange={(seed) => {
                onChange({ ...draft, seed });
              }}
            />
          </div>
          <button
            type="button"
            onClick={onNewSeed}
            className="mb-px shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700"
          >
            New seed
          </button>
        </div>
        <TextField
          label={`Simulations shown on screen (1–${String(LIMITS.maxDisplayedSimulations)})`}
          value={draft.displayedSimulations}
          error={errors.displayedSimulations}
          hint="Simulations 1 to n each get a comparison panel."
          onChange={(displayedSimulations) => {
            onChange({ ...draft, displayedSimulations });
          }}
        />
        <label className="text-sm">
          Workers
          <select
            className={inputClass}
            value={String(draft.workerCount)}
            onChange={(event) => {
              const value = event.target.value;
              const count = Number(value);
              onChange({
                ...draft,
                workerCount:
                  value === 'auto' || (count !== 1 && count !== 2 && count !== 3 && count !== 4)
                    ? 'auto'
                    : count,
              });
            }}
          >
            <option value="auto">Auto ({autoWorkers})</option>
            {[1, 2, 3, 4].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Workers share out the simulations; the count never changes results. Fewer workers use
            less CPU.
          </span>
        </label>
      </div>
    </SettingsSection>
  );
}

export function BankrollSection({ draft, errors, onChange }: SectionProps) {
  return (
    <SettingsSection title="Bankroll and limits (AUD)">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Starting bankroll"
          inputMode="decimal"
          value={draft.startingBankroll}
          error={errors.startingBankroll}
          onChange={(startingBankroll) => {
            onChange({ ...draft, startingBankroll });
          }}
        />
        <TextField
          label="Table minimum"
          inputMode="decimal"
          value={draft.tableMinimum}
          error={errors.tableMinimum}
          onChange={(tableMinimum) => {
            onChange({ ...draft, tableMinimum });
          }}
        />
        <TextField
          label="Starting bet (unit)"
          inputMode="decimal"
          value={draft.unit}
          error={errors.unit}
          hint="Every strategy's base unit; at least the table minimum."
          onChange={(unit) => {
            onChange({ ...draft, unit });
          }}
        />
        <TextField
          label="Table maximum (optional)"
          inputMode="decimal"
          value={draft.tableMaximum}
          error={errors.tableMaximum}
          placeholder="None"
          hint="Leave blank for no maximum. A bet above it stops that strategy as blocked."
          onChange={(tableMaximum) => {
            onChange({ ...draft, tableMaximum });
          }}
        />
      </div>
    </SettingsSection>
  );
}

const MODE_LABELS: Record<ExperimentConfig['targetMode'], string> = {
  none: 'No target',
  single: 'Stop at one target',
  compare_all: 'Compare all four targets',
};

export function StopConditionsSection({ draft, errors, onChange }: SectionProps) {
  const bankroll = parseUnitsToCents(draft.startingBankroll);
  return (
    <SettingsSection title="Stop conditions">
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
        Each strategy stops at whichever comes first: round limit, profit target, or inability to
        place its next bet.
      </p>
      <fieldset className="text-sm">
        <legend className="sr-only">Target mode</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {(Object.keys(MODE_LABELS) as ExperimentConfig['targetMode'][]).map((mode) => (
            <label key={mode} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="target-mode"
                checked={draft.targetMode === mode}
                onChange={() => {
                  onChange({ ...draft, targetMode: mode });
                }}
              />
              {MODE_LABELS[mode]}
            </label>
          ))}
        </div>
      </fieldset>
      {draft.targetMode === 'single' && (
        <label className="mt-3 block text-sm">
          Target
          <select
            className={inputClass}
            value={draft.singleTarget}
            onChange={(event) => {
              const target = TARGET_IDS.find((id) => id === event.target.value);
              if (target !== undefined) onChange({ ...draft, singleTarget: target });
            }}
          >
            {TARGET_IDS.map((target) => (
              <option key={target} value={target}>
                {TARGET_MULTIPLES[target].label} of the starting bankroll
              </option>
            ))}
          </select>
          <FieldError id="single-target-error" message={errors.singleTarget} />
        </label>
      )}
      {draft.targetMode === 'compare_all' && (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Every strategy plays until 2.5x, recording when it first reaches each target. Final profit
          is therefore capped near 2.5x and is labelled so.
        </p>
      )}
      {bankroll !== null && bankroll > 0 && (
        <TargetAmounts
          bankroll={bankroll}
          highlight={draft.targetMode === 'single' ? draft.singleTarget : null}
        />
      )}
    </SettingsSection>
  );
}

function TargetAmounts({
  bankroll,
  highlight,
}: {
  readonly bankroll: number;
  readonly highlight: TargetId | null;
}) {
  return (
    <table className="mt-3 w-full text-sm">
      <caption className="sr-only">Profit target amounts for this bankroll</caption>
      <thead>
        <tr className="text-left text-slate-600 dark:text-slate-400">
          <th scope="col" className="py-1 font-normal">
            Target
          </th>
          <th scope="col" className="py-1 text-right font-normal">
            Net profit
          </th>
          <th scope="col" className="py-1 text-right font-normal">
            Bankroll at target
          </th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {TARGET_IDS.map((target) => {
          const amount = targetAmount(bankroll, target);
          return (
            <tr key={target} className={target === highlight ? 'font-semibold' : undefined}>
              <th scope="row" className="py-1 text-left font-medium">
                {TARGET_MULTIPLES[target].label}
              </th>
              <td className="py-1 text-right">+{formatCentsGrouped(amount)}</td>
              <td className="py-1 text-right">{formatCentsGrouped(bankroll + amount)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function StrategiesSection({ draft, errors, onChange }: SectionProps) {
  const allSelected = draft.strategies.length === STRATEGY_IDS.length;
  return (
    <SettingsSection title="Strategies">
      <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
        A strategy decides only the next bet. Every hand is played by perfect basic strategy. No
        betting system changes the house edge.
      </p>
      <ul className="space-y-2">
        {STRATEGY_IDS.map((id) => {
          const info = STRATEGIES[id];
          return (
            <li key={id} className="text-sm">
              <label className="flex items-center gap-1.5 font-medium">
                <input
                  type="checkbox"
                  checked={draft.strategies.includes(id)}
                  onChange={(event) => {
                    onChange({
                      ...draft,
                      strategies: event.target.checked
                        ? [...draft.strategies, id]
                        : draft.strategies.filter((selected) => selected !== id),
                    });
                  }}
                />
                {info.name}
                <code className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  {info.version}
                </code>
              </label>
              <details className="ml-6">
                <summary className="cursor-pointer text-xs text-teal-700 dark:text-teal-400">
                  About this system
                </summary>
                <p className="mt-1 text-slate-700 dark:text-slate-300">
                  {info.rule.replace('{N}', String(draft.paroliStreakLength))}
                </p>
                <p className="mt-1 text-slate-600 dark:text-slate-400">
                  <span className="font-medium">Main risk:</span> {info.mainRisk}
                </p>
              </details>
            </li>
          );
        })}
      </ul>
      <FieldError id="strategies-error" message={errors.strategies} />
      <div className="mt-3 flex flex-wrap items-end gap-4 text-sm">
        <button
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1.5 dark:border-slate-700"
          onClick={() => {
            onChange({ ...draft, strategies: allSelected ? [] : [...STRATEGY_IDS] });
          }}
        >
          {allSelected ? 'Clear all' : 'Select all'}
        </button>
        <label>
          Classic Paroli: reset after
          <select
            className={`${inputClass} w-auto`}
            value={String(draft.paroliStreakLength)}
            onChange={(event) => {
              onChange({ ...draft, paroliStreakLength: Number(event.target.value) });
            }}
          >
            {[2, 3, 4, 5].map((streak) => (
              <option key={streak} value={streak}>
                {streak} wins in a row
              </option>
            ))}
          </select>
        </label>
      </div>
    </SettingsSection>
  );
}

export function CheckpointsSection({ draft, errors, onChange }: SectionProps) {
  return (
    <SettingsSection title="Checkpoints">
      <TextField
        label="Rounds to report on"
        inputMode="text"
        value={draft.checkpoints}
        error={errors.checkpoints}
        hint="Comma-separated round numbers, for example 50, 100, 250, 500, 1000. Strategies that stopped earlier are carried forward at their final profit."
        onChange={(checkpoints) => {
          onChange({ ...draft, checkpoints });
        }}
      />
    </SettingsSection>
  );
}
