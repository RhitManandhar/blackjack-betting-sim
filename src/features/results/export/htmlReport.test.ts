import { describe, expect, it } from 'vitest';
import { testConfig } from '../../../engine/simulation/__tests__/scripted';
import { createSimulationPlan } from '../../../engine/simulation/plan';
import { runSimulation } from '../../../engine/simulation/runSimulation';
import { ExperimentResults } from '../../../engine/statistics/experimentResults';
import { summarizeExperiment } from '../../../engine/statistics/summary';
import type { ExperimentConfig } from '../../../shared/schema';
import { STRATEGIES, STRATEGY_IDS } from '../../../shared/strategies';
import { finalProfitOption } from '../charts/dashboardCharts';
import { count, money, percent, rate } from '../resultsData';
import type { EndedStatus } from '../resultsText';
import { loadEchartsSource } from './echartsSource';
import { type ReportInput, buildHtmlReport } from './htmlReport';

const STUB = '/* echarts stub */';

function reportInput(
  config: ExperimentConfig,
  finished: readonly number[],
  status: EndedStatus = 'complete',
): ReportInput {
  const plan = createSimulationPlan(config);
  const results = new ExperimentResults(config);
  const runs = new Map(finished.map((index) => [index, runSimulation(plan, index)]));
  for (const run of runs.values()) results.add(run);
  return {
    config,
    status,
    totalSimulations: config.simulations,
    summary: summarizeExperiment(results, config.targetMode !== 'none'),
    results,
    displayed: Array.from(
      { length: config.displayedSimulations },
      (_, index) => runs.get(index) ?? null,
    ),
    error: null,
    generatedAt: '2026-11-08 12:00',
  };
}

const config = testConfig({
  simulations: 40,
  roundLimit: 200,
  displayedSimulations: 3,
  strategies: STRATEGY_IDS.map((id) => ({ id, version: STRATEGIES[id].version })),
  targetMode: 'compare_all',
  checkpoints: [50, 100, 200],
});
const all = Array.from({ length: config.simulations }, (_, index) => index);
const complete = reportInput(config, all);
const html = buildHtmlReport(complete, STUB);

function embeddedData(document: string): {
  charts: Record<'light' | 'dark', Record<string, unknown>>;
} {
  const match = /<script type="application\/json" id="report-data">([\s\S]*?)<\/script>/.exec(
    document,
  );
  if (match?.[1] === undefined) throw new Error('No embedded data');
  return JSON.parse(match[1]) as { charts: Record<'light' | 'dark', Record<string, unknown>> };
}

describe('standalone HTML report (spec 10.8)', () => {
  it('has no external references, so it works with the network disabled', () => {
    expect(html).not.toMatch(/<script[^>]*\ssrc=/i);
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/<(img|iframe|object|embed)\b/i);
    expect(html).not.toMatch(/url\(/i);
    expect(html).not.toMatch(/@import/i);
    expect(html).not.toMatch(/https?:\/\//i);
  });

  it('inlines the real ECharts build and stays a few megabytes', async () => {
    const source = await loadEchartsSource();
    expect(source.length).toBeGreaterThan(500_000);
    expect(source).toContain('getInstanceByDom');
    const full = buildHtmlReport(complete, source);
    expect(full).toContain(source.slice(0, 2000));
    expect(full).not.toMatch(/<script[^>]*\ssrc=/i);
    expect(full).not.toMatch(/<link\b/i);
    expect(full.length).toBeLessThan(5 * 1024 * 1024);
  });

  it('shows the same figures as the dashboard, from the same formatters', () => {
    for (const summary of complete.summary.strategies) {
      expect(html).toContain(STRATEGIES[summary.strategyId].name.replace("'", '&#39;'));
      expect(html).toContain(money(summary.profitMean));
      expect(html).toContain(money(summary.profitPercentiles.median));
      expect(html).toContain(percent.format(summary.profitShare));
      expect(html).toContain(rate.format(summary.returnPerUnitWagered));
      expect(html).toContain(money(summary.averageMaxDrawdown));
    }
    expect(html).toContain(`${count.format(40)} of ${count.format(40)} simulations`);
  });

  it('embeds the dashboard chart options unchanged, for both themes', () => {
    const data = embeddedData(html);
    expect(data.charts.light.finalProfit).toEqual(
      JSON.parse(JSON.stringify(finalProfitOption(complete.summary.strategies, { dark: false }))),
    );
    expect(data.charts.dark.finalProfit).toEqual(
      JSON.parse(JSON.stringify(finalProfitOption(complete.summary.strategies, { dark: true }))),
    );
    for (const key of [
      'bands',
      'targets',
      'drawdown',
      'bets',
      'stillPlaying',
      'panel-0',
      'panel-2',
    ]) {
      expect(data.charts.light[key]).toBeDefined();
      expect(html).toContain(`data-chart="${key}"`);
    }
  });

  it('contains configuration, seed, rules, strategy rules, rankings and checkpoint data', () => {
    expect(html).toContain(String(config.experimentSeed));
    expect(html).toContain('Table rules');
    expect(html).toContain('Stands (S17)');
    expect(html).toContain('Main risk:');
    expect(html).toContain('Rankings by goal');
    expect(html).toContain('round 200');
    expect(html).toContain('Checkpoint data');
    expect(html).toContain('Target attainment');
    expect(html).toContain('Complete run.');
    expect(html).not.toContain('(partial)');
  });

  it('labels a cancelled run as partial and never draws unfinished panels', () => {
    const partial = buildHtmlReport(reportInput(config, [1, 2, 5, 9], 'cancelled'), STUB);
    expect(partial).toContain('<title>Blackjack betting simulation report (partial)</title>');
    expect(partial).toContain('Partial results.');
    expect(partial).toContain(`${count.format(4)} of ${count.format(40)} simulations`);
    expect(partial).toContain('Not finished (run cancelled)');
    const charts = embeddedData(partial).charts.light;
    expect(charts['panel-0']).toBeUndefined();
    expect(charts['panel-1']).toBeDefined();
  });

  it('embeds at most 500 sample simulations per strategy, the first by id', () => {
    const big = testConfig({
      simulations: 520,
      roundLimit: 5,
      displayedSimulations: 1,
      strategies: [
        { id: 'flat', version: 'flat-v1' },
        { id: 'martingale', version: 'martingale-v1' },
      ],
    });
    const document = buildHtmlReport(
      reportInput(
        big,
        Array.from({ length: 520 }, (_, index) => index),
      ),
      STUB,
    );
    const samples = document.slice(document.indexOf('id="samples"'));
    const tables = samples.split('<details>').slice(1);
    expect(tables).toHaveLength(2);
    for (const block of tables) {
      expect(block).toContain('(500 simulations)');
      expect(block.match(/<tr>/g)?.length).toBe(501);
      expect(block).toContain('<th scope="row">500</th>');
      expect(block).not.toContain('<th scope="row">501</th>');
    }
  });

  it('escapes configuration text', () => {
    const hostile = buildHtmlReport(
      reportInput({ ...config, experimentId: '</script><b>x</b>' }, [0, 1]),
      STUB,
    );
    expect(hostile).not.toContain('<b>x</b>');
    expect(hostile).toContain('&lt;/script&gt;&lt;b&gt;x&lt;/b&gt;');
  });

  it('never claims a strategy wins or beats the house', () => {
    expect(html).not.toMatch(/guarantee|beats? the (house|casino)|winning (system|strategy)/i);
    expect(html).toContain('best under this selected configuration');
  });
});
