import { Action, bestTotalAction, prefersSplit } from './decision';
import {
  HARD_MAX,
  HARD_MIN,
  SOFT_MAX,
  SOFT_MIN,
  type StrategyTable,
  hardRow,
  softRow,
} from './table';

// Renders a generated table in the notation of published charts:
// H hit, S stand, Dh double else hit, Ds double else stand, P split, - do not split.
// Used by the chart gate (spec 6.3) and to show the active strategy to the user.

export type ChartCode = 'H' | 'S' | 'Dh' | 'Ds' | 'P' | '-';

/** Rows keyed by label ("hard 16", "soft 18", "pair 8"); columns are upcards 2..10 then ace. */
export type Chart = Readonly<Record<string, readonly ChartCode[]>>;

export const CHART_UPCARDS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1] as const;

function totalCode(table: StrategyTable, row: number, upcard: number): ChartCode {
  const action = bestTotalAction(table, row, upcard, true);
  if (action !== Action.Double) return action === Action.Hit ? 'H' : 'S';
  return bestTotalAction(table, row, upcard, false) === Action.Hit ? 'Dh' : 'Ds';
}

export function renderChart(table: StrategyTable): Chart {
  const chart: Record<string, ChartCode[]> = {};
  for (let total = HARD_MIN + 1; total <= HARD_MAX; total += 1) {
    chart[`hard ${total}`] = CHART_UPCARDS.map((up) => totalCode(table, hardRow(total), up));
  }
  for (let total = SOFT_MIN + 1; total <= SOFT_MAX; total += 1) {
    chart[`soft ${total}`] = CHART_UPCARDS.map((up) => totalCode(table, softRow(total), up));
  }
  for (let pair = 1; pair <= 10; pair += 1) {
    chart[`pair ${pair === 1 ? 'A' : String(pair)}`] = CHART_UPCARDS.map((up) =>
      prefersSplit(table, pair, up) ? 'P' : '-',
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
