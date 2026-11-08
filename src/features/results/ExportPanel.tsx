import { useRef, useState } from 'react';
import type { ExperimentSummary } from '../../engine/statistics/summary';
import type { ExperimentConfig } from '../../shared/schema';
import { configFileName, configToJson } from '../experiment/configFile';
import { downloadParts, downloadText } from '../experiment/download';
import type { RunSnapshot } from '../experiment/run/RunController';
import { exportFileName, exportMeta } from './export/exportMeta';
import {
  LARGE_EXPORT_BYTES,
  collectBlocks,
  estimateSimulationCsvBytes,
  simulationCsvBlocks,
  simulationCsvRowCount,
} from './export/simulationCsv';
import { summaryCsv } from './export/summaryCsv';
import { count } from './resultsData';
import type { EndedStatus } from './resultsText';

// Downloads (plan 8.4, spec 10.5–10.8): summary CSV, per-simulation CSV (built in blocks, with a
// size warning), the standalone HTML report and the configuration JSON. The report code and the
// inlined ECharts build load only when a report is requested.

const CSV_TYPE = 'text/csv;charset=utf-8';

const megabytes = (bytes: number): string =>
  `${(bytes / (1024 * 1024)).toLocaleString('en-AU', { maximumFractionDigits: 1 })} MB`;

const BUTTON =
  'rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-slate-700';

interface ExportPanelProps {
  readonly config: ExperimentConfig;
  readonly snapshot: RunSnapshot;
  readonly status: EndedStatus;
  readonly summary: ExperimentSummary;
}

type Busy = null | 'simulations' | 'report';

export function ExportPanel({ config, snapshot, status, summary }: ExportPanelProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [confirmLarge, setConfirmLarge] = useState(false);
  const cancelRef = useRef(false);
  const meta = exportMeta(config, status);
  const rows = simulationCsvRowCount(snapshot.results);
  const estimate = estimateSimulationCsvBytes(snapshot.results, meta);
  const partial = status !== 'complete';

  const fail = (error: unknown) => {
    setMessage({
      text: `Export failed: ${error instanceof Error ? error.message : String(error)}`,
      error: true,
    });
  };

  const downloadSummary = () => {
    downloadText(
      exportFileName(config.experimentId, 'summary', 'csv'),
      summaryCsv(meta, summary.strategies),
      CSV_TYPE,
    );
    setMessage({ text: 'Summary CSV saved.', error: false });
  };

  const downloadSimulations = async () => {
    setConfirmLarge(false);
    setBusy('simulations');
    cancelRef.current = false;
    try {
      const totalBlocks = Math.ceil(rows / 2000) + 1;
      const parts = await collectBlocks(simulationCsvBlocks(snapshot.results, meta), {
        shouldStop: () => cancelRef.current,
        onProgress: (done) => {
          setMessage({
            text: `Building per-simulation CSV… ${String(Math.min(100, Math.round((done / totalBlocks) * 100)))}%`,
            error: false,
          });
        },
      });
      if (parts === null) {
        setMessage({ text: 'Per-simulation CSV cancelled.', error: false });
        return;
      }
      downloadParts(exportFileName(config.experimentId, 'simulations', 'csv'), parts, CSV_TYPE);
      setMessage({ text: `Per-simulation CSV saved (${count.format(rows)} rows).`, error: false });
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  };

  const downloadReport = async () => {
    setBusy('report');
    setMessage({ text: 'Building the HTML report…', error: false });
    try {
      const [{ buildHtmlReport }, { loadEchartsSource }] = await Promise.all([
        import('./export/htmlReport'),
        import('./export/echartsSource'),
      ]);
      const html = buildHtmlReport(
        {
          config,
          status,
          totalSimulations: snapshot.totalSimulations,
          summary,
          results: snapshot.results,
          displayed: snapshot.displayed,
          error: snapshot.error,
          generatedAt: new Date().toLocaleString('en-AU'),
        },
        await loadEchartsSource(),
      );
      downloadText(
        exportFileName(config.experimentId, 'report', 'html'),
        html,
        'text/html;charset=utf-8',
      );
      setMessage({
        text: `HTML report saved (${megabytes(html.length)}). It opens offline.`,
        error: false,
      });
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      aria-label="Downloads"
      className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 className="text-base font-semibold">Downloads</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {partial
          ? 'This run is partial: every file is marked partial and covers finished simulations only.'
          : 'Every file covers all finished simulations and records the seed, so the run can be repeated.'}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className={BUTTON} disabled={busy !== null} onClick={downloadSummary}>
          Summary (CSV)
        </button>
        <button
          type="button"
          className={BUTTON}
          disabled={busy !== null}
          onClick={() => {
            if (estimate > LARGE_EXPORT_BYTES) setConfirmLarge(true);
            else void downloadSimulations();
          }}
        >
          Per simulation (CSV, about {megabytes(estimate)})
        </button>
        <button
          type="button"
          className={BUTTON}
          disabled={busy !== null}
          onClick={() => {
            void downloadReport();
          }}
        >
          HTML report
        </button>
        <button
          type="button"
          className={BUTTON}
          disabled={busy !== null}
          onClick={() => {
            downloadText(configFileName(config), configToJson(config), 'application/json');
          }}
        >
          Settings (JSON)
        </button>
        {busy === 'simulations' && (
          <button
            type="button"
            className={BUTTON}
            onClick={() => {
              cancelRef.current = true;
            }}
          >
            Cancel export
          </button>
        )}
      </div>
      {confirmLarge && (
        <div
          role="alertdialog"
          aria-label="Large file"
          className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          <p>
            The per-simulation CSV will be about {megabytes(estimate)} ({count.format(rows)} rows).
            It is built in steps so the page stays responsive, but it may take a moment.
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" className={BUTTON} onClick={() => void downloadSimulations()}>
              Build it anyway
            </button>
            <button
              type="button"
              className={BUTTON}
              onClick={() => {
                setConfirmLarge(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <p
        aria-live="polite"
        className={`mt-2 text-sm ${message?.error === true ? 'text-red-700 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}
      >
        {message?.text ?? ''}
      </p>
    </section>
  );
}
