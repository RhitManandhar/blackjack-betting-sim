import { describe, expect, it } from 'vitest';
import { testConfig } from '../../../engine/simulation/__tests__/scripted';
import { createSimulationPlan } from '../../../engine/simulation/plan';
import { runSimulation } from '../../../engine/simulation/runSimulation';
import { ExperimentResults } from '../../../engine/statistics/experimentResults';
import { summarizeExperiment } from '../../../engine/statistics/summary';
import { STRATEGIES, STRATEGY_IDS } from '../../../shared/strategies';
import { toUnits } from './chartBase';
import {
  betProgressionOption,
  checkpointBandsOption,
  drawdownOption,
  finalProfitOption,
  stillPlayingOption,
  targetAttainmentOption,
} from './dashboardCharts';
import { profitHistogram, profitHistogramOption } from './liveHistogram';
import { simulationPanelOption } from './panelChart';

const config = testConfig({
  simulations: 40,
  roundLimit: 300,
  displayedSimulations: 3,
  strategies: STRATEGY_IDS.map((id) => ({ id, version: STRATEGIES[id].version })),
  targetMode: 'compare_all',
  checkpoints: [50, 100, 300],
});
const plan = createSimulationPlan(config);
const all = Array.from({ length: config.simulations }, (_, index) => runSimulation(plan, index));
const results = new ExperimentResults(config);
for (const simulation of all) results.add(simulation);
const summary = summarizeExperiment(results, true);
const theme = { dark: false };

interface Series {
  name: string;
  data: unknown[];
  type: string;
}
const seriesOf = (option: Record<string, unknown>) => option.series as Series[];

describe('chart options are plain JSON (so the HTML report can embed them)', () => {
  const options = {
    panel: simulationPanelOption(all[0] ?? [], {
      dark: false,
      startingBankroll: config.startingBankroll,
      targetBankroll: null,
      compact: false,
    }),
    bands: checkpointBandsOption(summary.strategies, theme),
    finalProfit: finalProfitOption(summary.strategies, theme),
    drawdown: drawdownOption(summary.strategies, theme),
    targets: targetAttainmentOption(summary.strategies, theme),
    bets: betProgressionOption(summary.strategies, theme),
    stillPlaying: stillPlayingOption(summary.strategies, theme),
    histogram: profitHistogramOption(results, profitHistogram(results), { dark: true }),
  };
  it.each(Object.entries(options))('%s survives a JSON round trip unchanged', (_name, option) => {
    expect(JSON.parse(JSON.stringify(option))).toEqual(option);
  });
});

describe('chart data matches the summary', () => {
  it('panel: one line per strategy, ending at the final round and bankroll', () => {
    const option = simulationPanelOption(all[0] ?? [], {
      dark: false,
      startingBankroll: config.startingBankroll,
      targetBankroll: null,
      compact: true,
    });
    seriesOf(option).forEach((series, index) => {
      const result = all[0]?.[index];
      const last = series.data.at(-1) as number[];
      expect(series.name).toBe(STRATEGIES[result?.strategyId ?? 'flat'].name);
      expect(last[0]).toBe(result?.roundsPlayed);
      expect(last[1]).toBe(toUnits(result?.finalBankroll ?? 0));
    });
  });

  it('final profit box uses the exact 5th, 25th, 50th, 75th and 95th percentiles', () => {
    const data = (seriesOf(finalProfitOption(summary.strategies, theme))[0]?.data ?? []) as {
      value: number[];
    }[];
    summary.strategies.forEach((strategy, index) => {
      const { p5, p25, median, p75, p95 } = strategy.profitPercentiles;
      expect(data[index]?.value).toEqual([p5, p25, median, p75, p95].map(toUnits));
    });
  });

  it('target attainment shows each hit rate as a percentage', () => {
    seriesOf(targetAttainmentOption(summary.strategies, theme)).forEach((series, index) => {
      const expected = summary.strategies[index]?.targets.map(
        (t) => Math.round(t.hitRate * 1000) / 10,
      );
      expect(series.data).toEqual(expected);
    });
  });

  it('bet progression shows mean and 95th-percentile bets per checkpoint', () => {
    const series = seriesOf(betProgressionOption(summary.strategies, theme));
    expect(series).toHaveLength(2 * summary.strategies.length);
    const flatMean = series[0]?.data ?? [];
    summary.strategies[0]?.checkpoints.forEach((checkpoint, index) => {
      expect(flatMean[index]).toBe(
        checkpoint.bets.meanBet === null ? null : toUnits(checkpoint.bets.meanBet),
      );
    });
  });

  it('live histogram counts every finished simulation once per strategy', () => {
    const histogram = profitHistogram(results);
    for (const counts of histogram.counts) {
      expect(counts.reduce((sum, count) => sum + count, 0)).toBe(config.simulations);
    }
  });
});
