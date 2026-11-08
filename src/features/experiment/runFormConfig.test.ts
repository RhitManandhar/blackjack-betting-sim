import { describe, expect, it } from 'vitest';
import { createDefaultConfig } from '../../shared/defaults';
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
