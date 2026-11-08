import { describe, expect, it } from 'vitest';
import { testConfig } from '../../engine/simulation/__tests__/scripted';
import { createSimulationPlan } from '../../engine/simulation/plan';
import { simulationSeed } from '../../engine/simulation/rng';
import { runSimulation } from '../../engine/simulation/runSimulation';
import { ExperimentResults } from '../../engine/statistics/experimentResults';
import { liveStopCounts, sampleRows } from './resultsData';

const config = testConfig({
  simulations: 12,
  roundLimit: 150,
  strategies: [
    { id: 'flat', version: 'flat-v1' },
    { id: 'martingale', version: 'martingale-v1' },
  ],
});
const plan = createSimulationPlan(config);
const all = Array.from({ length: config.simulations }, (_, index) => runSimulation(plan, index));

describe('liveStopCounts', () => {
  it('counts only finished simulations, per strategy', () => {
    const results = new ExperimentResults(config);
    for (const index of [3, 0, 7]) results.add(all[index] ?? []);
    const counts = liveStopCounts(results);
    for (const [strategy, row] of counts.entries()) {
      expect(Object.values(row).reduce((sum, n) => sum + n, 0)).toBe(3);
      const expected = [0, 3, 7].map((index) => all[index]?.[strategy]?.stopReason);
      for (const reason of new Set(expected)) {
        if (reason !== undefined)
          expect(row[reason]).toBe(expected.filter((r) => r === reason).length);
      }
    }
  });
});

describe('sampleRows (spec 10.8: first finished simulations by id)', () => {
  it('returns finished simulations in id order with their seeds, up to the limit', () => {
    const results = new ExperimentResults(config);
    for (const index of [9, 2, 5, 0]) results.add(all[index] ?? []);
    const rows = sampleRows(results, 1, config.experimentSeed, 3);
    expect(rows.map((row) => row.simulationId)).toEqual([0, 2, 5]);
    for (const row of rows) {
      const result = all[row.simulationId]?.[1];
      expect(row).toEqual({
        simulationId: row.simulationId,
        seed: simulationSeed(config.experimentSeed, row.simulationId),
        roundsPlayed: result?.roundsPlayed,
        netProfit: result?.netProfit,
        maxWager: result?.maxWager,
        maxDrawdown: result?.maxDrawdown,
        stopReason: result?.stopReason,
      });
    }
  });
});
