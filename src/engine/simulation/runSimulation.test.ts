import { describe, expect, it } from 'vitest';
import { STRATEGIES, STRATEGY_IDS, type StrategyId } from '../../shared/strategies';
import { TARGET_IDS } from '../../shared/targets';
import { SHARED_SEQUENCE, cents } from '../betting/__tests__/replay';
import { scriptedSources, testConfig } from './__tests__/scripted';
import { createSimulationPlan } from './plan';
import { Rng, simulationSeed } from './rng';
import { runSimulation } from './runSimulation';

const strategy = (id: StrategyId) => ({ id, version: STRATEGIES[id].version });
const allStrategies = STRATEGY_IDS.map(strategy);

describe('spec 7.7: simulation results for the shared sequence', () => {
  const config = testConfig({ roundLimit: 14, strategies: allStrategies });
  const results = runSimulation(
    createSimulationPlan(config, scriptedSources([SHARED_SEQUENCE])),
    0,
  );

  it.each([
    ['flat', 600, 100, 420, 20, 80],
    ['martingale', 660, 160, 720, 160, 180],
    ['paroli-classic', 660, 160, 780, 80, 120],
    ['paroli-1326', 960, 460, 1000, 120, 80],
    ['oscars-grind-bj', 650, 150, 580, 40, 80],
  ] as const)(
    '%s: bankroll %i, net %i, wagered %i, max wager %i, max drawdown %i',
    (id, finalBankroll, netProfit, totalWagered, maxWager, maxDrawdown) => {
      const result = results.find((entry) => entry.strategyId === id);
      expect(result).toMatchObject({
        strategyVersion: STRATEGIES[id].version,
        roundsPlayed: 14,
        finalBankroll: cents(finalBankroll),
        netProfit: cents(netProfit),
        totalWagered: cents(totalWagered),
        maxWager: cents(maxWager),
        maxDrawdown: cents(maxDrawdown),
        stopReason: 'round_limit',
        requiredBetAtStop: null,
        outcomeCounts: { blackjack: 2, win: 6, push: 2, loss: 4 },
        unavailableActionCount: 0,
      });
    },
  );

  it('records the simulation id and its seed on every strategy', () => {
    for (const result of results) {
      expect(result.simulationId).toBe(0);
      expect(result.simulationSeed).toBe(simulationSeed(config.experimentSeed, 0));
    }
  });
});

describe('spec 7.9 stop cases with the runner (X6-X9)', () => {
  it('X6: Paroli 1-3-2-6, single target 0.5x, reaches +390 in round 5', () => {
    const config = testConfig({
      roundLimit: 14,
      strategies: [strategy('paroli-1326')],
      targetMode: 'single',
      singleTarget: '0_5x',
    });
    const [result] = runSimulation(
      createSimulationPlan(config, scriptedSources([SHARED_SEQUENCE])),
      0,
    );
    expect(result).toMatchObject({
      stopReason: 'target_reached',
      roundsPlayed: 5,
      netProfit: cents(390),
      firstCrossing: { '0_5x': 5, '1x': null, '2x': null, '2_5x': null },
    });
  });

  it('X7: compare-all records 0.5x at round 5 and keeps playing to the round limit', () => {
    const config = testConfig({
      roundLimit: 14,
      strategies: [strategy('paroli-1326')],
      targetMode: 'compare_all',
    });
    const [result] = runSimulation(
      createSimulationPlan(config, scriptedSources([SHARED_SEQUENCE])),
      0,
    );
    expect(result).toMatchObject({
      stopReason: 'round_limit',
      roundsPlayed: 14,
      firstCrossing: { '0_5x': 5, '1x': null, '2x': null, '2_5x': null },
    });
  });

  it('X8: a target reached on the last allowed round is target_reached, not round_limit', () => {
    const config = testConfig({
      roundLimit: 5,
      strategies: [strategy('paroli-1326')],
      targetMode: 'single',
      singleTarget: '0_5x',
    });
    const [result] = runSimulation(
      createSimulationPlan(config, scriptedSources([SHARED_SEQUENCE])),
      0,
    );
    expect(result?.stopReason).toBe('target_reached');
    expect(result?.roundsPlayed).toBe(5);
  });

  it('X9: Flat and Martingale with 50.00 each stop independently on L, L', () => {
    const config = testConfig({
      startingBankroll: cents(50),
      roundLimit: 10,
      strategies: [strategy('flat'), strategy('martingale')],
      checkpoints: [1, 2, 3],
      displayedSimulations: 1,
    });
    const [flat, martingale] = runSimulation(
      createSimulationPlan(config, scriptedSources([['L', 'L'], ['L']])),
      0,
    );
    expect(martingale).toMatchObject({
      roundsPlayed: 1,
      finalBankroll: cents(30),
      stopReason: 'bust',
      requiredBetAtStop: cents(40),
      checkpointProfit: [cents(-20), cents(-20), cents(-20)],
    });
    expect(flat).toMatchObject({
      roundsPlayed: 2,
      finalBankroll: cents(10),
      stopReason: 'bust',
      requiredBetAtStop: cents(20),
      checkpointProfit: [cents(-20), cents(-40), cents(-40)],
    });
  });

  it('blocks at the table maximum before checking the bankroll (X3)', () => {
    const config = testConfig({
      roundLimit: 10,
      tableMaximum: cents(300),
      strategies: [strategy('martingale')],
    });
    const [result] = runSimulation(
      createSimulationPlan(config, scriptedSources([['L', 'L', 'L', 'L']])),
      0,
    );
    expect(result).toMatchObject({
      roundsPlayed: 4,
      stopReason: 'blocked_table_max',
      requiredBetAtStop: cents(320),
      finalBankroll: cents(200),
    });
  });
});

describe('checkpoints and curve points', () => {
  it('records checkpoint profit after the round and carries frozen profit forward (10.1)', () => {
    const config = testConfig({
      roundLimit: 14,
      strategies: [strategy('paroli-1326')],
      targetMode: 'single',
      singleTarget: '0_5x',
      checkpoints: [1, 3, 5, 10, 14],
    });
    const [result] = runSimulation(
      createSimulationPlan(config, scriptedSources([SHARED_SEQUENCE])),
      0,
    );
    expect(result?.checkpointProfit).toEqual([20, 150, 390, 390, 390].map(cents));
  });

  it('samples every k-th round plus round 0 and the final round, only for displayed simulations', () => {
    const config = testConfig({
      roundLimit: 1000, // k = 5
      simulations: 3,
      displayedSimulations: 2,
      strategies: [strategy('flat')],
    });
    const plan = createSimulationPlan(config, scriptedSources([new Array(1000).fill('P')]));
    const [shown] = runSimulation(plan, 1);
    expect(plan.curveStride).toBe(5);
    expect(shown?.curve?.rounds.slice(0, 4)).toEqual([0, 5, 10, 15]);
    expect(shown?.curve?.rounds.at(-1)).toBe(1000);
    expect(shown?.curve?.rounds).toHaveLength(201);
    expect(shown?.curve?.bets[0]).toBe(0);
    expect(shown?.curve?.bets[1]).toBe(cents(20));
    const [hidden] = runSimulation(plan, 2);
    expect(hidden?.curve).toBeNull();
  });

  it('adds the final round when a strategy stops between samples', () => {
    const config = testConfig({
      roundLimit: 1000,
      simulations: 1,
      displayedSimulations: 1,
      strategies: [strategy('martingale')],
      startingBankroll: cents(50),
    });
    const [result] = runSimulation(createSimulationPlan(config, scriptedSources([['L']])), 0);
    expect(result?.curve).toEqual({
      rounds: [0, 1],
      bankrolls: [cents(50), cents(30)],
      bets: [0, cents(20)],
    });
  });
});

describe('real blackjack simulations', () => {
  const config = testConfig({
    simulations: 40,
    roundLimit: 300,
    strategies: allStrategies,
    targetMode: 'compare_all',
    checkpoints: [50, 100, 250],
    displayedSimulations: 6,
  });
  const plan = createSimulationPlan(config);

  it('gives identical results for the same seed and configuration (8.4)', () => {
    const first = runSimulation(plan, 7);
    const again = runSimulation(createSimulationPlan(config), 7);
    expect(again).toEqual(first);
  });

  it(
    'keeps every per-simulation invariant across many seeded simulations',
    { timeout: 60_000 },
    () => {
      const rng = new Rng(99);
      for (let run = 0; run < 40; run += 1) {
        for (const result of runSimulation(plan, rng.nextBelow(50_000))) {
          const context = `${result.strategyId} simulation ${String(result.simulationId)}`;
          expect(result.finalBankroll, context).toBe(result.startingBankroll + result.netProfit);
          expect(Number.isSafeInteger(result.netProfit), context).toBe(true);
          const { blackjack, win, push, loss } = result.outcomeCounts;
          expect(blackjack + win + push + loss, context).toBe(result.roundsPlayed);
          expect(result.totalWagered, context).toBeGreaterThanOrEqual(result.sumInitialBets);
          expect(result.maxDrawdown, context).toBeGreaterThanOrEqual(0);
          expect(result.roundsPlayed, context).toBeGreaterThanOrEqual(1);
          expect(result.roundsPlayed, context).toBeLessThanOrEqual(config.roundLimit);

          // Spec 3.3: first crossings are ordered wherever both exist.
          const crossings = TARGET_IDS.map((target) => result.firstCrossing[target]);
          for (let index = 1; index < crossings.length; index += 1) {
            const lower = crossings[index - 1];
            const higher = crossings[index];
            if (higher !== null && higher !== undefined) {
              expect(lower, context).not.toBeNull();
              expect(lower ?? Infinity, context).toBeLessThanOrEqual(higher);
            }
          }
          if (result.stopReason === 'target_reached') {
            expect(result.firstCrossing['2_5x'], context).toBe(result.roundsPlayed);
          }
          if (result.stopReason === 'bust') {
            expect(result.requiredBetAtStop ?? 0, context).toBeGreaterThan(result.finalBankroll);
          }
        }
      }
    },
  );
});
