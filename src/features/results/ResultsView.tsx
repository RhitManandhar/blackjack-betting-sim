import { useState } from 'react';
import type { ExperimentConfig } from '../../shared/schema';
import type { StrategyId } from '../../shared/strategies';
import { targetAmount } from '../../shared/targets';
import type { RunSnapshot } from '../experiment/run/RunController';
import { ComparisonGrid } from './ComparisonGrid';
import { ComparisonTable } from './ComparisonTable';
import { DashboardCharts } from './DashboardCharts';
import { LivePanel } from './LivePanel';
import { RankingsPanel } from './RankingsPanel';
import { count } from './resultsData';
import { SampleSimulations } from './SampleSimulations';
import { SummaryCards } from './SummaryCards';

// Live screen (plan 8.2) while running, final dashboard (plan 8.3) once the run ends. Loaded
// lazily with ECharts so the setup screen stays light.

function targetBankrollFor(config: ExperimentConfig): number | null {
  if (config.targetMode === 'none') return null;
  const target = config.targetMode === 'single' ? config.singleTarget : '2_5x';
  return target === null
    ? null
    : config.startingBankroll + targetAmount(config.startingBankroll, target);
}

const STATUS_NOTE = {
  complete: '',
  cancelled: 'Partial results: the run was stopped. Figures cover finished simulations only.',
  failed: 'Partial results: the run failed. Figures cover finished simulations only.',
} as const;

interface ResultsViewProps {
  readonly snapshot: RunSnapshot;
  readonly config: ExperimentConfig;
}

export function ResultsView({ snapshot, config }: ResultsViewProps) {
  const [sampleStrategy, setSampleStrategy] = useState<StrategyId>(
    config.strategies[0]?.id ?? 'flat',
  );
  const running = snapshot.status === 'running';
  const summary = snapshot.summary;
  const grid = (
    <ComparisonGrid
      displayed={snapshot.displayed}
      startingBankroll={config.startingBankroll}
      targetBankroll={targetBankrollFor(config)}
      runEnded={!running}
    />
  );

  if (running || summary === null) {
    return (
      <div className="space-y-4">
        <LivePanel results={snapshot.results} completed={snapshot.completedSimulations} />
        {grid}
      </div>
    );
  }

  if (summary.completedSimulations === 0) {
    return <p className="text-sm">No simulation finished, so there are no results to show.</p>;
  }

  const smallSample = summary.strategies.some((strategy) => strategy.smallSample);
  return (
    <div className="space-y-4">
      <section aria-label="Results overview">
        <h2 className="text-lg font-semibold">
          Results{snapshot.status === 'complete' ? '' : ' (partial)'}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {count.format(summary.completedSimulations)} of {count.format(snapshot.totalSimulations)}{' '}
          simulations, seed {config.experimentSeed}. {STATUS_NOTE[snapshot.status]} Compare return
          per unit wagered as well as profit: profit in currency mostly follows how much a system
          wagers.
        </p>
        {smallSample && (
          <p role="note" className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            Fewer than 100 simulations: treat these figures as rough.
          </p>
        )}
      </section>
      <SummaryCards strategies={summary.strategies} />
      <RankingsPanel
        strategies={summary.strategies}
        checkpointRounds={config.checkpoints}
        defaultTarget={config.singleTarget ?? '1x'}
      />
      <section
        aria-label="Comparison table"
        className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="text-base font-semibold">Comparison under this configuration</h2>
        <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
          Smaller figures under a value are its 95% interval.
        </p>
        <ComparisonTable
          strategies={summary.strategies}
          onShowSamples={(strategyId) => {
            setSampleStrategy(strategyId);
            document.getElementById('sample-simulations')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
      </section>
      <DashboardCharts
        strategies={summary.strategies}
        upsideTruncated={config.targetMode !== 'none'}
      />
      {grid}
      <SampleSimulations
        results={snapshot.results}
        experimentSeed={config.experimentSeed}
        strategyId={sampleStrategy}
        onStrategyChange={setSampleStrategy}
      />
    </div>
  );
}
