import { SPEC_VERSION } from '../../shared/constants';
import { type ExperimentConfig, experimentConfigSchema } from '../../shared/schema';

// JSON configuration download and import (spec 10.8): importing a downloaded file and running
// again reproduces the run exactly. Imported files are external input, so they are validated
// with the shared Zod schema before anything uses them.

export type ConfigImportResult =
  | { readonly ok: true; readonly config: ExperimentConfig }
  | { readonly ok: false; readonly error: string };

export function configFileName(config: ExperimentConfig): string {
  return `blackjack-experiment-seed-${String(config.experimentSeed)}.json`;
}

export function configToJson(config: ExperimentConfig): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function parseConfigJson(text: string): ConfigImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (typeof data === 'object' && data !== null && 'specVersion' in data) {
    const version = data.specVersion;
    if (version !== SPEC_VERSION) {
      return {
        ok: false,
        error: `This file was made for spec version ${String(version)}; this app runs spec ${SPEC_VERSION}, so the run would not be reproduced exactly.`,
      };
    }
  }
  const parsed = experimentConfigSchema.safeParse(data);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join('.') || 'file'}: ${issue.message}`);
    return {
      ok: false,
      error: `This is not a valid experiment configuration. ${problems.join('; ')}`,
    };
  }
  return { ok: true, config: parsed.data };
}
