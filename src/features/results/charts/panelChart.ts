import type { StrategySimulationResult } from '../../../engine/simulation/runSimulation';
import type { StopReason } from '../../../shared/stopReasons';
import { chartInk } from '../strategyColors';
import {
  type ChartOption,
  type ChartTheme,
  baseOption,
  seriesColor,
  strategyName,
  toUnits,
  valueAxis,
} from './chartBase';

// One comparison panel (spec 10.9): each chosen strategy's bankroll in one simulation, on the
// same cards. A line ends where its strategy stopped, labelled with the stop reason; stopped
// strategies are not carried forward here. The tooltip shows round, bankroll and bet.

export const STOP_LABELS: Record<StopReason, string> = {
  target_reached: 'target reached',
  bust: 'bust',
  blocked_table_max: 'blocked by table max',
  round_limit: 'round limit',
};

export interface PanelOptions extends ChartTheme {
  readonly startingBankroll: number;
  readonly targetBankroll: number | null;
  /** Small grid panels hide the legend, zoom slider and end labels; the enlarged view shows them. */
  readonly compact: boolean;
}

export function simulationPanelOption(
  results: readonly StrategySimulationResult[],
  options: PanelOptions,
): ChartOption {
  const ink = chartInk(options.dark);
  const referenceLines = [
    { yAxis: toUnits(options.startingBankroll), name: 'Start' },
    ...(options.targetBankroll === null
      ? []
      : [{ yAxis: toUnits(options.targetBankroll), name: 'Target' }]),
  ];
  return {
    ...baseOption(options),
    ...(options.compact ? { legend: { show: false } } : {}),
    grid: options.compact
      ? { left: 48, right: 12, top: 12, bottom: 24 }
      : { left: 64, right: 140, top: 40, bottom: 56 },
    tooltip: { trigger: 'axis' },
    dataZoom: options.compact
      ? []
      : [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }],
    xAxis: valueAxis(options, options.compact ? '' : 'Round', {
      min: 0,
      nameLocation: 'middle',
      nameGap: 28,
      splitLine: { show: false },
    }),
    yAxis: valueAxis(options, options.compact ? '' : 'Bankroll', { scale: true }),
    series: results.map((result, index) => {
      const curve = result.curve;
      const points =
        curve === null
          ? []
          : curve.rounds.map((round, point) => [
              round,
              toUnits(curve.bankrolls[point] ?? 0),
              toUnits(curve.bets[point] ?? 0),
            ]);
      return {
        name: strategyName(result.strategyId),
        type: 'line',
        showSymbol: false,
        symbolSize: 8,
        lineStyle: { width: options.compact ? 1.5 : 2 },
        color: seriesColor(result.strategyId, options),
        dimensions: ['Round', 'Bankroll', 'Bet'],
        encode: { x: 'Round', y: 'Bankroll', tooltip: ['Bankroll', 'Bet'] },
        data: points,
        endLabel: {
          show: !options.compact,
          color: ink.text,
          formatter: STOP_LABELS[result.stopReason],
        },
        ...(index === 0
          ? {
              markLine: {
                silent: true,
                symbol: 'none',
                lineStyle: { color: ink.muted, type: 'dashed', width: 1 },
                label: { color: ink.muted, formatter: '{b}', show: !options.compact },
                data: referenceLines,
              },
            }
          : {}),
      };
    }),
  };
}
