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

import type { RuleSet } from '../../src/shared/schema';

function describeRules(rules: RuleSet): string {
  const parts = [
    `${String(rules.decks)} deck(s)`,
    rules.soft17,
    rules.doubleAfterSplit ? 'DAS' : 'no DAS',
    rules.blackjackPayout,
  ];
  if (rules.lateSurrender) parts.push('late surrender');
  if (rules.doubleOn !== 'any-two') parts.push(`double ${rules.doubleOn}`);
  if (rules.maxSplitHands !== 4) parts.push(`max ${String(rules.maxSplitHands)} hands`);
  if (rules.resplitAces) parts.push('re-split aces');
  if (rules.penetrationPercent !== 75)
    parts.push(`${String(rules.penetrationPercent)}% penetration`);
  return parts.join(', ');
}

/** One gated rule set: changes from the 6-deck baseline. */
export function houseEdgeGateFor(change: Partial<RuleSet>): void {
  const rules: RuleSet = { ...BASELINE_RULES, ...change };
  const name = describeRules(rules);
  it(name, { timeout: 3_600_000 }, () => {
    const published = publishedHouseEdge(rules);
    const context = createRoundContext(rules);
    const result = createRoundSettlement();
    const simulations = Math.floor(roundsToRun() / ROUNDS_PER_SIMULATION);
    const rounds = simulations * ROUNDS_PER_SIMULATION;

    let sumHalfBets = 0;
    let sumSquaresHalfBets = 0;
    let unavailable = 0;
    for (let simulation = 0; simulation < simulations; simulation += 1) {
      const shoe = createShoe(
        rules.decks,
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
      `published ${published.toFixed(4)}%, difference ${(edgePercent - published).toFixed(4)}%, ` +
      `${String(rounds)} rounds, SD per round ${Math.sqrt(variancePerBet).toFixed(4)} bets`;
    console.log(summary);

    expect(unavailable, 'an unlimited bankroll never makes an action unavailable').toBe(0);
    expect(Math.abs(edgePercent - published), summary).toBeLessThanOrEqual(halfWidthPercent);
  });
}

/** Tier 1: one deck count, soft-17 rule and DAS setting, at both payouts. */
export function houseEdgeGate(
  decks: 6 | 8,
  soft17: 'S17' | 'H17',
  doubleAfterSplit: boolean,
): void {
  for (const blackjackPayout of ['3:2', '6:5'] as const) {
    houseEdgeGateFor({ decks, soft17, doubleAfterSplit, blackjackPayout });
  }
}

/**
 * Tier 2 and 3 (Phase 7): every new deck count with S17/H17 and DAS on/off, then each other
 * option one at a time from the 6-deck baseline, plus surrender with one deck and penetration
 * at both ends of its range. Gate files take two entries each so they run in parallel.
 */
export const TIER2_GATE_SETS: readonly Partial<RuleSet>[] = [
  ...([1, 2, 4] as const).flatMap((decks) =>
    (['S17', 'H17'] as const).flatMap((soft17) =>
      [true, false].map((doubleAfterSplit) => ({ decks, soft17, doubleAfterSplit })),
    ),
  ),
  { lateSurrender: true },
  { lateSurrender: true, soft17: 'H17' },
  { lateSurrender: true, decks: 1 },
  { doubleOn: '9-11' },
  { doubleOn: '10-11' },
  { maxSplitHands: 2 },
  { maxSplitHands: 3 },
  { resplitAces: true },
  { penetrationPercent: 50 },
  { penetrationPercent: 90 },
];

export function tier2GateGroup(group: number): void {
  for (const change of TIER2_GATE_SETS.slice(group * 2, group * 2 + 2)) houseEdgeGateFor(change);
}
