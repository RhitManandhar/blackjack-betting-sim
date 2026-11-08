import { describe, expect, it } from 'vitest';
import { testConfig } from '../../../engine/simulation/__tests__/scripted';
import { createSimulationPlan } from '../../../engine/simulation/plan';
import { simulationSeed } from '../../../engine/simulation/rng';
import { runSimulation } from '../../../engine/simulation/runSimulation';
import { ExperimentResults } from '../../../engine/statistics/experimentResults';
import { summarizeExperiment } from '../../../engine/statistics/summary';
import { STRATEGIES, STRATEGY_IDS } from '../../../shared/strategies';
import {
  CSV_LINE_END,
  averageCell,
  csvCell,
  csvRow,
  integerCell,
  moneyCell,
  rateCell,
} from './csv';
import { handResults, specColumns } from './export.fixtures';
import { type ExportMeta, exportFileName } from './exportMeta';
import {
  SIMULATION_COLUMNS,
  collectBlocks,
  estimateSimulationCsvBytes,
  simulationCsvBlocks,
  simulationCsvRowCount,
} from './simulationCsv';
import { SUMMARY_COLUMNS, summaryCsv } from './summaryCsv';

const meta: ExportMeta = {
  experimentId: 'e-1',
  experimentSeed: 42,
  specVersion: '2.8',
  runStatus: 'complete',
  currency: 'AUD',
};

function parse(csv: string): string[][] {
  expect(csv.endsWith(CSV_LINE_END)).toBe(true);
  return csv
    .slice(0, -CSV_LINE_END.length)
    .split(CSV_LINE_END)
    .map((line) => line.split(','));
}

describe('CSV cells (spec 10.5)', () => {
  it.each([
    ['plain', 'plain'],
    ['a,b', '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ['two\nlines', '"two\nlines"'],
  ])('quotes %j only when needed', (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it('ends every row with CRLF', () => {
    expect(csvRow(['a', 'b'])).toBe('a,b\r\n');
  });

  it.each([
    [-1250, '-12.50'],
    [0, '0.00'],
    [123456, '1234.56'],
    [-1234.5, '-12.35'],
    [1234.5, '12.35'],
    [-0.4, '0.00'],
    [null, ''],
    [Number.NaN, ''],
  ])('money %d cents -> %j (two decimals, halves away from zero)', (cents, expected) => {
    expect(moneyCell(cents)).toBe(expected);
  });

  it.each([
    [0.25, '0.250000'],
    [-0.433333333, '-0.433333'],
    [-1e-9, '0.000000'],
    [1, '1.000000'],
    [null, ''],
    [Number.NaN, ''],
  ])('rate %d -> %j (six decimals)', (value, expected) => {
    expect(rateCell(value)).toBe(expected);
  });

  it('writes non-money averages with two decimals and integers as is', () => {
    expect(averageCell(15)).toBe('15.00');
    expect(averageCell(null)).toBe('');
    expect(integerCell(7)).toBe('7');
    expect(integerCell(null)).toBe('');
  });

  it('names files from the start of the experiment id', () => {
    expect(exportFileName('1a2b3c4d-5e6f-7a8b', 'summary', 'csv')).toBe(
      'bjsim-1a2b3c4d-summary.csv',
    );
    expect(exportFileName('../', 'report', 'html')).toBe('bjsim-experiment-report.html');
  });
});

describe('CSV 1 summary (spec 10.6)', () => {
  it('has exactly the spec columns, in spec order', () => {
    expect([...SUMMARY_COLUMNS]).toEqual(specColumns('### 10.6 CSV 1'));
  });

  it('matches a hand calculation on a small known set', () => {
    const summary = summarizeExperiment(handResults(), false);
    const [header, row, ...rest] = parse(summaryCsv(meta, summary.strategies));
    expect(rest).toEqual([]);
    const cells = Object.fromEntries((header ?? []).map((name, index) => [name, row?.[index]]));
    expect(cells).toEqual({
      experiment_id: 'e-1',
      experiment_seed: '42',
      spec_version: '2.8',
      run_status: 'complete',
      currency: 'AUD',
      strategy_id: 'flat',
      strategy_version: 'flat-v1',
      simulations: '4',
      status_target_reached: '0',
      status_bust: '1',
      status_blocked_table_max: '0',
      status_round_limit: '3',
      share_profit: '0.250000',
      share_profit_ci_low: '0.045587',
      share_profit_ci_high: '0.699358',
      share_break_even: '0.250000',
      share_loss: '0.500000',
      // Profits 20, -40, 0, -500: mean -130, SD 247.92, interval mean ± 1.96·SD/2.
      profit_mean: '-130.00',
      profit_mean_ci_low: '-372.97',
      profit_mean_ci_high: '112.97',
      profit_sd: '247.92',
      // Type-7 percentiles of -500, -40, 0, 20.
      profit_p5: '-431.00',
      profit_p25: '-155.00',
      profit_median: '-20.00',
      profit_p75: '5.00',
      profit_p95: '17.00',
      largest_win: '20.00',
      largest_loss: '-500.00',
      profit_upside_truncated: 'false',
      // -520 / 1,200 wagered, ratio-estimator interval.
      return_per_unit_wagered: '-0.433333',
      rpuw_ci_low: '-0.682522',
      rpuw_ci_high: '-0.184145',
      total_wagered: '1200.00',
      avg_wager: '20.00',
      max_wager: '20.00',
      avg_rounds_played: '15.00',
      max_drawdown: '500.00',
      avg_max_drawdown: '140.00',
      ...Object.fromEntries(
        ['0_5x', '1x', '2x', '2_5x'].flatMap((target) => [
          [`hit_rate_${target}`, '0.000000'],
          [`hit_rate_${target}_ci_low`, '0.000000'],
          [`hit_rate_${target}_ci_high`, '0.489891'],
          [`avg_rounds_to_${target}`, ''],
          [`bust_before_${target}`, '0.250000'],
        ]),
      ),
      bust_rate: '0.250000',
      block_rate: '0.000000',
      // 60 rounds: 16 wins, 2 pushes, 42 losses.
      freq_blackjack: '0.000000',
      freq_win: '0.266667',
      freq_push: '0.033333',
      freq_loss: '0.700000',
      unavailable_actions: '1',
      minimum_overshoot_count: '0',
    });
  });

  it('leaves intervals blank when one simulation gives none', () => {
    const summary = summarizeExperiment(handResults(handResultsRows(1)), false);
    const [header, row] = parse(summaryCsv(meta, summary.strategies));
    const cell = (name: string) => row?.[header?.indexOf(name) ?? -1];
    expect(cell('profit_sd')).toBe('');
    expect(cell('profit_mean_ci_low')).toBe('');
    expect(cell('rpuw_ci_high')).toBe('');
  });
});

function handResultsRows(count: number) {
  return Array.from({ length: count }, () => ({
    netProfit: 2000,
    totalWagered: 2000,
    roundsPlayed: 1,
    maxDrawdown: 0,
    stopReason: 'round_limit' as const,
    win: 1,
    push: 0,
    loss: 0,
    unavailable: 0,
    firstCrossing0_5x: 1,
  }));
}

describe('CSV 2 per simulation (spec 10.7)', () => {
  it('has exactly the spec columns, in spec order', () => {
    expect([...SIMULATION_COLUMNS]).toEqual(specColumns('### 10.7 CSV 2'));
  });

  const config = testConfig({
    simulations: 30,
    roundLimit: 120,
    strategies: STRATEGY_IDS.map((id) => ({ id, version: STRATEGIES[id].version })),
    targetMode: 'compare_all',
  });
  const plan = createSimulationPlan(config);
  const all = Array.from({ length: config.simulations }, (_, index) => runSimulation(plan, index));
  const finished = [0, 3, 4, 9, 17, 29];
  const results = new ExperimentResults(config);
  for (const index of [17, 3, 29, 0, 9, 4]) results.add(all[index] ?? []);
  const partial: ExportMeta = {
    ...meta,
    experimentSeed: config.experimentSeed,
    runStatus: 'cancelled',
  };
  const blocks = [...simulationCsvBlocks(results, partial, 7)];
  const [header, ...rows] = parse(blocks.join(''));

  it('covers every finished simulation, ordered by id then configuration order', () => {
    expect(rows).toHaveLength(simulationCsvRowCount(results));
    expect(rows.map((row) => [row[2], row[4]])).toEqual(
      finished.flatMap((simulation) => STRATEGY_IDS.map((id) => [String(simulation), id])),
    );
  });

  it('labels a partial run on every row', () => {
    expect(new Set(rows.map((row) => row[1]))).toEqual(new Set(['cancelled']));
  });

  it('writes each row from the simulation result, with blanks for targets not reached', () => {
    const at = (name: string) => header?.indexOf(name) ?? -1;
    for (const row of rows) {
      const result = all[Number(row[2])]?.find((entry) => entry.strategyId === row[4]);
      if (result === undefined) throw new Error('missing result');
      const units = (cents: number) => (cents / 100).toFixed(2);
      expect(row[at('simulation_seed')]).toBe(
        String(simulationSeed(config.experimentSeed, result.simulationId)),
      );
      expect(row[at('strategy_version')]).toBe(result.strategyVersion);
      expect(row[at('rounds_played')]).toBe(String(result.roundsPlayed));
      expect(row[at('final_bankroll')]).toBe(units(result.finalBankroll));
      expect(row[at('net_profit')]).toBe(units(result.netProfit));
      expect(row[at('total_wagered')]).toBe(units(result.totalWagered));
      expect(row[at('max_wager')]).toBe(units(result.maxWager));
      expect(row[at('max_drawdown')]).toBe(units(result.maxDrawdown));
      for (const target of ['0_5x', '1x', '2x', '2_5x'] as const) {
        const round = result.firstCrossing[target];
        expect(row[at(`first_cross_${target}`)]).toBe(round === null ? '' : String(round));
      }
      expect(row[at('stop_reason')]).toBe(result.stopReason);
      expect(row[at('unavailable_actions')]).toBe(String(result.unavailableActionCount));
      expect(row[at('minimum_overshoot_count')]).toBe(String(result.minimumOvershootCount));
    }
  });

  it('splits rows into blocks of whole simulations', () => {
    expect(blocks[0]).toBe(csvRow(SIMULATION_COLUMNS));
    // 5 strategies per simulation; a block closes once it holds 7 or more rows.
    expect(blocks.slice(1).map((block) => block.split(CSV_LINE_END).length - 1)).toEqual([
      10, 10, 10,
    ]);
  });

  it('estimates the size close to the real file', () => {
    const actual = blocks.join('').length;
    const estimate = estimateSimulationCsvBytes(results, partial);
    expect(Math.abs(estimate - actual) / actual).toBeLessThan(0.1);
  });

  it('collects blocks with a pause between them and can be stopped', async () => {
    let pauses = 0;
    const pause = () => {
      pauses += 1;
      return Promise.resolve();
    };
    const parts = await collectBlocks(simulationCsvBlocks(results, partial, 7), { pause });
    expect(parts?.join('')).toBe(blocks.join(''));
    expect(pauses).toBe(blocks.length);
    const stopped = await collectBlocks(simulationCsvBlocks(results, partial, 7), {
      pause,
      shouldStop: () => pauses > blocks.length,
    });
    expect(stopped).toBeNull();
  });
});
