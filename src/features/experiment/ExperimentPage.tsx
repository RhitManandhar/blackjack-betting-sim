import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { createDefaultConfig } from '../../shared/defaults';
import type { ExperimentConfig } from '../../shared/schema';
import { targetAmount } from '../../shared/targets';
import { ResultsTable } from '../results/ResultsTable';
import { createExperimentIdentity } from './createExperimentIdentity';
import { browserWorkerFactory, logicalCores } from './run/browserWorker';
import { RunController, type RunSnapshot } from './run/RunController';
import { estimateRuntimeSeconds, resolveWorkerCount } from './run/runPlanning';
import { RunForm } from './RunForm';
import { RunProgress } from './RunProgress';
import { buildConfig, draftFromConfig } from './runFormConfig';
import { SettingRow, SettingsSection } from './SettingsSection';
import { SettingsOverview } from './SettingsOverview';
import { estimateWork } from './workEstimate';

// Phase 6 end-to-end slice: a few inputs, Run, live progress with Stop All, one chart
// (simulation 1's comparison panel) and a results table.

const numberFormat = new Intl.NumberFormat('en-AU');

// ECharts is most of the page weight, so the chart loads only once a run starts.
const SimulationPanel = lazy(async () => {
  const module = await import('../results/SimulationPanel');
  return { default: module.SimulationPanel };
});

function targetBankrollFor(config: ExperimentConfig): number | null {
  if (config.targetMode === 'none') return null;
  const target = config.targetMode === 'single' ? config.singleTarget : '2_5x';
  return target === null
    ? null
    : config.startingBankroll + targetAmount(config.startingBankroll, target);
}

export function ExperimentPage() {
  const [base] = useState(() => {
    const { experimentId, experimentSeed } = createExperimentIdentity();
    return createDefaultConfig(experimentId, experimentSeed);
  });
  const [draft, setDraft] = useState(() => draftFromConfig(base));
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(null);
  const [runConfig, setRunConfig] = useState<ExperimentConfig | null>(null);
  const controllerRef = useRef<RunController | null>(null);

  useEffect(() => {
    const controller = new RunController({
      createWorker: browserWorkerFactory,
      onSnapshot: setSnapshot,
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  const built = useMemo(() => buildConfig(draft, base), [draft, base]);
  const running = snapshot?.status === 'running';
  const workers = resolveWorkerCount(draft.workerCount, logicalCores());
  const autoWorkers = resolveWorkerCount('auto', logicalCores());

  const start = () => {
    const controller = controllerRef.current;
    if (!built.ok || controller === null || running) return;
    const config = { ...built.config, experimentId: createExperimentIdentity().experimentId };
    setRunConfig(config);
    controller.start(config, workers);
  };

  return (
    <div className="space-y-4">
      <RunForm
        draft={draft}
        errors={built.ok ? {} : built.errors}
        disabled={running}
        autoWorkers={autoWorkers}
        onChange={setDraft}
        onNewSeed={() => {
          setDraft({ ...draft, seed: String(createExperimentIdentity().experimentSeed) });
        }}
      />

      <SettingsSection title="Pre-run summary">
        {built.ok ? (
          <>
            <dl>
              <SettingRow
                label="Total work (simulations × strategies × rounds, upper bound)"
                value={`${numberFormat.format(estimateWork(built.config).totalRounds)} rounds`}
              />
              <SettingRow
                label="Estimated time (upper bound)"
                value={`up to about ${String(Math.ceil(estimateRuntimeSeconds(built.config, workers)))} s on ${String(workers)} worker(s)`}
              />
            </dl>
            {estimateWork(built.config).isOverBudget && (
              <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">
                This run is over the recommended work budget of{' '}
                {numberFormat.format(estimateWork(built.config).budget)} rounds and may take a long
                time.
              </p>
            )}
            {built.notes.map((note) => (
              <p key={note} className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {note}
              </p>
            ))}
          </>
        ) : (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {built.errors.form ?? 'Fix the highlighted settings to run.'}
          </p>
        )}
        <button
          type="button"
          onClick={start}
          disabled={!built.ok || running}
          className="mt-4 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? 'Running…' : 'Run simulations'}
        </button>
      </SettingsSection>

      {snapshot !== null && runConfig !== null && (
        <>
          <RunProgress
            snapshot={snapshot}
            onStop={() => {
              controllerRef.current?.stop();
            }}
          />
          <Suspense
            fallback={<p className="text-sm text-slate-500 dark:text-slate-400">Loading chart…</p>}
          >
            <SimulationPanel
              simulationNumber={1}
              results={snapshot.displayed[0] ?? null}
              startingBankroll={runConfig.startingBankroll}
              targetBankroll={targetBankrollFor(runConfig)}
              runEnded={!running}
            />
          </Suspense>
          {snapshot.summary !== null && (
            <ResultsTable
              summary={snapshot.summary}
              status={snapshot.status}
              totalSimulations={snapshot.totalSimulations}
            />
          )}
        </>
      )}

      <SettingsOverview config={built.ok ? built.config : base} />
    </div>
  );
}
