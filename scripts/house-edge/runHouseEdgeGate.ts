import { expect, it } from 'vitest';
import {
  createRoundContext,
  createRoundSettlement,
  playRound,
} from '../../src/engine/blackjack/round';
import { createShoe } from '../../src/engine/blackjack/shoe';
import { Rng, simulationSeed } from '../../src/engine/simulation/rng';
import { BASELINE_RULES } from '../../src/shared/defaults';
import { publishedHouseEdge } from './publishedHouseEdge';

// House-edge gate (spec 6.3, gate 2): a long flat-betting run must give a house edge whose
// 99% confidence interval contains the published value. Do not weaken or skip this check.
//
// Rounds per rule set default to 50 million (99% half-width about 0.042% of the bet) and can be
// raised with HOUSE_EDGE_ROUNDS. Rounds are split into simulations of ROUNDS_PER_SIMULATION, each
// with its own shoe seeded by simulationSeed, as the real simulator does.

const BET = 2000;
const HALF_BET = BET / 2; // every result is a whole number of half bets, so sums stay exact
const ROUNDS_PER_SIMULATION = 100_000;
const Z_99 = 2.5758;
const GATE_SEED = 20_261_108;
const DEFAULT_ROUNDS = 50_000_000;

function roundsToRun(): number {
  const fromEnvironment = Number(process.env.HOUSE_EDGE_ROUNDS ?? DEFAULT_ROUNDS);
  if (!Number.isSafeInteger(fromEnvironment) || fromEnvironment < ROUNDS_PER_SIMULATION) {
    throw new RangeError(
      `HOUSE_EDGE_ROUNDS must be an integer >= ${String(ROUNDS_PER_SIMULATION)}`,
    );
  }
  return fromEnvironment;
}

export function houseEdgeGate(
  decks: 6 | 8,
  soft17: 'S17' | 'H17',
  doubleAfterSplit: boolean,
): void {
  for (const payout of ['3:2', '6:5'] as const) {
    const name = `${String(decks)} decks, ${soft17}, ${doubleAfterSplit ? 'DAS' : 'no DAS'}, ${payout}`;
    it(name, { timeout: 3_600_000 }, () => {
      const rules = { ...BASELINE_RULES, decks, soft17, doubleAfterSplit, blackjackPayout: payout };
      const published = publishedHouseEdge(decks, soft17, doubleAfterSplit, payout);
      const context = createRoundContext(rules);
      const result = createRoundSettlement();
      const simulations = Math.floor(roundsToRun() / ROUNDS_PER_SIMULATION);
      const rounds = simulations * ROUNDS_PER_SIMULATION;

      let sumHalfBets = 0;
      let sumSquaresHalfBets = 0;
      let unavailable = 0;
      for (let simulation = 0; simulation < simulations; simulation += 1) {
        const shoe = createShoe(
          decks,
          rules.penetrationPercent,
          new Rng(simulationSeed(GATE_SEED, simulation)),
        );
        for (let round = 0; round < ROUNDS_PER_SIMULATION; round += 1) {
          playRound(context, shoe, BET, Number.MAX_SAFE_INTEGER, result);
          const halfBets = result.netProfit / HALF_BET;
          sumHalfBets += halfBets;
          sumSquaresHalfBets += halfBets * halfBets;
          unavailable += result.unavailableActions;
        }
      }

      const meanPerBet = sumHalfBets / 2 / rounds;
      const variancePerBet =
        (sumSquaresHalfBets / 4 - rounds * meanPerBet * meanPerBet) / (rounds - 1);
      const standardError = Math.sqrt(variancePerBet / rounds);
      const edgePercent = -meanPerBet * 100;
      const halfWidthPercent = Z_99 * standardError * 100;
      const summary =
        `${name}: simulated ${edgePercent.toFixed(4)}% ± ${halfWidthPercent.toFixed(4)}% (99%), ` +
        `published ${published.percent.toFixed(4)}%, difference ${(edgePercent - published.percent).toFixed(4)}%, ` +
        `${String(rounds)} rounds, SD per round ${Math.sqrt(variancePerBet).toFixed(4)} bets`;
      console.log(summary);

      expect(unavailable, 'an unlimited bankroll never makes an action unavailable').toBe(0);
      expect(Math.abs(edgePercent - published.percent), summary).toBeLessThanOrEqual(
        halfWidthPercent,
      );
    });
  }
}
