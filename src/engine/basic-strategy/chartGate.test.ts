import { describe, expect, it } from 'vitest';
import { BASELINE_RULES } from '../../shared/defaults';
import type { RuleSet } from '../../shared/schema';
import { H17_DAS, H17_NO_DAS, S17_DAS, S17_NO_DAS } from './__fixtures__/wizardOfOdds4to8Decks';
import { renderChart } from './chart';
import { getStrategyTable } from './solver';

// Chart gate (spec 6.3, gate 1): every Tier 1 rule set's generated table must match the
// published chart cell by cell. Reference and source: ./__fixtures__/wizardOfOdds4to8Decks.ts.
// The blackjack payout never changes a decision, but each payout still gets its own table.

const REFERENCES = {
  'S17 DAS': { rules: { soft17: 'S17', doubleAfterSplit: true }, chart: S17_DAS },
  'S17 no DAS': { rules: { soft17: 'S17', doubleAfterSplit: false }, chart: S17_NO_DAS },
  'H17 DAS': { rules: { soft17: 'H17', doubleAfterSplit: true }, chart: H17_DAS },
  'H17 no DAS': { rules: { soft17: 'H17', doubleAfterSplit: false }, chart: H17_NO_DAS },
} as const satisfies Record<string, { rules: Partial<RuleSet>; chart: unknown }>;

const DECKS = [6, 8] as const;
const PAYOUTS = ['3:2', '6:5'] as const;

describe('chart gate: generated tables match the published 4-8 deck charts', () => {
  for (const decks of DECKS) {
    for (const payout of PAYOUTS) {
      for (const [name, reference] of Object.entries(REFERENCES)) {
        it(`${String(decks)} decks, ${name}, ${payout}`, { timeout: 30_000 }, () => {
          const rules: RuleSet = {
            ...BASELINE_RULES,
            ...reference.rules,
            decks,
            blackjackPayout: payout,
          };
          expect(renderChart(getStrategyTable(rules))).toEqual(reference.chart);
        });
      }
    }
  }
});
