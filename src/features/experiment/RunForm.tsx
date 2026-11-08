import { LIMITS } from '../../shared/constants';
import type { ExperimentConfig } from '../../shared/schema';
import { STRATEGIES, STRATEGY_IDS, type StrategyId } from '../../shared/strategies';
import type { RunFormDraft, RunFormField } from './runFormConfig';
import { SettingsSection } from './SettingsSection';

// Minimal editable inputs for the Phase 6 end-to-end slice. The full setup screen is Phase 8.

interface RunFormProps {
  readonly draft: RunFormDraft;
  readonly errors: Partial<Record<RunFormField, string>>;
  readonly disabled: boolean;
  readonly autoWorkers: number;
  readonly onChange: (draft: RunFormDraft) => void;
  readonly onNewSeed: () => void;
}

const inputClass =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm tabular-nums dark:border-slate-700 dark:bg-slate-950 disabled:opacity-60';

function FieldError({
  id,
  message,
}: {
  readonly id: string;
  readonly message: string | undefined;
}) {
  if (message === undefined) return null;
  return (
    <p id={id} className="mt-1 text-xs text-red-700 dark:text-red-400">
      {message}
    </p>
  );
}

export function RunForm({
  draft,
  errors,
  disabled,
  autoWorkers,
  onChange,
  onNewSeed,
}: RunFormProps) {
  const toggleStrategy = (id: StrategyId, checked: boolean) => {
    onChange({
      ...draft,
      strategies: checked
        ? [...draft.strategies, id]
        : draft.strategies.filter((selected) => selected !== id),
    });
  };

  return (
    <SettingsSection title="Run settings">
      <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          Number of simulations
          <input
            className={inputClass}
            inputMode="numeric"
            value={draft.simulations}
            aria-invalid={errors.simulations !== undefined}
            aria-describedby="simulations-error"
            onChange={(event) => {
              onChange({ ...draft, simulations: event.target.value });
            }}
          />
          <FieldError id="simulations-error" message={errors.simulations} />
        </label>

        <label className="text-sm">
          Rounds per simulation (limit)
          <input
            className={inputClass}
            inputMode="numeric"
            value={draft.roundLimit}
            aria-invalid={errors.roundLimit !== undefined}
            aria-describedby="round-limit-error"
            onChange={(event) => {
              onChange({ ...draft, roundLimit: event.target.value });
            }}
          />
          <FieldError id="round-limit-error" message={errors.roundLimit} />
        </label>

        <div className="text-sm">
          <label htmlFor="seed">Seed</label>
          <div className="flex gap-2">
            <input
              id="seed"
              className={inputClass}
              inputMode="numeric"
              value={draft.seed}
              aria-invalid={errors.seed !== undefined}
              aria-describedby="seed-error"
              onChange={(event) => {
                onChange({ ...draft, seed: event.target.value });
              }}
            />
            <button
              type="button"
              onClick={onNewSeed}
              className="mt-1 shrink-0 rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700"
            >
              New seed
            </button>
          </div>
          <FieldError id="seed-error" message={errors.seed} />
        </div>

        <label className="text-sm">
          Workers
          <select
            className={inputClass}
            value={String(draft.workerCount)}
            onChange={(event) => {
              const value = event.target.value;
              onChange({
                ...draft,
                workerCount:
                  value === 'auto'
                    ? 'auto'
                    : (Number(value) as Exclude<ExperimentConfig['workerCount'], 'auto'>),
              });
            }}
          >
            <option value="auto">Auto ({autoWorkers})</option>
            {Array.from({ length: LIMITS.maxWorkers }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Workers share out the simulations; the count never changes results.
          </span>
        </label>

        <fieldset className="text-sm sm:col-span-2">
          <legend>Strategies</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {STRATEGY_IDS.map((id) => (
              <label key={id} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={draft.strategies.includes(id)}
                  onChange={(event) => {
                    toggleStrategy(id, event.target.checked);
                  }}
                />
                {STRATEGIES[id].name}
              </label>
            ))}
          </div>
          <FieldError id="strategies-error" message={errors.strategies} />
        </fieldset>
      </fieldset>
    </SettingsSection>
  );
}
