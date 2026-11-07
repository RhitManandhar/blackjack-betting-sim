import { useState } from 'react';
import { BASELINE_RULES, createDefaultConfig } from '../../shared/defaults';
import { formatCentsGrouped } from '../../shared/money';
import type { ExperimentConfig, RuleSet } from '../../shared/schema';
import { STRATEGIES } from '../../shared/strategies';
import { TARGET_IDS, TARGET_MULTIPLES, targetAmount } from '../../shared/targets';
import { createExperimentIdentity } from './createExperimentIdentity';
import { SettingRow, SettingsSection } from './SettingsSection';
import { estimateWork } from './workEstimate';

// Phase 2 stub: shows the default configuration read-only.
// Editable inputs arrive in Phase 6 (minimal) and Phase 8 (complete).

const numberFormat = new Intl.NumberFormat('en-AU');

function money(cents: number, currency: string): string {
  return `${formatCentsGrouped(cents)} ${currency}`;
}

function describeRules(rules: RuleSet): readonly [string, string][] {
  return [
    ['Decks', String(rules.decks)],
    ['Dealer soft 17', rules.soft17 === 'S17' ? 'Stands (S17)' : 'Hits (H17)'],
    ['Blackjack pays', rules.blackjackPayout],
    ['Double on', rules.doubleOn === 'any-two' ? 'Any first two cards' : rules.doubleOn],
    ['Double after split', rules.doubleAfterSplit ? 'Allowed' : 'Not allowed'],
    ['Late surrender', rules.lateSurrender ? 'On' : 'Off'],
    ['Maximum split hands', String(rules.maxSplitHands)],
    [
      'Split aces',
      rules.resplitAces ? 'One card each, re-split allowed' : 'One card each, no re-split',
    ],
    ['Dealer peek', 'American hole card, peeks'],
    ['Insurance', 'Never taken'],
    ['Shoe penetration', `${rules.penetrationPercent}%`],
  ];
}

export function SetupScreen() {
  const [config] = useState<ExperimentConfig>(() => {
    const { experimentId, experimentSeed } = createExperimentIdentity();
    return createDefaultConfig(experimentId, experimentSeed);
  });
  const work = estimateWork(config);
  const { currency } = config;

  return (
    <div className="space-y-4">
      <p
        role="status"
        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
      >
        Preview: the setup below shows the default configuration. Running simulations becomes
        available once the engine passes its correctness checks.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <SettingsSection title="Simulation size">
          <dl>
            <SettingRow label="Simulations" value={numberFormat.format(config.simulations)} />
            <SettingRow
              label="Rounds per simulation (limit)"
              value={numberFormat.format(config.roundLimit)}
            />
            <SettingRow label="Seed" value={config.experimentSeed} />
            <SettingRow label="Simulations shown on screen" value={config.displayedSimulations} />
          </dl>
        </SettingsSection>

        <SettingsSection title="Bankroll and limits">
          <dl>
            <SettingRow
              label="Starting bankroll"
              value={money(config.startingBankroll, currency)}
            />
            <SettingRow label="Table minimum" value={money(config.tableMinimum, currency)} />
            <SettingRow label="Starting bet (unit)" value={money(config.unit, currency)} />
            <SettingRow
              label="Table maximum"
              value={config.tableMaximum === null ? 'None' : money(config.tableMaximum, currency)}
            />
          </dl>
        </SettingsSection>

        <SettingsSection title="Stop conditions">
          <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
            Each strategy stops at whichever comes first: round limit, profit target, or inability
            to place its next bet.
          </p>
          <table className="w-full text-sm">
            <caption className="sr-only">Profit target amounts</caption>
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
                const amount = targetAmount(config.startingBankroll, target);
                return (
                  <tr key={target}>
                    <th scope="row" className="py-1 text-left font-medium">
                      {TARGET_MULTIPLES[target].label}
                    </th>
                    <td className="py-1 text-right">+{money(amount, currency)}</td>
                    <td className="py-1 text-right">
                      {money(config.startingBankroll + amount, currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-sm">
            Target mode: {config.targetMode === 'none' ? 'No target' : config.targetMode}
          </p>
        </SettingsSection>

        <SettingsSection title="Table rules (recommended baseline)">
          <dl>
            {describeRules(BASELINE_RULES).map(([label, value]) => (
              <SettingRow key={label} label={label} value={value} />
            ))}
          </dl>
        </SettingsSection>

        <SettingsSection title="Strategies">
          <ul className="space-y-1 text-sm">
            {config.strategies.map(({ id, version }) => (
              <li key={id} className="flex justify-between gap-4">
                <span>{STRATEGIES[id].name}</span>
                <code className="text-slate-500 dark:text-slate-400">{version}</code>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Classic Paroli streak length: {config.paroliStreakLength}. Every strategy decides only
            the next bet; every hand is played by perfect basic strategy.
          </p>
        </SettingsSection>

        <SettingsSection title="Checkpoints and performance">
          <dl>
            <SettingRow
              label="Checkpoint rounds"
              value={config.checkpoints.map((round) => numberFormat.format(round)).join(', ')}
            />
            <SettingRow
              label="Workers"
              value={config.workerCount === 'auto' ? 'Auto (up to 4)' : config.workerCount}
            />
          </dl>
        </SettingsSection>
      </div>

      <SettingsSection title="Pre-run summary">
        <dl>
          <SettingRow
            label="Total work (simulations × strategies × rounds, upper bound)"
            value={`${numberFormat.format(work.totalRounds)} rounds`}
          />
          <SettingRow label="Budget" value={`${numberFormat.format(work.budget)} rounds`} />
        </dl>
        {work.isOverBudget && (
          <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
            This run is over the recommended work budget and may take a long time.
          </p>
        )}
        <button
          type="button"
          disabled
          className="mt-4 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Run simulations (not available yet)
        </button>
      </SettingsSection>
    </div>
  );
}
