import { useMemo } from 'react';
import type { StrategySimulationResult } from '../../engine/simulation/runSimulation';
import { formatCentsGrouped } from '../../shared/money';
import type { StopReason } from '../../shared/stopReasons';
import { STRATEGIES } from '../../shared/strategies';
import { EChart } from './EChart';
import { usePrefersDark } from './usePrefersDark';
import { chartInk, strategyColor } from './strategyColors';

// One comparison panel (spec 10.9): every chosen strategy's bankroll in one simulation, on the
// same cards. Lines end where a strategy stopped, labelled with the stop reason; stopped
// strategies are not carried forward here. Filled only once the simulation has finished.

const STOP_LABELS: Record<StopReason, string> = {
  target_reached: 'target reached',
  bust: 'bust',
  blocked_table_max: 'blocked by table max',
  round_limit: 'round limit',
};

/** Currency units for display only; the data stays in integer cents. */
const toUnits = (cents: number) => cents / 100;

interface SimulationPanelProps {
  readonly simulationNumber: number;
  readonly results: readonly StrategySimulationResult[] | null;
  readonly startingBankroll: number;
  readonly targetBankroll: number | null;
  readonly runEnded: boolean;
}

export function SimulationPanel({
  simulationNumber,
  results,
  startingBankroll,
  targetBankroll,
  runEnded,
}: SimulationPanelProps) {
  const dark = usePrefersDark();
  const option = useMemo(() => {
    if (results === null) return null;
    const ink = chartInk(dark);
    const referenceLines = [
      { yAxis: toUnits(startingBankroll), name: 'Starting bankroll' },
      ...(targetBankroll === null ? [] : [{ yAxis: toUnits(targetBankroll), name: 'Target' }]),
    ];
    return {
      animation: false,
      textStyle: { color: ink.text },
      grid: { left: 64, right: 120, top: 40, bottom: 56 },
      legend: { top: 0, textStyle: { color: ink.text } },
      tooltip: {
        trigger: 'item',
        // Each point is [round, bankroll in units (plotted), bet in cents, bankroll in cents].
        formatter: (params: { seriesName: string; value: [number, number, number, number] }) => {
          const [round, , bet, bankrollCents] = params.value;
          const betLine = round === 0 ? '' : `<br/>Bet ${formatCentsGrouped(bet)}`;
          return `${params.seriesName}<br/>Round ${String(round)}<br/>Bankroll ${formatCentsGrouped(bankrollCents)}${betLine}`;
        },
      },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }],
      xAxis: {
        type: 'value',
        name: 'Round',
        nameLocation: 'middle',
        nameGap: 28,
        min: 0,
        axisLabel: { color: ink.muted },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: 'Bankroll',
        axisLabel: { color: ink.muted },
        splitLine: { lineStyle: { color: ink.grid } },
      },
      series: results.map((result, index) => {
        const curve = result.curve;
        const points = curve
          ? curve.rounds.map((round, point) => {
              const bankroll = curve.bankrolls[point] ?? 0;
              return [round, toUnits(bankroll), curve.bets[point] ?? 0, bankroll];
            })
          : [];
        return {
          name: STRATEGIES[result.strategyId].name,
          type: 'line',
          showSymbol: false,
          symbolSize: 8,
          lineStyle: { width: 2 },
          color: strategyColor(result.strategyId, dark),
          data: points,
          endLabel: {
            show: true,
            color: ink.text,
            formatter: STOP_LABELS[result.stopReason],
          },
          ...(index === 0
            ? {
                markLine: {
                  silent: true,
                  symbol: 'none',
                  lineStyle: { color: ink.muted, type: 'dashed', width: 1 },
                  label: { color: ink.muted, formatter: '{b}' },
                  data: referenceLines,
                },
              }
            : {}),
        };
      }),
    };
  }, [results, dark, startingBankroll, targetBankroll]);

  return (
    <figure className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <figcaption className="mb-2 text-sm font-medium">
        Simulation {simulationNumber}
        {results?.[0] !== undefined && (
          <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
            seed {results[0].simulationSeed}
          </span>
        )}
      </figcaption>
      {option === null ? (
        <p className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
          {runEnded ? 'Not finished (run stopped)' : 'Running…'}
        </p>
      ) : (
        <EChart
          option={option}
          height={320}
          ariaLabel={`Bankroll by round for each strategy in simulation ${String(simulationNumber)}`}
        />
      )}
    </figure>
  );
}
