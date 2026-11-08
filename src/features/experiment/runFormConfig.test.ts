import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '../../shared/defaults';
import { assertSupportedRules } from '../../engine/blackjack/rules';
import {
  DECK_OPTIONS,
  DOUBLE_OPTIONS,
  PENETRATION_OPTIONS,
  SPLIT_HAND_OPTIONS,
} from './ruleOptions';
import { type RunFormDraft, buildConfig, draftFromConfig } from './runFormConfig';

const base = createDefaultConfig('experiment', 123);
const draft = draftFromConfig(base);
const withDraft = (change: Partial<RunFormDraft>) => buildConfig({ ...draft, ...change }, base);

describe('buildConfig', () => {
  it('round-trips the default configuration unchanged', () => {
    expect(buildConfig(draft, base)).toEqual({ ok: true, config: base, notes: [] });
  });

  it('applies the edited fields and keeps strategies in canonical order', () => {
    const result = withDraft({
      simulations: '2,000',
      roundLimit: '500',
      seed: '42',
      strategies: ['oscars-grind-bj', 'flat'],
      workerCount: 2,
    });
    expect(result.ok && result.config).toMatchObject({
      simulations: 2000,
      roundLimit: 500,
      experimentSeed: 42,
      strategies: [
        { id: 'flat', version: 'flat-v1' },
        { id: 'oscars-grind-bj', version: 'oscars-grind-bj-v1' },
      ],
      workerCount: 2,
      checkpoints: [50, 100, 250, 500],
    });
  });

  it('removes checkpoints above the round limit and says so (spec 9)', () => {
    const result = withDraft({ roundLimit: '120' });
    expect(result.ok && result.config.checkpoints).toEqual([50, 100]);
    expect(result.ok && result.notes[0]).toMatch(/250, 500, 1,000/);
  });

  it('lowers the displayed simulations to the number of simulations and says so (spec 9)', () => {
    const result = withDraft({ simulations: '3' });
    expect(result.ok && result.config.displayedSimulations).toBe(3);
    expect(result.ok && result.notes).toHaveLength(1);
  });

  it.each([
    ['simulations', { simulations: '0' }],
    ['simulations', { simulations: '50001' }],
    ['simulations', { simulations: '12.5' }],
    ['roundLimit', { roundLimit: '' }],
    ['roundLimit', { roundLimit: '10001' }],
    ['seed', { seed: '-1' }],
    ['seed', { seed: '4294967296' }],
    ['strategies', { strategies: [] }],
  ] as const)('rejects a bad %s', (field, change) => {
    const result = withDraft(change);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors[field]).toBeTruthy();
  });
});

describe('table rules from the form (Phase 7)', () => {
  it('passes edited rules into the configuration', () => {
    const rules = { ...base.rules, decks: 1 as const, lateSurrender: true, penetrationPercent: 60 };
    const result = withDraft({ rules });
    expect(result.ok && result.config.rules).toEqual(rules);
  });

  it('offers only options the schema and engine accept', () => {
    for (const decks of DECK_OPTIONS) {
      for (const doubleOn of DOUBLE_OPTIONS) {
        for (const maxSplitHands of SPLIT_HAND_OPTIONS) {
          for (const penetrationPercent of PENETRATION_OPTIONS) {
            const rules = {
              ...base.rules,
              decks,
              doubleOn: doubleOn.value,
              maxSplitHands,
              penetrationPercent,
            };
            const result = withDraft({ rules });
            expect(result.ok).toBe(true);
            expect(() => {
              assertSupportedRules(rules);
            }).not.toThrow();
          }
        }
      }
    }
  });
});

describe('full setup fields (Phase 8a)', () => {
  it('converts money typed in currency units to cents once', () => {
    const result = withDraft({
      startingBankroll: '1,250.50',
      tableMinimum: '25',
      unit: '25.00',
      tableMaximum: '500',
    });
    expect(result.ok && result.config).toMatchObject({
      startingBankroll: 125_050,
      tableMinimum: 2500,
      unit: 2500,
      tableMaximum: 50_000,
    });
  });

  it('treats a blank table maximum as no maximum', () => {
    const result = withDraft({ tableMaximum: '  ' });
    expect(result.ok && result.config.tableMaximum).toBeNull();
  });

  it.each([
    ['startingBankroll', { startingBankroll: '0' }],
    ['tableMinimum', { tableMinimum: '20.555' }],
    ['unit', { unit: 'twenty' }],
    ['tableMaximum', { tableMaximum: '-5' }],
    ['displayedSimulations', { displayedSimulations: '26' }],
    ['checkpoints', { checkpoints: '50, abc' }],
    ['checkpoints', { checkpoints: '0, 100' }],
  ] as const)('reports a bad %s on that field', (field, change) => {
    const result = withDraft(change);
    expect(!result.ok && result.errors[field]).toBeTruthy();
  });

  it.each([
    ['unit', { unit: '10' }, /at least the table minimum/],
    ['unit', { unit: '600' }, /cannot exceed the starting bankroll/],
    ['tableMaximum', { tableMaximum: '15' }, /at least the starting bet/],
  ] as const)('maps cross-field rule errors back to %s', (field, change, message) => {
    const result = withDraft(change);
    expect(!result.ok && result.errors[field]).toMatch(message);
  });

  it('uses the chosen target only in single-target mode', () => {
    const single = withDraft({ targetMode: 'single', singleTarget: '2x' });
    expect(single.ok && single.config).toMatchObject({ targetMode: 'single', singleTarget: '2x' });
    const compare = withDraft({ targetMode: 'compare_all', singleTarget: '2x' });
    expect(compare.ok && compare.config).toMatchObject({
      targetMode: 'compare_all',
      singleTarget: null,
    });
  });

  it('sorts checkpoints, removes duplicates and says so', () => {
    const result = withDraft({ checkpoints: '500 100, 100 250' });
    expect(result.ok && result.config.checkpoints).toEqual([100, 250, 500]);
    expect(result.ok && result.notes).toContain('Checkpoints were sorted and duplicates removed.');
  });

  it('allows no checkpoints at all', () => {
    const result = withDraft({ checkpoints: '' });
    expect(result.ok && result.config.checkpoints).toEqual([]);
  });

  it('applies the Paroli streak length and the number of panels', () => {
    const result = withDraft({ paroliStreakLength: 4, displayedSimulations: '25' });
    expect(result.ok && result.config).toMatchObject({
      paroliStreakLength: 4,
      displayedSimulations: 25,
    });
  });
});
