import {
  CHECKPOINT_BINS,
  checkpointLayout,
  histogramSlot,
} from '../../../engine/statistics/checkpointAggregate';
import type { ExperimentResults } from '../../../engine/statistics/experimentResults';
import {
  type ChartOption,
  type ChartTheme,
  baseOption,
  seriesColor,
  strategyName,
  toUnits,
  valueAxis,
} from './chartBase';

// Live profit histogram (plan 8.2), built from the finished simulations only. It uses the same
// fixed layout as the checkpoint histograms (spec 10.3), coarsened for display, so it never
// depends on the order simulations arrive in.

const DISPLAY_BINS = 80;
const MERGE = CHECKPOINT_BINS / DISPLAY_BINS;

export interface ProfitHistogram {
  readonly binCentres: readonly number[];
  /** Per strategy: counts per display bin; index 0 and the last include under/overflow. */
  readonly counts: readonly (readonly number[])[];
  readonly completed: number;
}

export function profitHistogram(results: ExperimentResults): ProfitHistogram {
  const layout = checkpointLayout(results.shape.startingBankroll);
  const width = ((layout.upper - layout.lower) / layout.bins) * MERGE;
  const binCentres = Array.from(
    { length: DISPLAY_BINS },
    (_, bin) => layout.lower + (bin + 0.5) * width,
  );
  const counts = results.columns.map(() => new Array<number>(DISPLAY_BINS).fill(0));
  for (let simulation = 0; simulation < results.shape.simulations; simulation += 1) {
    if (!results.isCompleted(simulation)) continue;
    results.columns.forEach((columns, strategy) => {
      const slot = histogramSlot(layout, columns.netProfit[simulation] ?? 0);
      const bin = Math.min(DISPLAY_BINS - 1, Math.max(0, Math.floor((slot - 1) / MERGE)));
      const row = counts[strategy];
      if (row !== undefined) row[bin] = (row[bin] ?? 0) + 1;
    });
  }
  return { binCentres, counts, completed: results.completed };
}

export function profitHistogramOption(
  results: ExperimentResults,
  histogram: ProfitHistogram,
  theme: ChartTheme,
): ChartOption {
  return {
    ...baseOption(theme),
    grid: { left: 64, right: 24, top: 48, bottom: 48 },
    tooltip: { trigger: 'axis' },
    xAxis: valueAxis(theme, 'Profit so far (AUD)', {
      nameLocation: 'middle',
      nameGap: 28,
      scale: true,
      splitLine: { show: false },
    }),
    yAxis: valueAxis(theme, 'Simulations'),
    series: results.shape.strategies.map((strategy, index) => ({
      name: strategyName(strategy.id),
      type: 'line',
      step: 'middle',
      showSymbol: false,
      color: seriesColor(strategy.id, theme),
      lineStyle: { width: 1.5 },
      data: histogram.binCentres.map((centre, bin) => [
        toUnits(centre),
        histogram.counts[index]?.[bin] ?? 0,
      ]),
    })),
  };
}
