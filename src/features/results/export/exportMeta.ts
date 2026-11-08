import { SPEC_VERSION } from '../../../shared/constants';
import type { ExperimentConfig } from '../../../shared/schema';
import type { EndedStatus } from '../resultsText';

// Identity columns repeated on every exported row (spec 10.6, 10.7).

export interface ExportMeta {
  readonly experimentId: string;
  readonly experimentSeed: number;
  readonly specVersion: string;
  readonly runStatus: EndedStatus;
  readonly currency: string;
}

export function exportMeta(config: ExperimentConfig, runStatus: EndedStatus): ExportMeta {
  return {
    experimentId: config.experimentId,
    experimentSeed: config.experimentSeed,
    specVersion: SPEC_VERSION,
    runStatus,
    currency: config.currency,
  };
}

/** "bjsim-1a2b3c4d-summary.csv": the first eight characters of the experiment id keep it short. */
export function exportFileName(experimentId: string, kind: string, extension: string): string {
  const id = experimentId.replaceAll(/[^A-Za-z0-9-]/g, '').slice(0, 8) || 'experiment';
  return `bjsim-${id}-${kind}.${extension}`;
}
