import type { ExperimentResults } from '../../../engine/statistics/experimentResults';
import type { ExperimentSummary } from '../../../engine/statistics/summary';
import type { StrategySimulationResult } from '../../../engine/simulation/runSimulation';
import { SPEC_VERSION } from '../../../shared/constants';
import type { ExperimentConfig } from '../../../shared/schema';
import type { ChartOption } from '../charts/chartBase';
import {
  betProgressionOption,
  checkpointBandsOption,
  drawdownOption,
  finalProfitOption,
  stillPlayingOption,
  targetAttainmentOption,
} from '../charts/dashboardCharts';
import { simulationPanelOption } from '../charts/panelChart';
import { count } from '../resultsData';
import {
  type DashboardChartKey,
  type EndedStatus,
  RETURN_NOTE,
  SMALL_SAMPLE_NOTE,
  STATUS_NOTE,
  chartText,
  targetBankrollFor,
} from '../resultsText';
import { escapeHtml, jsonForScript, paragraph, scriptSafe, section } from './html';
import { REPORT_CSS } from './reportStyle';
import {
  checkpointsSection,
  comparisonSection,
  configurationSection,
  gridSection,
  rankingsSection,
  samplesSection,
  targetsSection,
} from './reportSections';

// Standalone interactive HTML report (spec 10.8, plan 8.4): one file with ECharts, styling and
// data inlined and no external references, so it opens offline. Charts use the same option
// builders as the dashboard, built for both themes; the page picks the one matching the
// viewer's system theme.

export interface ReportInput {
  readonly config: ExperimentConfig;
  readonly status: EndedStatus;
  readonly totalSimulations: number;
  readonly summary: ExperimentSummary;
  readonly results: ExperimentResults;
  readonly displayed: readonly (readonly StrategySimulationResult[] | null)[];
  readonly error: string | null;
  /** When the report was made, shown as written; passed in so the output is reproducible. */
  readonly generatedAt: string;
}

type ThemedCharts = Record<string, ChartOption>;

function chartsFor(input: ReportInput, dark: boolean): ThemedCharts {
  const strategies = input.summary.strategies;
  const theme = { dark };
  const charts: ThemedCharts = {
    finalProfit: finalProfitOption(strategies, theme),
    targets: targetAttainmentOption(strategies, theme),
    drawdown: drawdownOption(strategies, theme),
  };
  if (input.config.checkpoints.length > 0) {
    charts.bands = checkpointBandsOption(strategies, theme);
    charts.bets = betProgressionOption(strategies, theme);
    charts.stillPlaying = stillPlayingOption(strategies, theme);
  }
  input.displayed.forEach((results, index) => {
    if (results === null) return;
    charts[`panel-${String(index)}`] = simulationPanelOption(results, {
      dark,
      startingBankroll: input.config.startingBankroll,
      targetBankroll: targetBankrollFor(input.config),
      compact: false,
    });
  });
  return charts;
}

function chartsSection(input: ReportInput): string {
  const truncated = input.config.targetMode !== 'none';
  const keys: DashboardChartKey[] =
    input.config.checkpoints.length > 0
      ? ['bands', 'finalProfit', 'targets', 'drawdown', 'bets', 'stillPlaying']
      : ['finalProfit', 'targets', 'drawdown'];
  const figures = keys
    .map((key) => {
      const text = chartText(key, truncated);
      return `<figure class="card"><figcaption><strong>${escapeHtml(text.title)}</strong><span class="muted">${escapeHtml(text.note)}</span></figcaption><div class="chart" data-chart="${key}" role="img" aria-label="${escapeHtml(text.ariaLabel)}"></div></figure>`;
    })
    .join('\n');
  return section('charts', 'Charts', `<div class="charts">${figures}</div>`);
}

function overviewSection(input: ReportInput): string {
  const { summary, status } = input;
  const partial = status !== 'complete';
  const banner = partial
    ? `<p class="banner" role="note"><strong>Partial results.</strong> ${escapeHtml(STATUS_NOTE[status])}${input.error === null ? '' : ` Error: ${escapeHtml(input.error)}`}</p>`
    : '<p class="banner ok" role="note"><strong>Complete run.</strong> Every simulation finished.</p>';
  const small = summary.strategies.some((strategy) => strategy.smallSample)
    ? paragraph(SMALL_SAMPLE_NOTE, 'warning')
    : '';
  return `${banner}\n${paragraph(
    `${count.format(summary.completedSimulations)} of ${count.format(input.totalSimulations)} simulations, seed ${String(input.config.experimentSeed)}. ${RETURN_NOTE}`,
  )}\n${small}\n${paragraph('No betting system changes the house edge. Rankings are the best under this selected configuration only, never a universal best.', 'muted')}`;
}

const INIT_SCRIPT = `(function () {
  var data = JSON.parse(document.getElementById('report-data').textContent);
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var charts = [];
  function render() {
    var options = data.charts[media && media.matches ? 'dark' : 'light'];
    var nodes = document.querySelectorAll('[data-chart]');
    for (var i = 0; i < nodes.length; i += 1) {
      var option = options[nodes[i].getAttribute('data-chart')];
      if (!option) continue;
      var chart = echarts.getInstanceByDom(nodes[i]) || echarts.init(nodes[i]);
      if (charts.indexOf(chart) < 0) charts.push(chart);
      chart.setOption(option, true);
    }
  }
  render();
  if (media && media.addEventListener) media.addEventListener('change', render);
  window.addEventListener('resize', function () {
    for (var i = 0; i < charts.length; i += 1) charts[i].resize();
  });
})();`;

export function buildHtmlReport(input: ReportInput, echartsSource: string): string {
  const title = `Blackjack betting simulation report${input.status === 'complete' ? '' : ' (partial)'}`;
  const data = { charts: { light: chartsFor(input, false), dark: chartsFor(input, true) } };
  const body = [
    `<header><h1>${escapeHtml(title)}</h1><p class="muted">Experiment ${escapeHtml(input.config.experimentId)} · spec ${escapeHtml(SPEC_VERSION)} · generated ${escapeHtml(input.generatedAt)}</p></header>`,
    overviewSection(input),
    configurationSection(input.config),
    comparisonSection(input.summary.strategies),
    rankingsSection(input.summary.strategies, input.config.checkpoints),
    chartsSection(input),
    targetsSection(input.summary.strategies),
    checkpointsSection(input.summary.strategies),
    gridSection(input.displayed, input.config.experimentSeed),
    samplesSection(input.results, input.config.experimentSeed),
    `<footer class="muted">Made by the Blackjack Betting Simulator, a personal Monte Carlo tool. No real money is involved. This file works offline.</footer>`,
  ]
    .filter((part) => part.length > 0)
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
<main>
${body}
</main>
<script type="application/json" id="report-data">${jsonForScript(data)}</script>
<script>${scriptSafe(echartsSource)}</script>
<script>${INIT_SCRIPT}</script>
</body>
</html>
`;
}
