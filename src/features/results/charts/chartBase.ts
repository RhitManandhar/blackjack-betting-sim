import type { StrategyId } from '../../../shared/strategies';
import { STRATEGIES } from '../../../shared/strategies';
import { chartInk, strategyColor } from '../strategyColors';

// Shared pieces for chart option builders. Every builder returns plain JSON (no functions), so
// the same options render in the app and inside the standalone HTML report (Phase 8c).
// Money arrives in integer cents and is converted to currency units, rounded to the cent, only
// here for display.

export type ChartOption = Record<string, unknown>;

export interface ChartTheme {
  readonly dark: boolean;
}

/** Currency units for display, exact to the cent. */
export function toUnits(cents: number): number {
  return Math.round(cents) / 100;
}

export function strategyName(id: StrategyId): string {
  return STRATEGIES[id].name;
}

export function seriesColor(id: StrategyId, theme: ChartTheme): string {
  return strategyColor(id, theme.dark);
}

export function baseOption(theme: ChartTheme): ChartOption {
  const ink = chartInk(theme.dark);
  return {
    animation: false,
    textStyle: { color: ink.text },
    legend: { top: 0, textStyle: { color: ink.text }, type: 'scroll' },
  };
}

export function valueAxis(theme: ChartTheme, name: string, extra: ChartOption = {}): ChartOption {
  const ink = chartInk(theme.dark);
  return {
    type: 'value',
    name,
    nameTextStyle: { color: ink.muted },
    axisLabel: { color: ink.muted },
    splitLine: { lineStyle: { color: ink.grid } },
    ...extra,
  };
}

export function categoryAxis(
  theme: ChartTheme,
  name: string,
  data: readonly string[],
): ChartOption {
  const ink = chartInk(theme.dark);
  return {
    type: 'category',
    name,
    nameLocation: 'middle',
    nameGap: 28,
    nameTextStyle: { color: ink.muted },
    axisLabel: { color: ink.muted },
    data: [...data],
  };
}
