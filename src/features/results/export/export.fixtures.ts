import type { StrategySimulationResult } from '../../../engine/simulation/runSimulation';
import { ExperimentResults } from '../../../engine/statistics/experimentResults';
import type { StopReason } from '../../../shared/stopReasons';
import spec from '../../../../docs/spec.md?raw';

// Test-only helpers for the export tests: a small result table whose statistics can be checked
// by hand, and the column lists read straight from docs/spec.md.

interface Row {
  readonly netProfit: number;
  readonly totalWagered: number;
  readonly roundsPlayed: number;
  readonly maxDrawdown: number;
  readonly stopReason: StopReason;
  readonly win: number;
  readonly push: number;
  readonly loss: number;
  readonly unavailable: number;
  readonly firstCrossing0_5x?: number;
}

/** Flat 20.00 bets from a 500.00 bankroll: every wager is an initial bet of 2,000 cents. */
export const HAND_ROWS: readonly Row[] = [
  {
    netProfit: 2000,
    totalWagered: 10000,
    roundsPlayed: 5,
    maxDrawdown: 0,
    stopReason: 'round_limit',
    win: 3,
    push: 0,
    loss: 2,
    unavailable: 0,
  },
  {
    netProfit: -4000,
    totalWagered: 12000,
    roundsPlayed: 6,
    maxDrawdown: 4000,
    stopReason: 'round_limit',
    win: 1,
    push: 2,
    loss: 3,
    unavailable: 1,
  },
  {
    netProfit: 0,
    totalWagered: 8000,
    roundsPlayed: 4,
    maxDrawdown: 2000,
    stopReason: 'round_limit',
    win: 2,
    push: 0,
    loss: 2,
    unavailable: 0,
  },
  {
    netProfit: -50000,
    totalWagered: 90000,
    roundsPlayed: 45,
    maxDrawdown: 50000,
    stopReason: 'bust',
    win: 10,
    push: 0,
    loss: 35,
    unavailable: 0,
  },
];

export const HAND_BANKROLL = 50000;

export function handResult(simulationId: number, row: Row): StrategySimulationResult {
  return {
    simulationId,
    simulationSeed: 0,
    strategyId: 'flat',
    strategyVersion: 'flat-v1',
    roundsPlayed: row.roundsPlayed,
    startingBankroll: HAND_BANKROLL,
    finalBankroll: HAND_BANKROLL + row.netProfit,
    netProfit: row.netProfit,
    totalWagered: row.totalWagered,
    sumInitialBets: row.totalWagered,
    maxWager: 2000,
    maxDrawdown: row.maxDrawdown,
    firstCrossing: { '0_5x': row.firstCrossing0_5x ?? null, '1x': null, '2x': null, '2_5x': null },
    stopReason: row.stopReason,
    requiredBetAtStop: row.stopReason === 'bust' ? 2000 : null,
    outcomeCounts: { blackjack: 0, win: row.win, push: row.push, loss: row.loss },
    unavailableActionCount: row.unavailable,
    minimumOvershootCount: 0,
    minimumOvershootTotal: 0,
    checkpointProfit: [],
    checkpointBet: [],
    curve: null,
  };
}

export function handResults(rows: readonly Row[] = HAND_ROWS, simulations = rows.length) {
  const results = new ExperimentResults({
    simulations,
    strategies: [{ id: 'flat', version: 'flat-v1' }],
    startingBankroll: HAND_BANKROLL,
    checkpoints: [],
  });
  rows.forEach((row, index) => {
    results.add([handResult(index, row)]);
  });
  return results;
}

/** The comma-separated column list in the code block under a spec heading. */
export function specColumns(heading: string): string[] {
  const start = spec.indexOf(heading);
  if (start < 0) throw new Error(`Spec heading not found: ${heading}`);
  const block = /```\n([\s\S]*?)```/.exec(spec.slice(start));
  if (block?.[1] === undefined) throw new Error(`No column block under ${heading}`);
  return block[1]
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}
