import type { StrategyId } from '../../shared/strategies';

// Fixed categorical colour per strategy, assigned in STRATEGY_IDS order and never cycled, so a
// strategy keeps its colour whichever others are selected. Validated with the dataviz palette
// checker against our surfaces (white / slate-900): all hard checks pass in both modes. Three
// light-mode colours sit below 3:1 contrast, so every chart also has direct labels or a table.

const LIGHT: Record<StrategyId, string> = {
  flat: '#2a78d6',
  martingale: '#eb6834',
  'paroli-classic': '#1baf7a',
  'paroli-1326': '#eda100',
  'oscars-grind-bj': '#e87ba4',
};

const DARK: Record<StrategyId, string> = {
  flat: '#3987e5',
  martingale: '#d95926',
  'paroli-classic': '#199e70',
  'paroli-1326': '#c98500',
  'oscars-grind-bj': '#d55181',
};

export function strategyColor(id: StrategyId, dark: boolean): string {
  return (dark ? DARK : LIGHT)[id];
}

export interface ChartInk {
  readonly text: string;
  readonly muted: string;
  readonly grid: string;
  readonly surface: string;
}

/** Text and axis colours match the page's slate tokens; text never uses a series colour. */
export function chartInk(dark: boolean): ChartInk {
  return dark
    ? { text: '#e2e8f0', muted: '#94a3b8', grid: '#1e293b', surface: '#0f172a' }
    : { text: '#0f172a', muted: '#475569', grid: '#e2e8f0', surface: '#ffffff' };
}
