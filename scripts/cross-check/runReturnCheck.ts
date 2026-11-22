import { expect, it } from 'vitest';
import { createSimulationPlan } from '../../src/engine/simulation/plan';
import {
  type RoundSourceFactory,
  blackjackRoundSources,
} from '../../src/engine/simulation/roundSource';
import { runSimulation } from '../../src/engine/simulation/runSimulation';
import { createDefaultConfig } from '../../src/shared/defaults';
import type { ExperimentConfig } from '../../src/shared/schema';
import { STRATEGIES, type StrategyId } from '../../src/shared/strategies';
import { publishedHouseEdge } from '../house-edge/publishedHouseEdge';
import { CROSS_CHECK_SEED, Z_99, countFromEnvironment, percent } from './crossCheckSettings';

// Cross-check 1: return per base bet (plan Phase 9, task 4). No betting system changes the house
// edge: whatever a strategy bets, each bet returns minus the house edge on average. A strategy
// that misses points to a bookkeeping fault in the strategy, the runner or the settlement.
//
// The check plays the real runner (createSimulationPlan + runSimulation) on the default
// configuration with one change: an unlimited bankroll, so no strategy busts and basic strategy
// is never cut short by a double or split it cannot fund. That bankroll is far above the setup
// form's limit on purpose; the plan is built directly and never shown in the app. A counting
// wrapper around the real round source records every round, and its totals must equal the
// runner's own netProfit and sumInitialBets.
//
// Two estimates, each with a 99% interval clustered by simulation (rounds in one simulation
// share a shoe, simulations are independent):
// - bet-weighted return: total profit / total initial bets, the house-edge definition. This is
//   where strategies differ: they all see the same cards and only change how much rides on each
//   round. Gated for every strategy.
// - per-bet return: the mean of net / initial bet over all rounds. With an unlimited bankroll the
//   paired shoes make it identical for every strategy (and equal to flat betting's), which shows
//   that a bet size never changes the cards or the decisions. Gated too.
// With an unlimited bankroll and no table maximum, a Martingale bet after k losses is 2^k units
// while such a streak has a probability of roughly 0.53^k, so the variance of its bet total is
// unbounded and no interval for the ratio is reliable. Its gated run therefore uses a table
// maximum of 1,024 units: the strategy stops as blocked_table_max after ten losses in a row,
// bets stay bounded, and stopping cannot change the expected return per unit bet. The run
// without a maximum is reported only.
// A last, report-only pass uses the default 500.00 bankroll exactly as a user would run it.

const UNLIMITED_BANKROLL = 1e15; // cents; below 2^53 with ample room for any reachable profit
const DEFAULT_SIMULATIONS = 20_000;
const GATED_TABLE_MAXIMUM_UNITS: Partial<Record<StrategyId, number>> = { martingale: 1024 };

interface Ratio {
  readonly value: number;
  readonly halfWidth: number;
}

interface ReturnEstimate {
  readonly simulations: number;
  readonly rounds: number;
  readonly perBet: Ratio;
  readonly betWeighted: Ratio;
  readonly unavailableActions: number;
  readonly bookkeepingMismatches: number;
  readonly stopReasons: string;
}

/** sum(numerators) / sum(denominators) with a 99% delta-method interval over clusters. */
function clusteredRatio(numerators: Float64Array, denominators: Float64Array): Ratio {
  const n = numerators.length;
  let sumNumerators = 0;
  let sumDenominators = 0;
  for (let index = 0; index < n; index += 1) {
    sumNumerators += numerators[index] ?? 0;
    sumDenominators += denominators[index] ?? 0;
  }
  const value = sumNumerators / sumDenominators;
  let residualSquares = 0;
  for (let index = 0; index < n; index += 1) {
    const residual = (numerators[index] ?? 0) - value * (denominators[index] ?? 0);
    residualSquares += residual * residual;
  }
  const standardError = Math.sqrt(residualSquares / (n * (n - 1))) / (sumDenominators / n);
  return { value, halfWidth: Z_99 * standardError };
}

function configFor(
  strategyId: StrategyId,
  startingBankroll: number | null,
  tableMaximumUnits: number | null,
): ExperimentConfig {
  const defaults = createDefaultConfig('cross-check', CROSS_CHECK_SEED);
  const simulations = countFromEnvironment('CROSS_CHECK_SIMULATIONS', DEFAULT_SIMULATIONS, 2);
  return {
    ...defaults,
    simulations,
    displayedSimulations: 0,
    startingBankroll: startingBankroll ?? defaults.startingBankroll,
    tableMaximum: tableMaximumUnits === null ? null : tableMaximumUnits * defaults.unit,
    strategies: [{ id: strategyId, version: STRATEGIES[strategyId].version }],
  };
}

interface Tally {
  rounds: number;
  net: number;
  bets: number;
  perBet: number;
}

function countingSources(base: RoundSourceFactory, tally: Tally): RoundSourceFactory {
  return (seed, strategyIndex) => {
    const inner = base(seed, strategyIndex);
    return {
      play: (bet, bankrollBefore, out) => {
        inner.play(bet, bankrollBefore, out);
        tally.rounds += 1;
        tally.net += out.netProfit;
        tally.bets += bet;
        tally.perBet += out.netProfit / bet;
      },
    };
  };
}

function estimateReturn(config: ExperimentConfig): ReturnEstimate {
  const tally: Tally = { rounds: 0, net: 0, bets: 0, perBet: 0 };
  const plan = createSimulationPlan(
    config,
    countingSources(blackjackRoundSources(config.rules), tally),
  );
  const n = config.simulations;
  const profits = new Float64Array(n);
  const bets = new Float64Array(n);
  const perBetSums = new Float64Array(n);
  const roundCounts = new Float64Array(n);
  let unavailableActions = 0;
  let bookkeepingMismatches = 0;
  const stops = new Map<string, number>();
  for (let simulation = 0; simulation < n; simulation += 1) {
    tally.rounds = 0;
    tally.net = 0;
    tally.bets = 0;
    tally.perBet = 0;
    const [result] = runSimulation(plan, simulation);
    if (result === undefined) throw new Error('runSimulation returned no strategy result');
    if (
      tally.rounds !== result.roundsPlayed ||
      tally.net !== result.netProfit ||
      tally.bets !== result.sumInitialBets ||
      result.finalBankroll !== result.startingBankroll + result.netProfit
    ) {
      bookkeepingMismatches += 1;
    }
    profits[simulation] = result.netProfit;
    bets[simulation] = result.sumInitialBets;
    perBetSums[simulation] = tally.perBet;
    roundCounts[simulation] = result.roundsPlayed;
    unavailableActions += result.unavailableActionCount;
    stops.set(result.stopReason, (stops.get(result.stopReason) ?? 0) + 1);
  }
  return {
    simulations: n,
    rounds: roundCounts.reduce((sum, rounds) => sum + rounds, 0),
    perBet: clusteredRatio(perBetSums, roundCounts),
    betWeighted: clusteredRatio(profits, bets),
    unavailableActions,
    bookkeepingMismatches,
    stopReasons: [...stops].map(([reason, count]) => `${reason} ${String(count)}`).join(', '),
  };
}

function edgeLine(name: string, ratio: Ratio, edge: number, gated: boolean): string {
  const simulatedEdge = -ratio.value;
  const pass = Math.abs(simulatedEdge - edge) <= ratio.halfWidth;
  const mark = gated ? (pass ? '' : '  FAIL') : ' (reported only)';
  return `  ${name}: edge ${percent(simulatedEdge)} ± ${percent(ratio.halfWidth)} (99%), difference ${percent(simulatedEdge - edge)}${mark}`;
}

function describe(
  label: string,
  estimate: ReturnEstimate,
  edge: number,
  gates: { readonly perBet: boolean; readonly weighted: boolean },
): string {
  return [
    `${label}: published edge ${percent(edge)}, ${String(estimate.simulations)} simulations, ${String(estimate.rounds)} rounds, unavailable actions ${String(estimate.unavailableActions)}, stops: ${estimate.stopReasons}`,
    edgeLine('per-bet return', estimate.perBet, edge, gates.perBet),
    edgeLine('bet-weighted return', estimate.betWeighted, edge, gates.weighted),
  ].join('\n');
}

function inside(ratio: Ratio, edge: number): boolean {
  return Math.abs(-ratio.value - edge) <= ratio.halfWidth;
}

export function returnCheck(strategyId: StrategyId): void {
  const version = STRATEGIES[strategyId].version;
  const edge = publishedHouseEdge(createDefaultConfig('cross-check', CROSS_CHECK_SEED).rules) / 100;
  const tableMaximumUnits = GATED_TABLE_MAXIMUM_UNITS[strategyId] ?? null;
  const gatedLabel =
    tableMaximumUnits === null
      ? `${version}, unlimited bankroll`
      : `${version}, unlimited bankroll, table maximum ${String(tableMaximumUnits)} units`;

  it(`${version}: return per bet matches the published house edge`, { timeout: 3_600_000 }, () => {
    const estimate = estimateReturn(configFor(strategyId, UNLIMITED_BANKROLL, tableMaximumUnits));
    const summary = describe(gatedLabel, estimate, edge, { perBet: true, weighted: true });
    console.log(summary);
    expect(estimate.bookkeepingMismatches, 'runner totals equal the round-by-round sums').toBe(0);
    expect(estimate.unavailableActions, 'an unlimited bankroll never cuts an action short').toBe(0);
    expect(inside(estimate.perBet, edge), summary).toBe(true);
    expect(inside(estimate.betWeighted, edge), summary).toBe(true);
  });

  if (tableMaximumUnits !== null) {
    it(`${version}: no table maximum (reported only)`, { timeout: 3_600_000 }, () => {
      const estimate = estimateReturn(configFor(strategyId, UNLIMITED_BANKROLL, null));
      console.log(
        describe(`${version}, unlimited bankroll, no table maximum`, estimate, edge, {
          perBet: true,
          weighted: false,
        }),
      );
      expect(estimate.bookkeepingMismatches, 'runner totals equal the round-by-round sums').toBe(0);
    });
  }

  it(`${version}: default bankroll (reported only)`, { timeout: 3_600_000 }, () => {
    const estimate = estimateReturn(configFor(strategyId, null, null));
    console.log(
      describe(`${version}, default 500.00 bankroll`, estimate, edge, {
        perBet: false,
        weighted: false,
      }),
    );
    expect(estimate.bookkeepingMismatches, 'runner totals equal the round-by-round sums').toBe(0);
  });
}
