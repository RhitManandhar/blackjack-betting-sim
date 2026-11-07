import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from './defaults';
import { experimentConfigSchema, type ExperimentConfig } from './schema';

const valid = (): ExperimentConfig => createDefaultConfig('test-experiment', 12345);

function issuePaths(config: unknown): string[] {
  const result = experimentConfigSchema.safeParse(config);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('experimentConfigSchema', () => {
  it('accepts the default configuration (plan section 16)', () => {
    const config = valid();
    expect(experimentConfigSchema.parse(config)).toEqual(config);
    expect(config).toMatchObject({
      simulations: 5_000,
      roundLimit: 1_000,
      startingBankroll: 50_000,
      tableMinimum: 2_000,
      unit: 2_000,
      tableMaximum: null,
      targetMode: 'none',
      paroliStreakLength: 3,
      checkpoints: [50, 100, 250, 500, 1_000],
      displayedSimulations: 6,
      workerCount: 'auto',
    });
    expect(config.strategies.map((strategy) => strategy.version)).toEqual([
      'flat-v1',
      'martingale-v1',
      'paroli-classic-v1',
      'paroli-1326-v1',
      'oscars-grind-bj-v1',
    ]);
  });

  const accepted: readonly { name: string; change: Partial<ExperimentConfig> }[] = [
    { name: 'starting bet equal to the whole bankroll', change: { unit: 50_000 } },
    { name: 'table maximum equal to the starting bet', change: { tableMaximum: 2_000 } },
    {
      name: 'single target with a chosen threshold',
      change: { targetMode: 'single', singleTarget: '1x' },
    },
    { name: 'compare-all mode', change: { targetMode: 'compare_all' } },
    { name: 'maximum seed', change: { experimentSeed: 0xffff_ffff } },
    {
      name: 'one simulation shown of one run',
      change: { simulations: 1, displayedSimulations: 1, checkpoints: [] },
    },
    { name: 'maximum simulations shown', change: { displayedSimulations: 25 } },
    { name: 'manual worker count', change: { workerCount: 3 } },
    { name: 'odd-cent amounts', change: { startingBankroll: 50_001, unit: 2_001 } },
  ];

  it.each(accepted)('accepts $name', ({ change }) => {
    expect(issuePaths({ ...valid(), ...change })).toEqual([]);
  });

  const rejected: readonly { name: string; change: Record<string, unknown>; path: string }[] = [
    { name: 'starting bet below table minimum', change: { unit: 1_999 }, path: 'unit' },
    { name: 'starting bet above bankroll', change: { unit: 50_001 }, path: 'unit' },
    {
      name: 'table maximum below starting bet',
      change: { tableMaximum: 1_000 },
      path: 'tableMaximum',
    },
    { name: 'fractional cents', change: { startingBankroll: 500.5 }, path: 'startingBankroll' },
    { name: 'zero bankroll', change: { startingBankroll: 0 }, path: 'startingBankroll' },
    { name: 'single mode without target', change: { targetMode: 'single' }, path: 'singleTarget' },
    { name: 'target outside single mode', change: { singleTarget: '2x' }, path: 'singleTarget' },
    { name: 'too many simulations', change: { simulations: 50_001 }, path: 'simulations' },
    { name: 'zero simulations', change: { simulations: 0 }, path: 'simulations' },
    { name: 'round limit too high', change: { roundLimit: 10_001 }, path: 'roundLimit' },
    { name: 'seed above uint32', change: { experimentSeed: 2 ** 32 }, path: 'experimentSeed' },
    { name: 'negative seed', change: { experimentSeed: -1 }, path: 'experimentSeed' },
    {
      name: 'Paroli streak too short',
      change: { paroliStreakLength: 1 },
      path: 'paroliStreakLength',
    },
    {
      name: 'Paroli streak too long',
      change: { paroliStreakLength: 6 },
      path: 'paroliStreakLength',
    },
    { name: 'checkpoints out of order', change: { checkpoints: [100, 50] }, path: 'checkpoints' },
    { name: 'duplicate checkpoints', change: { checkpoints: [50, 50] }, path: 'checkpoints' },
    {
      name: 'checkpoint beyond round limit',
      change: { checkpoints: [50, 1_001] },
      path: 'checkpoints',
    },
    {
      name: 'more shown than run',
      change: { simulations: 3, displayedSimulations: 6 },
      path: 'displayedSimulations',
    },
    {
      name: 'more than 25 shown',
      change: { displayedSimulations: 26 },
      path: 'displayedSimulations',
    },
    { name: 'no strategies', change: { strategies: [] }, path: 'strategies' },
    {
      name: 'duplicate strategy',
      change: {
        strategies: [
          { id: 'flat', version: 'flat-v1' },
          { id: 'flat', version: 'flat-v1' },
        ],
      },
      path: 'strategies',
    },
    {
      name: 'wrong strategy version',
      change: { strategies: [{ id: 'martingale', version: 'martingale-v2' }] },
      path: 'strategies.0.version',
    },
    { name: 'unknown key from imported JSON', change: { cardCounting: true }, path: '' },
    { name: 'worker count above 4', change: { workerCount: 5 }, path: 'workerCount' },
    { name: 'wrong spec version', change: { specVersion: '1.0' }, path: 'specVersion' },
  ];

  it.each(rejected)('rejects $name', ({ change, path }) => {
    expect(issuePaths({ ...valid(), ...change })).toContain(path);
  });

  it.each([
    { name: 'unsupported deck count', rules: { decks: 3 }, path: 'rules.decks' },
    {
      name: 'unvalidated penetration',
      rules: { penetrationPercent: 80 },
      path: 'rules.penetrationPercent',
    },
    { name: 'five split hands', rules: { maxSplitHands: 5 }, path: 'rules.maxSplitHands' },
    { name: 'insurance option', rules: { insurance: true }, path: 'rules' },
  ])('rejects rule set with $name', ({ rules, path }) => {
    const config = valid();
    expect(issuePaths({ ...config, rules: { ...config.rules, ...rules } })).toContain(path);
  });
});
