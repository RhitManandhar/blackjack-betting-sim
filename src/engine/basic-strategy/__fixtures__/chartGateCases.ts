import { expect, it } from 'vitest';
import { BASELINE_RULES } from '../../../shared/defaults';
import type { RuleSet } from '../../../shared/schema';
import { CHART_UPCARDS, type ChartCode, renderChart } from '../chart';
import { getStrategyTable } from '../solver';
import { type StrategyTable, cellIndex, hardRow, pairCellIndex } from '../table';
import { PUBLISHED, resolve, restrictDoubles } from './wizardOfOddsCharts';

// Chart gate (spec 6.3, gate 1) cases. Every generated cell must equal the published chart,
// except the named exceptions below. Those were agreed with the project owner on 8 Nov 2026;
// each is pinned to its measured EV margin, so any further drift fails. See docs/validation.md.

export interface ChartException {
  readonly row: string;
  readonly upcard: number;
  readonly published: ChartCode;
  readonly ours: ChartCode;
  /** EV(published action) − EV(our action), in bets; must stay in [-maxGap, 0]. */
  readonly gap: (table: StrategyTable) => number;
  readonly maxGap: number;
}

export interface ChartGateCase {
  readonly label: string;
  readonly rules: RuleSet;
  readonly expected: Record<string, ChartCode[]>;
  /** Rows checked; restriction cases check total rows only (pair rows are not published). */
  readonly rows: 'all' | 'totals';
  readonly exceptions: readonly ChartException[];
}

const ELEVEN_VS_ACE: ChartException = {
  row: 'hard 11',
  upcard: 1,
  published: 'Dh',
  ours: 'H',
  gap: (table) => {
    const index = cellIndex(hardRow(11), 1);
    return (table.double[index] ?? 0) - (table.hit[index] ?? 0);
  },
  maxGap: 0.003,
};

const NINES_VS_ACE: ChartException = {
  row: 'pair 9',
  upcard: 1,
  published: 'P',
  ours: '-',
  gap: (table) => {
    const index = pairCellIndex(9, 1);
    return (table.split[index] ?? 0) - (table.noSplit[index] ?? 0);
  },
  maxGap: 0.007,
};

function exceptionsFor(rules: RuleSet): ChartException[] {
  if (rules.decks === 2 && rules.soft17 === 'S17') return [ELEVEN_VS_ACE];
  if (rules.decks === 1 && rules.soft17 === 'H17' && rules.doubleAfterSplit) return [NINES_VS_ACE];
  return [];
}

function publishedGroup(decks: RuleSet['decks']): keyof typeof PUBLISHED {
  return decks === 1 ? 1 : decks === 2 ? 2 : '4-8';
}

export function standardCases(decks: RuleSet['decks']): ChartGateCase[] {
  const cases: ChartGateCase[] = [];
  for (const soft17 of ['S17', 'H17'] as const) {
    for (const doubleAfterSplit of [true, false]) {
      for (const lateSurrender of [false, true]) {
        const payouts =
          decks >= 6 && !lateSurrender ? (['3:2', '6:5'] as const) : (['3:2'] as const);
        for (const blackjackPayout of payouts) {
          const rules: RuleSet = {
            ...BASELINE_RULES,
            decks,
            soft17,
            doubleAfterSplit,
            lateSurrender,
            blackjackPayout,
          };
          cases.push({
            label: `${String(decks)} deck(s), ${soft17}, ${doubleAfterSplit ? 'DAS' : 'no DAS'}${lateSurrender ? ', late surrender' : ''}, ${blackjackPayout}`,
            rules,
            expected: resolve(PUBLISHED[publishedGroup(decks)][soft17], {
              doubleAfterSplit,
              lateSurrender,
            }),
            rows: 'all',
            exceptions: exceptionsFor(rules),
          });
        }
      }
    }
  }
  return cases;
}

const DOUBLE_ROWS: Record<'9-11' | '10-11', readonly string[]> = {
  '9-11': ['hard 9', 'hard 10', 'hard 11'],
  '10-11': ['hard 10', 'hard 11'],
};

export function optionCases(): ChartGateCase[] {
  const cases: ChartGateCase[] = [];
  for (const decks of [6, 1] as const) {
    const base = resolve(PUBLISHED[publishedGroup(decks)].S17, {
      doubleAfterSplit: true,
      lateSurrender: false,
    });
    for (const doubleOn of ['9-11', '10-11'] as const) {
      cases.push({
        label: `${String(decks)} deck(s), S17, DAS, double on ${doubleOn}`,
        rules: { ...BASELINE_RULES, decks, doubleOn },
        expected: restrictDoubles(base, (row) => DOUBLE_ROWS[doubleOn].includes(row)),
        rows: 'totals',
        exceptions: [],
      });
    }
    for (const change of [
      { maxSplitHands: 2 },
      { maxSplitHands: 3 },
      { resplitAces: true },
    ] as const) {
      cases.push({
        label: `${String(decks)} deck(s), S17, DAS, ${JSON.stringify(change)}`,
        rules: { ...BASELINE_RULES, decks, ...change },
        expected: base,
        rows: 'all',
        exceptions: [],
      });
    }
  }
  for (const penetrationPercent of [50, 90] as const) {
    cases.push({
      label: `6 decks, S17, DAS, ${String(penetrationPercent)}% penetration`,
      rules: { ...BASELINE_RULES, penetrationPercent },
      expected: resolve(PUBLISHED['4-8'].S17, { doubleAfterSplit: true, lateSurrender: false }),
      rows: 'all',
      exceptions: [],
    });
  }
  return cases;
}

export function runChartGate(cases: readonly ChartGateCase[]): void {
  for (const testCase of cases) {
    it(testCase.label, { timeout: 60_000 }, () => {
      const table = getStrategyTable(testCase.rules);
      const actual = renderChart(table, testCase.rules);
      const expected: Record<string, ChartCode[]> = {};
      const compared: Record<string, (ChartCode | undefined)[]> = {};
      for (const [row, cells] of Object.entries(testCase.expected)) {
        if (testCase.rows === 'totals' && row.startsWith('pair')) continue;
        expected[row] = [...cells];
        compared[row] = [...(actual[row] ?? [])];
      }
      for (const exception of testCase.exceptions) {
        const column = CHART_UPCARDS.indexOf(exception.upcard as (typeof CHART_UPCARDS)[number]);
        expect(expected[exception.row]?.[column], 'exception matches the published cell').toBe(
          exception.published,
        );
        expect(compared[exception.row]?.[column], 'exception matches our cell').toBe(
          exception.ours,
        );
        const gap = exception.gap(table);
        expect(gap).toBeLessThanOrEqual(0);
        expect(gap).toBeGreaterThanOrEqual(-exception.maxGap);
        const expectedRow = expected[exception.row];
        if (expectedRow !== undefined) expectedRow[column] = exception.ours;
      }
      expect(compared).toEqual(expected);
    });
  }
}
