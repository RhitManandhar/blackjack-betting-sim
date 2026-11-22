import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { createDefaultConfig } from '../../shared/defaults';
import type { ExperimentConfig } from '../../shared/schema';
import { createExperimentIdentity } from './createExperimentIdentity';
import { browserWorkerFactory, logicalCores } from './run/browserWorker';
import { ConfigFileControls } from './ConfigFileControls';
import { RecentExperimentsPanel } from './RecentExperimentsPanel';
import {
  type RecentExperiment,
  browserStorage,
  clearRecent,
  digestOf,
  loadRecent,
  saveRecent,
} from './recentExperiments';
import { loadRoundCost, saveRoundCost } from './roundCost';
import { RunController, type RunSnapshot } from './run/RunController';
import { estimateRuntimeSeconds, resolveWorkerCount } from './run/runPlanning';
import { RulesForm } from './RulesForm';
import { RunProgress } from './RunProgress';
import { buildConfig, draftFromConfig } from './runFormConfig';
import { SettingRow, SettingsSection } from './SettingsSection';
import {
  BankrollSection,
  CheckpointsSection,
  SimulationSizeSection,
  StopConditionsSection,
  StrategiesSection,
} from './SetupSections';
import { estimateWork } from './workEstimate';

// Setup screen (plan 8.1), run controls, the live screen (8.2) and the final dashboard (8.3).
// Exports are on the final dashboard (Phase 8c).

const numberFormat = new Intl.NumberFormat('en-AU');

// ECharts is most of the page weight, so the results view loads only once a run starts.
const ResultsView = lazy(async () => {
  const module = await import('../results/ResultsView');
  return { default: module.ResultsView };
});

/** "45 s" or "3 min 20 s": an upper bound, rounded up. */
function formatDuration(seconds: number): string {
  const whole = Math.ceil(seconds);
  return whole < 60
    ? `${String(whole)} s`
    : `${String(Math.floor(whole / 60))} min ${String(whole % 60)} s`;
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
  const [recent, setRecent] = useState<RecentExperiment[]>(() => loadRecent(browserStorage()));
  const savedRuns = useRef(new Set<string>());
  const [roundCost, setRoundCost] = useState(() => loadRoundCost(browserStorage()));

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

  // Save each finished run's digest once (plan 8.4).
  useEffect(() => {
    if (snapshot === null || runConfig === null || snapshot.status === 'running') return;
    if (snapshot.summary === null || savedRuns.current.has(snapshot.runId)) return;
    savedRuns.current.add(snapshot.runId);
    setRoundCost(
      saveRoundCost(browserStorage(), snapshot.measuredRoundMicroseconds, snapshot.roundsPlayed),
    );
    const entry = digestOf(
      runConfig,
      snapshot.status,
      snapshot.completedSimulations,
      snapshot.summary.strategies,
      Date.now(),
    );
    setRecent(saveRecent(browserStorage(), entry));
  }, [snapshot, runConfig]);

  const built = useMemo(() => buildConfig(draft, base), [draft, base]);
  const errors = built.ok ? {} : built.errors;
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
      <div className="grid gap-4 lg:grid-cols-2">
        <SimulationSizeSection
          draft={draft}
          errors={errors}
          onChange={setDraft}
          autoWorkers={autoWorkers}
          onNewSeed={() => {
            setDraft({ ...draft, seed: String(createExperimentIdentity().experimentSeed) });
          }}
        />
        <BankrollSection draft={draft} errors={errors} onChange={setDraft} />
        <StopConditionsSection draft={draft} errors={errors} onChange={setDraft} />
        <StrategiesSection draft={draft} errors={errors} onChange={setDraft} />
        <CheckpointsSection draft={draft} errors={errors} onChange={setDraft} />
        <RulesForm
          rules={draft.rules}
          disabled={running}
          onChange={(rules) => {
            setDraft({ ...draft, rules });
          }}
        />
      </div>

      <SettingsSection title="Pre-run summary">
        {built.ok ? (
          <>
            <dl>
              <SettingRow
                label="Total work (simulations × strategies × rounds, upper bound)"
                value={`${numberFormat.format(estimateWork(built.config).totalRounds)} rounds`}
              />
              <SettingRow
                label={
                  roundCost === null
                    ? 'Estimated time (upper bound, cautious default speed)'
                    : 'Estimated time (upper bound, speed measured on this device)'
                }
                value={`up to about ${formatDuration(estimateRuntimeSeconds(built.config, workers, roundCost ?? undefined))} on ${String(workers)} worker(s)`}
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
        <div className="mt-4">
          <ConfigFileControls
            config={built.ok ? built.config : null}
            disabled={running}
            onImport={(config) => {
              setDraft(draftFromConfig(config));
            }}
          />
        </div>
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
            fallback={<p className="text-sm text-slate-500 dark:text-slate-400">Loading charts…</p>}
          >
            <ResultsView snapshot={snapshot} config={runConfig} />
          </Suspense>
        </>
      )}

      <RecentExperimentsPanel
        entries={recent}
        disabled={running}
        onReuse={(config) => {
          setDraft(draftFromConfig(config));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onClear={() => {
          clearRecent(browserStorage());
          setRecent([]);
        }}
      />
    </div>
  );
}
