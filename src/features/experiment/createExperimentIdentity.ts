// The only place a seed is created from a cryptographic source (CLAUDE.md, Randomness).
// Runs in the UI layer; the engine only ever receives the resulting number.

export interface ExperimentIdentity {
  readonly experimentId: string;
  readonly experimentSeed: number;
}

export function createExperimentIdentity(): ExperimentIdentity {
  const [seed = 0] = crypto.getRandomValues(new Uint32Array(1));
  return { experimentId: crypto.randomUUID(), experimentSeed: seed };
}
