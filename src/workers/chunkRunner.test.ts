import { describe, expect, it } from 'vitest';
import { createSimulationPlan } from '../engine/simulation/plan';
import { type StrategySimulationResult, runSimulation } from '../engine/simulation/runSimulation';
import { testConfig } from '../engine/simulation/__tests__/scripted';
import { STRATEGIES, STRATEGY_IDS } from '../shared/strategies';
import { ChunkRunner, PROGRESS_INTERVAL_MS } from './chunkRunner';
import {
  type FromWorkerMessage,
  fromWorkerMessageSchema,
  strategySimulationResultSchema,
  toWorkerMessageSchema,
} from './messages';

const config = testConfig({
  simulations: 20,
  roundLimit: 150,
  displayedSimulations: 3,
  strategies: STRATEGY_IDS.map((id) => ({ id, version: STRATEGIES[id].version })),
  targetMode: 'compare_all',
  checkpoints: [50, 100],
});

describe('ChunkRunner', () => {
  it('returns exactly what runSimulation gives for each index in the range', () => {
    const outcome = new ChunkRunner().run(
      'run-1',
      config,
      5,
      4,
      () => undefined,
      () => 0,
    );
    const plan = createSimulationPlan(config);
    expect(outcome.simulations).toEqual([5, 6, 7, 8].map((index) => runSimulation(plan, index)));
    const rounds = outcome.simulations.flat().reduce((sum, result) => sum + result.roundsPlayed, 0);
    expect(outcome.roundsPlayed).toBe(rounds);
  });

  it('includes curves only for the displayed simulations', () => {
    const outcome = new ChunkRunner().run(
      'run-1',
      config,
      0,
      5,
      () => undefined,
      () => 0,
    );
    const hasCurve = outcome.simulations.map((results) => results[0]?.curve !== null);
    expect(hasCurve).toEqual([true, true, true, false, false]);
  });

  it('sends progress at most every PROGRESS_INTERVAL_MS', () => {
    let clock = 0;
    const reports: number[] = [];
    new ChunkRunner().run(
      'run-1',
      config,
      0,
      10,
      (done) => reports.push(done),
      () => {
        clock += PROGRESS_INTERVAL_MS / 2;
        return clock;
      },
    );
    // The clock advances half an interval per simulation, so progress comes every 2nd one.
    expect(reports).toEqual([2, 4, 6, 8, 10]);
  });

  it('refuses a chunk that runs past the last simulation', () => {
    expect(() =>
      new ChunkRunner().run(
        'run-1',
        config,
        18,
        5,
        () => undefined,
        () => 0,
      ),
    ).toThrow(RangeError);
  });
});

describe('worker message contract', () => {
  it('accepts a real chunk result and its start message', () => {
    const outcome = new ChunkRunner().run(
      'run-1',
      config,
      0,
      4,
      () => undefined,
      () => 0,
    );
    const message: FromWorkerMessage = {
      type: 'chunk-result',
      runId: 'run-1',
      chunkId: 0,
      simulations: outcome.simulations,
      roundsPlayed: outcome.roundsPlayed,
    };
    expect(fromWorkerMessageSchema.parse(structuredClone(message))).toEqual(message);
    expect(
      toWorkerMessageSchema.safeParse({
        type: 'start-chunk',
        runId: 'run-1',
        chunkId: 0,
        config,
        firstSimulation: 0,
        simulationCount: 4,
      }).success,
    ).toBe(true);
  });

  it.each([
    ['a broken bankroll invariant', { finalBankroll: 1 }],
    ['fractional cents', { netProfit: 0.5 }],
    ['an unknown stop reason', { stopReason: 'cancelled' }],
    ['an extra field', { extra: true }],
  ])('rejects a result with %s', (_label, change) => {
    const [result] =
      new ChunkRunner().run(
        'run-1',
        config,
        0,
        1,
        () => undefined,
        () => 0,
      ).simulations[0] ?? [];
    expect(strategySimulationResultSchema.safeParse({ ...result, ...change }).success).toBe(false);
  });

  it('rejects unknown message types in both directions', () => {
    expect(fromWorkerMessageSchema.safeParse({ type: 'per-round', runId: 'x' }).success).toBe(
      false,
    );
    expect(toWorkerMessageSchema.safeParse({ type: 'pause', runId: 'x' }).success).toBe(false);
  });
});

// Compile-time check: the validated shape is usable wherever the engine's result type is.
export const schemaMatchesEngineType = (
  parsed: ReturnType<typeof strategySimulationResultSchema.parse>,
): StrategySimulationResult => parsed;
