import { formatCentsGrouped } from '../../shared/money';
import type { ExperimentConfig, RuleSet } from '../../shared/schema';
import { STRATEGIES } from '../../shared/strategies';
import { TARGET_IDS, TARGET_MULTIPLES, targetAmount } from '../../shared/targets';
import { SettingRow, SettingsSection } from './SettingsSection';

// Read-only view of the settings that are not editable yet (full setup screen: Phase 8).
// The active table rules and strategy definitions are always visible (CLAUDE.md, Never do).

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
    ['Shoe penetration', `${String(rules.penetrationPercent)}%`],
  ];
}

export function SettingsOverview({ config }: { readonly config: ExperimentConfig }) {
  const { currency } = config;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SettingsSection title="Bankroll and limits">
        <dl>
          <SettingRow label="Starting bankroll" value={money(config.startingBankroll, currency)} />
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
          Each strategy stops at whichever comes first: round limit, profit target, or inability to
          place its next bet.
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

      <SettingsSection title="Table rules in use">
        <dl>
          {describeRules(config.rules).map(([label, value]) => (
            <SettingRow key={label} label={label} value={value} />
          ))}
        </dl>
      </SettingsSection>

      <SettingsSection title="Strategies and checkpoints">
        <ul className="space-y-2 text-sm">
          {config.strategies.map(({ id, version }) => (
            <li key={id}>
              <span className="font-medium">{STRATEGIES[id].name}</span>{' '}
              <code className="text-xs text-slate-500 dark:text-slate-400">{version}</code>
              <span className="block text-slate-600 dark:text-slate-400">
                {STRATEGIES[id].rule.replace('{N}', String(config.paroliStreakLength))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Every strategy decides only the next bet; every hand is played by perfect basic strategy
          for these rules.
        </p>
        <dl className="mt-2">
          <SettingRow
            label="Checkpoint rounds"
            value={
              config.checkpoints.length === 0
                ? 'None'
                : config.checkpoints.map((round) => numberFormat.format(round)).join(', ')
            }
          />
        </dl>
      </SettingsSection>
    </div>
  );
}
