import { describe, expect, it } from 'vitest';
import { STRATEGY_IDS } from '../../shared/strategies';
import { Rng } from '../simulation/rng';
import { OUTCOMES, type OutcomeCode, type ReplaySetup, replay } from './__tests__/replay';
import { oscarsGrind } from './oscarsGrind';
import { getBettingStrategy } from './registry';

// Property tests (plan Phase 4 exit criteria): across many seeded random configurations and
// outcome sequences, no bet is ever placed below the table minimum, above the bankroll or above
// the table maximum, and every refused bet carries the right stop reason. Seeded with our own
// RNG, so failures are reproducible from the printed seed.

const RUNS_PER_STRATEGY = 500;
const MAX_ROUNDS = 400;
const OUTCOME_CODES = Object.keys(OUTCOMES) as OutcomeCode[];

function randomSetup(rng: Rng): ReplaySetup {
  const tableMinimum = 100 + rng.nextBelow(4901); // 1.00 to 50.00, odd cents included
  const unit = tableMinimum + rng.nextBelow(2 * tableMinimum + 1);
  const startingBankroll = unit * (1 + rng.nextBelow(60)) + rng.nextBelow(unit);
  const tableMaximum = rng.nextBelow(2) === 0 ? null : unit + rng.nextBelow(20 * unit);
  return {
    params: { unit, tableMinimum, paroliStreakLength: 2 + rng.nextBelow(4) },
    startingBankroll,
    tableMaximum,
  };
}

function randomOutcomes(rng: Rng): OutcomeCode[] {
  const length = 1 + rng.nextBelow(MAX_ROUNDS);
  return Array.from({ length }, () => OUTCOME_CODES[rng.nextBelow(OUTCOME_CODES.length)] ?? 'P');
}

describe.each(STRATEGY_IDS)('%s: bet limits hold for random play', (id) => {
  it(`never places an out-of-limit bet and always records the right stop reason (${String(RUNS_PER_STRATEGY)} runs)`, () => {
    const strategy = getBettingStrategy(id);
    const rng = new Rng(0xbe7 + STRATEGY_IDS.indexOf(id));

    for (let run = 0; run < RUNS_PER_STRATEGY; run += 1) {
      const setup = randomSetup(rng);
      const outcomes = randomOutcomes(rng);
      const { tableMinimum } = setup.params;
      const result = replay(strategy, setup, outcomes);
      const context = `run ${String(run)}: ${JSON.stringify(setup)}`;

      let bankrollBefore = setup.startingBankroll;
      for (const row of result.rows) {
        expect(Number.isSafeInteger(row.bet), context).toBe(true);
        expect(row.bet, context).toBeGreaterThanOrEqual(tableMinimum);
        expect(row.bet, context).toBeLessThanOrEqual(bankrollBefore);
        if (setup.tableMaximum !== null) {
          expect(row.bet, context).toBeLessThanOrEqual(setup.tableMaximum);
        }
        bankrollBefore = row.bankroll;
      }
      expect(result.finalBankroll, context).toBe(setup.startingBankroll + result.netProfit);

      if (result.stop === null) {
        expect(result.rows.length, context).toBe(outcomes.length);
        continue;
      }
      const { reason, requiredBet } = result.stop;
      expect(requiredBet, context).toBeGreaterThanOrEqual(tableMinimum);
      if (reason === 'blocked_table_max') {
        expect(setup.tableMaximum, context).not.toBeNull();
        expect(requiredBet, context).toBeGreaterThan(setup.tableMaximum ?? Infinity);
      } else {
        expect(requiredBet, context).toBeGreaterThan(result.finalBankroll);
        if (setup.tableMaximum !== null) {
          expect(requiredBet, context).toBeLessThanOrEqual(setup.tableMaximum);
        }
      }
    }
  });
});

describe("Oscar's Grind cycle-goal cap", () => {
  it('never bets more than an even-money win needs to close the cycle, except to meet the minimum', () => {
    const rng = new Rng(0x05ca);
    for (let run = 0; run < RUNS_PER_STRATEGY; run += 1) {
      const setup = randomSetup(rng);
      const { unit, tableMinimum } = setup.params;
      const result = replay(oscarsGrind, setup, randomOutcomes(rng));

      let cycleBefore = 0;
      let betOverNeeded = false;
      for (const [index, row] of result.rows.entries()) {
        const needed = unit - cycleBefore;
        expect(needed).toBeGreaterThan(0);
        // A minimum-forced bet is kept through pushes, so it can stay above `needed` for
        // several rounds; it is recorded once, when it is set.
        if (row.bet > needed) {
          expect(row.bet).toBe(tableMinimum);
          betOverNeeded = true;
        }
        cycleBefore = result.states[index]?.cycleProfit ?? 0;
      }
      const { minimumOvershootCount, minimumOvershootTotal } = result.finalState;
      if (betOverNeeded) expect(minimumOvershootCount).toBeGreaterThan(0);
      expect(minimumOvershootCount === 0).toBe(minimumOvershootTotal === 0);
      if (unit === tableMinimum)
        expect(minimumOvershootTotal).toBeLessThan(minimumOvershootCount * unit);
    }
  });
});
