import { expect, it } from 'vitest';
import {
  Outcome,
  createRoundContext,
  createRoundSettlement,
  playRound,
} from '../../src/engine/blackjack/round';
import { createShoe } from '../../src/engine/blackjack/shoe';
import { Rng, simulationSeed } from '../../src/engine/simulation/rng';
import { CROSS_CHECK_SEED, Z_99, countFromEnvironment, percent } from './crossCheckSettings';
import {
  NET_WIN_PROBABILITIES,
  REFERENCE_RULES,
  referenceCategories,
  referenceExpectation,
} from './publishedOutcomes';

// Cross-check 2: outcome frequencies (plan Phase 9, task 4). Flat betting on the reference rule
// set must reproduce a published distribution of net round results.
//
// - The spec's four categories (blackjack, win, push, loss) each pass when the published share
//   lies inside the simulated share ± 2.5758 standard errors (99%).
// - Every row of the full net-win table with a probability of at least 0.0005 (it covers
//   surrender, doubles and splits) passes at |z| <= 3.5: about 99% for the family of 11 rows.
// - The mean result per bet is reported beside the table's expectation, without a pass mark,
//   because the table's eight decimals do not carry its own sampling error.

const BET = 2000;
const HALF_BET = BET / 2;
const ROUNDS_PER_SIMULATION = 100_000;
const DEFAULT_ROUNDS = 20_000_000;
const MAX_HALF_BETS = 16; // four hands, each doubled
const ROW_MINIMUM_PROBABILITY = 0.0005;
const ROW_Z_LIMIT = 3.5;

const CATEGORY_NAMES = ['blackjack', 'win', 'push', 'loss'] as const;
const CATEGORY_INDEX = {
  blackjack: Outcome.Blackjack,
  win: Outcome.Win,
  push: Outcome.Push,
  loss: Outcome.Loss,
} as const;

it('flat betting reproduces the published outcome frequencies', { timeout: 3_600_000 }, () => {
  const simulations = Math.floor(
    countFromEnvironment('CROSS_CHECK_ROUNDS', DEFAULT_ROUNDS, ROUNDS_PER_SIMULATION) /
      ROUNDS_PER_SIMULATION,
  );
  const rounds = simulations * ROUNDS_PER_SIMULATION;
  const context = createRoundContext(REFERENCE_RULES);
  const settlement = createRoundSettlement();
  const netCounts = new Float64Array(2 * MAX_HALF_BETS + 1);
  const categoryCounts = new Float64Array(4);
  let sumHalfBets = 0;
  let unavailable = 0;

  for (let simulation = 0; simulation < simulations; simulation += 1) {
    const shoe = createShoe(
      REFERENCE_RULES.decks,
      REFERENCE_RULES.penetrationPercent,
      new Rng(simulationSeed(CROSS_CHECK_SEED, simulation)),
    );
    for (let round = 0; round < ROUNDS_PER_SIMULATION; round += 1) {
      playRound(context, shoe, BET, Number.MAX_SAFE_INTEGER, settlement);
      const halfBets = settlement.netProfit / HALF_BET;
      netCounts[halfBets + MAX_HALF_BETS] = (netCounts[halfBets + MAX_HALF_BETS] ?? 0) + 1;
      categoryCounts[settlement.outcome] = (categoryCounts[settlement.outcome] ?? 0) + 1;
      sumHalfBets += halfBets;
      unavailable += settlement.unavailableActions;
    }
  }

  const failures: string[] = [];
  const lines: string[] = [
    `Outcome frequencies, ${String(rounds)} rounds, seed ${String(CROSS_CHECK_SEED)}`,
  ];

  const reference = referenceCategories();
  for (const name of CATEGORY_NAMES) {
    const simulated = (categoryCounts[CATEGORY_INDEX[name]] ?? 0) / rounds;
    const halfWidth = Z_99 * Math.sqrt((simulated * (1 - simulated)) / rounds);
    const published = reference[name];
    const pass = Math.abs(simulated - published) <= halfWidth;
    lines.push(
      `  ${name}: simulated ${percent(simulated)} ± ${percent(halfWidth)} (99%), published ${percent(published)}, difference ${percent(simulated - published)}${pass ? '' : '  FAIL'}`,
    );
    if (!pass) failures.push(name);
  }

  for (const [net, published] of NET_WIN_PROBABILITIES) {
    const simulated = (netCounts[net * 2 + MAX_HALF_BETS] ?? 0) / rounds;
    const standardError = Math.sqrt((published * (1 - published)) / rounds);
    const z = (simulated - published) / standardError;
    const gated = published >= ROW_MINIMUM_PROBABILITY;
    const pass = !gated || Math.abs(z) <= ROW_Z_LIMIT;
    lines.push(
      `  net ${String(net)}: simulated ${simulated.toFixed(8)}, published ${published.toFixed(8)}, z ${z.toFixed(2)}${gated ? '' : ' (not gated)'}${pass ? '' : '  FAIL'}`,
    );
    if (!pass) failures.push(`net ${String(net)}`);
  }
  const outsideTable = [...netCounts.entries()].filter(
    ([index, count]) => count > 0 && !NET_WIN_PROBABILITIES.has((index - MAX_HALF_BETS) / 2),
  );
  lines.push(`  net results outside the table: ${String(outsideTable.length)}`);

  const meanPerBet = sumHalfBets / 2 / rounds;
  lines.push(
    `  mean per bet: simulated ${percent(meanPerBet)}, table expectation ${percent(referenceExpectation())}`,
  );
  console.log(lines.join('\n'));

  expect(unavailable, 'an unlimited bankroll never cuts an action short').toBe(0);
  expect(outsideTable, 'every net result appears in the published table').toEqual([]);
  expect(failures, lines.join('\n')).toEqual([]);
});
