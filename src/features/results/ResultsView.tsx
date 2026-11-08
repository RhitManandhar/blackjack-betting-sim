import { useState } from 'react';
import type { ExperimentConfig } from '../../shared/schema';
import type { StrategyId } from '../../shared/strategies';
import type { RunSnapshot } from '../experiment/run/RunController';
import { ComparisonGrid } from './ComparisonGrid';
import { ComparisonTable } from './ComparisonTable';
import { DashboardCharts } from './DashboardCharts';
import { ExportPanel } from './ExportPanel';
import { LivePanel } from './LivePanel';
import { RankingsPanel } from './RankingsPanel';
import { RETURN_NOTE, SMALL_SAMPLE_NOTE, STATUS_NOTE, targetBankrollFor } from './resultsText';
import { count } from './resultsData';
import { SampleSimulations } from './SampleSimulations';
import { SummaryCards } from './SummaryCards';

// Live screen (plan 8.2) while running, final dashboard (plan 8.3) once the run ends. Loaded
// lazily with ECharts so the setup screen stays light.

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

  const status = snapshot.status;
  if (status === 'running' || summary === null) {
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
          Results{status === 'complete' ? '' : ' (partial)'}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {count.format(summary.completedSimulations)} of {count.format(snapshot.totalSimulations)}{' '}
          simulations, seed {config.experimentSeed}. {STATUS_NOTE[status]} {RETURN_NOTE}
        </p>
        {smallSample && (
          <p role="note" className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            {SMALL_SAMPLE_NOTE}
          </p>
        )}
      </section>
      <ExportPanel config={config} snapshot={snapshot} status={status} summary={summary} />
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
