import { z } from 'zod';
import { LIMITS } from '../shared/constants';
import { experimentConfigSchema } from '../shared/schema';
import { STOP_REASONS } from '../shared/stopReasons';
import { STRATEGY_IDS } from '../shared/strategies';

// Typed message contract between the run controller (main thread) and simulation workers
// (CLAUDE.md, Workers). Both directions are validated with Zod on arrival. Every message
// carries the run id, so anything from a cancelled or older run is ignored.
// Workers never send per-round or per-card messages: only throttled progress and chunk results.

// ---- Main thread -> worker ----

export const startChunkMessageSchema = z.strictObject({
  type: z.literal('start-chunk'),
  runId: z.string().min(1),
  chunkId: z.int().min(0),
  config: experimentConfigSchema,
  firstSimulation: z.int().min(0),
  simulationCount: z.int().min(1),
});

export const cancelMessageSchema = z.strictObject({
  type: z.literal('cancel'),
  runId: z.string().min(1),
});

export const toWorkerMessageSchema = z.discriminatedUnion('type', [
  startChunkMessageSchema,
  cancelMessageSchema,
]);

export type StartChunkMessage = z.infer<typeof startChunkMessageSchema>;
export type ToWorkerMessage = z.infer<typeof toWorkerMessageSchema>;

// ---- Worker -> main thread ----

const count = z.int().min(0);
const cents = z.int();

/** Spec 10.1 per-simulation strategy result, including the display-only curve (10.9). */
export const strategySimulationResultSchema = z
  .strictObject({
    simulationId: count,
    simulationSeed: z.int().min(0).max(LIMITS.maxUint32),
    strategyId: z.enum(STRATEGY_IDS),
    strategyVersion: z.string().min(1),
    roundsPlayed: count,
    startingBankroll: cents,
    finalBankroll: cents,
    netProfit: cents,
    totalWagered: count,
    sumInitialBets: count,
    maxWager: count,
    maxDrawdown: count,
    firstCrossing: z.strictObject({
      '0_5x': count.nullable(),
      '1x': count.nullable(),
      '2x': count.nullable(),
      '2_5x': count.nullable(),
    }),
    stopReason: z.enum(STOP_REASONS),
    requiredBetAtStop: count.nullable(),
    outcomeCounts: z.strictObject({ blackjack: count, win: count, push: count, loss: count }),
    unavailableActionCount: count,
    minimumOvershootCount: count,
    minimumOvershootTotal: count,
    checkpointProfit: z.array(cents).readonly(),
    curve: z
      .strictObject({
        rounds: z.array(count),
        bankrolls: z.array(cents),
        bets: z.array(count),
      })
      .nullable(),
  })
  .refine((result) => result.finalBankroll === result.startingBankroll + result.netProfit, {
    message: 'finalBankroll must equal startingBankroll + netProfit',
  });

export const progressMessageSchema = z.strictObject({
  type: z.literal('progress'),
  runId: z.string().min(1),
  chunkId: count,
  simulationsDone: count,
  roundsDone: count,
});

export const chunkResultMessageSchema = z.strictObject({
  type: z.literal('chunk-result'),
  runId: z.string().min(1),
  chunkId: count,
  /** One entry per simulation, in simulation order; each holds every configured strategy. */
  simulations: z.array(z.array(strategySimulationResultSchema).min(1)),
  roundsPlayed: count,
});

export const errorMessageSchema = z.strictObject({
  type: z.literal('error'),
  runId: z.string(),
  chunkId: count.nullable(),
  message: z.string(),
});

export const fromWorkerMessageSchema = z.discriminatedUnion('type', [
  progressMessageSchema,
  chunkResultMessageSchema,
  errorMessageSchema,
]);

export type ProgressMessage = z.infer<typeof progressMessageSchema>;
export type ChunkResultMessage = z.infer<typeof chunkResultMessageSchema>;
export type ErrorMessage = z.infer<typeof errorMessageSchema>;
export type FromWorkerMessage = z.infer<typeof fromWorkerMessageSchema>;
