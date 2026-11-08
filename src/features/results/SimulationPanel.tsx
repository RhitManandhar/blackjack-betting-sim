import { useMemo } from 'react';
import type { StrategySimulationResult } from '../../engine/simulation/runSimulation';
import { simulationPanelOption } from './charts/panelChart';
import { EChart } from './EChart';
import { usePrefersDark } from './usePrefersDark';

// One comparison panel (spec 10.9). Filled only once its simulation has finished; never drawn
// from partial data and never animated round by round.

interface SimulationPanelProps {
  readonly simulationNumber: number;
  readonly results: readonly StrategySimulationResult[] | null;
  readonly startingBankroll: number;
  readonly targetBankroll: number | null;
  readonly runEnded: boolean;
  readonly compact: boolean;
}

export function SimulationPanel({
  simulationNumber,
  results,
  startingBankroll,
  targetBankroll,
  runEnded,
  compact,
}: SimulationPanelProps) {
  const dark = usePrefersDark();
  const option = useMemo(
    () =>
      results === null
        ? null
        : simulationPanelOption(results, { dark, startingBankroll, targetBankroll, compact }),
    [results, dark, startingBankroll, targetBankroll, compact],
  );
  const height = compact ? 180 : 420;
  if (option === null) {
    return (
      <p
        className="flex items-center justify-center text-sm text-slate-500 dark:text-slate-400"
        style={{ height }}
      >
        {runEnded ? 'Not finished (run stopped)' : 'Running…'}
      </p>
    );
  }
  return (
    <EChart
      option={option}
      height={height}
      ariaLabel={`Bankroll by round for each strategy in simulation ${String(simulationNumber)}`}
    />
  );
}
