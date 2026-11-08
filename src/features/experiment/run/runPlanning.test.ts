import { describe, expect, it } from 'vitest';
import { testConfig } from '../../../engine/simulation/__tests__/scripted';
import { STRATEGIES, STRATEGY_IDS } from '../../../shared/strategies';
import {
  MAX_CHUNK_SIMULATIONS,
  NO_TIMING,
  adaptiveChunkSize,
  chunkSimulationCount,
  estimateRuntimeSeconds,
  measuredRoundMicroseconds,
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

describe('adaptiveChunkSize (about 150 ms at the measured speed)', () => {
  const config = testConfig({ roundLimit: 1000, strategies: allStrategies });

  it('uses the cautious worst-case size before any chunk is timed', () => {
    expect(adaptiveChunkSize(config, NO_TIMING)).toBe(chunkSimulationCount(config));
    expect(adaptiveChunkSize(config, { simulations: 10, rounds: 100, computeMs: 0 })).toBe(
      chunkSimulationCount(config),
    );
  });

  it.each([
    [48, 120, 60], // 2.5 ms per simulation -> 60
    [24, 12, 300], // 0.5 ms -> 300
    [10, 100_000, 1], // very slow: never below one
    [100, 1, MAX_CHUNK_SIMULATIONS], // very fast: capped
  ])('%d simulations in %d ms -> %d per chunk', (simulations, computeMs, expected) => {
    expect(adaptiveChunkSize(config, { simulations, rounds: simulations * 100, computeMs })).toBe(
      expected,
    );
  });
});

describe('measuredRoundMicroseconds', () => {
  it('is worker time per round, or null before any timed chunk', () => {
    expect(measuredRoundMicroseconds(NO_TIMING)).toBeNull();
    expect(measuredRoundMicroseconds({ simulations: 5, rounds: 2_000_000, computeMs: 900 })).toBe(
      0.45,
    );
  });
});

describe('estimateRuntimeSeconds', () => {
  it('is an upper bound that scales down with workers', () => {
    const config = testConfig({ simulations: 5000, roundLimit: 1000, strategies: allStrategies });
    const one = estimateRuntimeSeconds(config, 1);
    expect(one).toBeCloseTo(1.5 + 31.25, 6);
    expect(estimateRuntimeSeconds(config, 4)).toBeCloseTo(1.5 + 31.25 / 4, 6);
  });

  it('uses a measured round cost when one is given', () => {
    const config = testConfig({ simulations: 5000, roundLimit: 1000, strategies: allStrategies });
    expect(estimateRuntimeSeconds(config, 2, 0.5)).toBeCloseTo(1.5 + 12.5 / 2, 6);
  });
});
