import { describe, expect, it } from 'vitest';
import type { StorageLike } from './recentExperiments';
import { MIN_MEASURED_ROUNDS, ROUND_COST_KEY, loadRoundCost, saveRoundCost } from './roundCost';

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

const throwing: StorageLike = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => undefined,
};

describe('measured round cost in browser storage', () => {
  it('round-trips a plausible measurement from a large enough run', () => {
    const storage = memoryStorage();
    expect(saveRoundCost(storage, 0.42, MIN_MEASURED_ROUNDS)).toBe(0.42);
    expect(loadRoundCost(storage)).toBe(0.42);
  });

  it('keeps the previous value when the run was too small or the value is implausible', () => {
    const storage = memoryStorage({ [ROUND_COST_KEY]: '1.1' });
    expect(saveRoundCost(storage, 0.3, MIN_MEASURED_ROUNDS - 1)).toBe(1.1);
    expect(saveRoundCost(storage, 0.001, MIN_MEASURED_ROUNDS)).toBe(1.1);
    expect(saveRoundCost(storage, null, MIN_MEASURED_ROUNDS)).toBe(1.1);
    expect(loadRoundCost(storage)).toBe(1.1);
  });

  it.each(['abc', '', '-1', '1e9', 'Infinity'])('ignores a stored value of %j', (value) => {
    expect(loadRoundCost(memoryStorage({ [ROUND_COST_KEY]: value }))).toBeNull();
  });

  it('works without storage or with blocked storage', () => {
    expect(loadRoundCost(null)).toBeNull();
    expect(loadRoundCost(throwing)).toBeNull();
    expect(saveRoundCost(throwing, 0.5, MIN_MEASURED_ROUNDS)).toBe(0.5);
  });
});
