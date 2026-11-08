import { describe, expect, it } from 'vitest';
import { STRATEGIES, STRATEGY_IDS } from '../../shared/strategies';
import { createDefaultConfig } from '../../shared/defaults';
import { configFileName, configToJson, parseConfigJson } from './configFile';
import {
  MAX_RECENT,
  STORAGE_KEY,
  type StorageLike,
  clearRecent,
  digestOf,
  loadRecent,
  saveRecent,
} from './recentExperiments';

const config = createDefaultConfig('experiment-1', 42);

describe('configuration file (spec 10.8)', () => {
  it('round-trips a configuration exactly', () => {
    expect(parseConfigJson(configToJson(config))).toEqual({ ok: true, config });
    expect(configFileName(config)).toBe('blackjack-experiment-seed-42.json');
  });

  it.each([
    ['not JSON', '{oops', /not valid JSON/],
    [
      'an older spec version',
      JSON.stringify({ ...config, specVersion: '2.0' }),
      /spec version 2.0/,
    ],
    ['a bad field', JSON.stringify({ ...config, simulations: 0 }), /simulations/],
    ['an unknown field', JSON.stringify({ ...config, extra: 1 }), /not a valid experiment/],
    ['an array', '[]', /not a valid experiment/],
  ])('rejects %s with a clear message', (_label, text, message) => {
    const result = parseConfigJson(text);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(message);
  });
});

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

const strategies = STRATEGY_IDS.map((id) => ({
  strategyId: id,
  strategyVersion: STRATEGIES[id].version,
  simulations: 10,
  profitMean: -123.5,
  profitPercentiles: { p5: 0, p25: 0, median: -200, p75: 0, p95: 0 },
  profitShare: 0.4,
  returnPerUnitWagered: -0.005,
  statusCounts: { target_reached: 1, bust: 2, blocked_table_max: 0, round_limit: 7 },
}));

function entry(id: string, savedAt: number) {
  return digestOf(
    { ...config, experimentId: id },
    'complete',
    10,
    strategies as unknown as Parameters<typeof digestOf>[3],
    savedAt,
  );
}

describe('recent experiments (plan 8.4)', () => {
  it('saves newest first, replaces the same experiment and keeps the last ten', () => {
    const storage = memoryStorage();
    for (let index = 0; index < MAX_RECENT + 3; index += 1)
      saveRecent(storage, entry(`e${String(index)}`, index));
    saveRecent(storage, entry('e12', 99));
    const recent = loadRecent(storage);
    expect(recent).toHaveLength(MAX_RECENT);
    expect(recent[0]?.config.experimentId).toBe('e12');
    expect(recent[0]?.savedAt).toBe(99);
    expect(recent.filter((item) => item.config.experimentId === 'e12')).toHaveLength(1);
  });

  it('keeps only the digest, never per-simulation data', () => {
    const storage = memoryStorage();
    saveRecent(storage, entry('e1', 1));
    const stored = storage.data.get(STORAGE_KEY) ?? '';
    expect(stored.length).toBeLessThan(6000);
    expect(stored).not.toContain('profitPercentiles');
  });

  it('drops invalid or tampered entries on load', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify([entry('ok', 1), { savedAt: 'x' }, 42]));
    expect(loadRecent(storage).map((item) => item.config.experimentId)).toEqual(['ok']);
    storage.setItem(STORAGE_KEY, '{not json');
    expect(loadRecent(storage)).toEqual([]);
  });

  it('copes with unavailable or failing storage', () => {
    expect(loadRecent(null)).toEqual([]);
    expect(saveRecent(null, entry('e1', 1))).toHaveLength(1);
    const failing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadRecent(failing)).toEqual([]);
    expect(saveRecent(failing, entry('e1', 1))).toHaveLength(1);
    expect(() => {
      clearRecent(failing);
    }).not.toThrow();
  });
});
