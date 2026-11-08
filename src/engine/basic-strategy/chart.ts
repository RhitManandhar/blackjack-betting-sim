import type { RuleSet } from '../../shared/schema';
import { doubleAllowedOnTotal } from '../blackjack/rules';
import { Action, SURRENDER_EV, bestTotalAction, prefersSplit } from './decision';
import {
  HARD_MAX,
  HARD_MIN,
  SOFT_MAX,
  SOFT_MIN,
  type StrategyTable,
  hardRow,
  pairCellIndex,
  softRow,
} from './table';

// Renders a generated table in the notation of published charts, for the initial two-card hand
// under the given rules:
// H hit, S stand, Dh double else hit, Ds double else stand,
// Rh surrender else hit, Rs surrender else stand,
// P split, Rp surrender else split, - do not split (play the total).
// Used by the chart gate (spec 6.3) and to show the active strategy to the user.

export type ChartCode = 'H' | 'S' | 'Dh' | 'Ds' | 'Rh' | 'Rs' | 'P' | 'Rp' | '-';

/** Rows keyed by label ("hard 16", "soft 18", "pair 8"); columns are upcards 2..10 then ace. */
export type Chart = Readonly<Record<string, readonly ChartCode[]>>;

export const CHART_UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1] as const;

function totalCode(
  table: StrategyTable,
  rules: RuleSet,
  row: number,
  total: number,
  upcard: number,
): ChartCode {
  const doubleLegal = doubleAllowedOnTotal(rules, total);
  const action = bestTotalAction(table, row, upcard, doubleLegal, rules.lateSurrender);
  const fallbackIsHit = bestTotalAction(table, row, upcard, false) === Action.Hit;
  switch (action) {
    case Action.Surrender:
      return fallbackIsHit ? 'Rh' : 'Rs';
    case Action.Double:
      return fallbackIsHit ? 'Dh' : 'Ds';
    case Action.Hit:
      return 'H';
    case Action.Stand:
    case Action.Split:
      return 'S';
  }
}

function pairCode(table: StrategyTable, rules: RuleSet, pair: number, upcard: number): ChartCode {
  if (prefersSplit(table, pair, upcard)) return 'P';
  const index = pairCellIndex(pair, upcard);
  const surrenders = rules.lateSurrender && (table.noSplit[index] ?? 0) === SURRENDER_EV;
  const splitBeatsPlaying = (table.split[index] ?? 0) > (table.noSplitWithoutSurrender[index] ?? 0);
  return surrenders && splitBeatsPlaying ? 'Rp' : '-';
}

export function renderChart(table: StrategyTable, rules: RuleSet): Chart {
  const chart: Record<string, ChartCode[]> = {};
  for (let total = HARD_MIN + 1; total <= HARD_MAX; total += 1) {
    chart[`hard ${String(total)}`] = CHART_UPCARDS.map((up) =>
      totalCode(table, rules, hardRow(total), total, up),
    );
  }
  for (let total = SOFT_MIN + 1; total <= SOFT_MAX; total += 1) {
    chart[`soft ${String(total)}`] = CHART_UPCARDS.map((up) =>
      totalCode(table, rules, softRow(total), total, up),
    );
  }
  for (let pair = 1; pair <= 10; pair += 1) {
    chart[`pair ${pair === 1 ? 'A' : String(pair)}`] = CHART_UPCARDS.map((up) =>
      pairCode(table, rules, pair, up),
    );
  }
  return chart;
}

export function formatChart(chart: Chart): string {
  const header = ['', ...CHART_UPCARDS.map((up) => (up === 1 ? 'A' : String(up)))];
  const lines = [header.map((cell) => cell.padEnd(8)).join('')];
  for (const [label, codes] of Object.entries(chart)) {
    lines.push([label, ...codes].map((cell) => cell.padEnd(8)).join(''));
  }
  return lines.join('\n');
}
