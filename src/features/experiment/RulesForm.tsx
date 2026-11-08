import { BASELINE_RULES } from '../../shared/defaults';
import type { RuleSet } from '../../shared/schema';
import {
  DECK_OPTIONS,
  DOUBLE_OPTIONS,
  PENETRATION_OPTIONS,
  SPLIT_HAND_OPTIONS,
} from './ruleOptions';
import { SettingsSection } from './SettingsSection';

// Table-rule controls (plan 8.1, Phase 7). Only validated options are offered (ruleOptions.ts).
// Dealer peek and insurance are fixed and shown in the settings overview.

const selectClass =
  'mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950 disabled:opacity-60';

interface RulesFormProps {
  readonly rules: RuleSet;
  readonly disabled: boolean;
  readonly onChange: (rules: RuleSet) => void;
}

function pick<T>(options: readonly T[], raw: string, toValue: (option: T) => string): T {
  const found = options.find((option) => toValue(option) === raw);
  if (found === undefined) throw new Error(`Unknown option ${raw}`);
  return found;
}

export function RulesForm({ rules, disabled, onChange }: RulesFormProps) {
  const set = (change: Partial<RuleSet>) => {
    onChange({ ...rules, ...change });
  };
  const isBaseline = JSON.stringify(rules) === JSON.stringify(BASELINE_RULES);

  return (
    <SettingsSection title="Table rules">
      <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          Decks
          <select
            className={selectClass}
            value={String(rules.decks)}
            onChange={(event) => {
              set({ decks: pick(DECK_OPTIONS, event.target.value, String) });
            }}
          >
            {DECK_OPTIONS.map((decks) => (
              <option key={decks} value={decks}>
                {decks}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Dealer on soft 17
          <select
            className={selectClass}
            value={rules.soft17}
            onChange={(event) => {
              set({ soft17: event.target.value === 'H17' ? 'H17' : 'S17' });
            }}
          >
            <option value="S17">Stands (S17)</option>
            <option value="H17">Hits (H17)</option>
          </select>
        </label>

        <label className="text-sm">
          Blackjack pays
          <select
            className={selectClass}
            value={rules.blackjackPayout}
            onChange={(event) => {
              set({ blackjackPayout: event.target.value === '6:5' ? '6:5' : '3:2' });
            }}
          >
            <option value="3:2">3:2</option>
            <option value="6:5">6:5</option>
          </select>
        </label>

        <label className="text-sm">
          Doubling allowed on
          <select
            className={selectClass}
            value={rules.doubleOn}
            onChange={(event) => {
              set({ doubleOn: pick(DOUBLE_OPTIONS, event.target.value, (o) => o.value).value });
            }}
          >
            {DOUBLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Maximum hands after splitting
          <select
            className={selectClass}
            value={String(rules.maxSplitHands)}
            onChange={(event) => {
              set({ maxSplitHands: pick(SPLIT_HAND_OPTIONS, event.target.value, String) });
            }}
          >
            {SPLIT_HAND_OPTIONS.map((hands) => (
              <option key={hands} value={hands}>
                {hands}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Shoe penetration
          <select
            className={selectClass}
            value={String(rules.penetrationPercent)}
            onChange={(event) => {
              set({ penetrationPercent: pick(PENETRATION_OPTIONS, event.target.value, String) });
            }}
          >
            {PENETRATION_OPTIONS.map((percent) => (
              <option key={percent} value={percent}>
                {percent}%
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1 text-sm sm:col-span-3 sm:flex-row sm:gap-6">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={rules.doubleAfterSplit}
              onChange={(event) => {
                set({ doubleAfterSplit: event.target.checked });
              }}
            />
            Double after split
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={rules.lateSurrender}
              onChange={(event) => {
                set({ lateSurrender: event.target.checked });
              }}
            />
            Late surrender
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={rules.resplitAces}
              onChange={(event) => {
                set({ resplitAces: event.target.checked });
              }}
            />
            Re-split aces
          </label>
        </div>
      </fieldset>
      <button
        type="button"
        disabled={disabled || isBaseline}
        onClick={() => {
          onChange({ ...BASELINE_RULES });
        }}
        className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-700"
      >
        Recommended baseline
      </button>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        The player always uses perfect basic strategy generated for exactly these rules. Fixed
        rules: American hole card with dealer peek; insurance and even money are never taken.
      </p>
    </SettingsSection>
  );
}
