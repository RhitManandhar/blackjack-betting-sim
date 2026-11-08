import { describe, expect, it } from 'vitest';
import { testConfig } from '../../../engine/simulation/__tests__/scripted';
import { STRATEGIES, STRATEGY_IDS } from '../../../shared/strategies';
import {
  chunkSimulationCount,
  estimateRuntimeSeconds,
  planChunks,
  resolveWorkerCount,
} from './runPlanning';

const allStrategies = STRATEGY_IDS.map((id) => ({ id, version: STRATEGIES[id].version }));

describe('resolveWorkerCount (Auto = min(4, max(1, cores - 1)))', () => {
  it.each([
    ['auto', 1, 1],
    ['auto', 2, 1],
    ['auto', 4, 3],
    ['auto', 10, 4],
    ['auto', 0, 1],
    ['auto', Number.NaN, 1],
    [2, 10, 2],
    [4, 1, 4],
  ] as const)('%s with %d cores -> %d workers', (setting, cores, expected) => {
    expect(resolveWorkerCount(setting, cores)).toBe(expected);
  });
});

describe('chunkSimulationCount (about 150 ms of worst-case work)', () => {
  it.each([
    [5, 1000, 24], // default experiment
    [5, 10_000, 2],
    [1, 50, 500], // capped
    [3, 2000, 20],
  ])(
    '%d strategies x %d rounds -> %d simulations per chunk',
    (strategies, roundLimit, expected) => {
      const config = testConfig({ roundLimit, strategies: allStrategies.slice(0, strategies) });
      expect(chunkSimulationCount(config)).toBe(expected);
    },
  );
});

describe('planChunks', () => {
  it('covers every simulation exactly once, in order', () => {
    const chunks = planChunks(53, 24);
    expect(chunks).toEqual([
      { chunkId: 0, firstSimulation: 0, simulationCount: 24 },
      { chunkId: 1, firstSimulation: 24, simulationCount: 24 },
      { chunkId: 2, firstSimulation: 48, simulationCount: 5 },
    ]);
  });
});

describe('estimateRuntimeSeconds', () => {
  it('is an upper bound that scales down with workers', () => {
    const config = testConfig({ simulations: 5000, roundLimit: 1000, strategies: allStrategies });
    const one = estimateRuntimeSeconds(config, 1);
    expect(one).toBeCloseTo(1.5 + 31.25, 6);
    expect(estimateRuntimeSeconds(config, 4)).toBeCloseTo(1.5 + 31.25 / 4, 6);
  });
});
