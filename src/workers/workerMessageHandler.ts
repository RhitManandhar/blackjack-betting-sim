import { ChunkRunner } from './chunkRunner';
import { type FromWorkerMessage, toWorkerMessageSchema } from './messages';

// The whole of a simulation worker, free of worker globals: the browser entry
// (`simulation.worker.ts`) and the Node benchmark worker (`scripts/perf/nodeWorker.ts`) both wrap
// it, so the benchmark measures exactly the code the browser runs. A chunk runs synchronously
// (about 100-200 ms), so a cancel message is handled between chunks; the controller discards
// results from a cancelled run and, as a backstop, terminates any worker still busy.

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createWorkerMessageHandler(
  send: (message: FromWorkerMessage) => void,
  now: () => number,
): (data: unknown) => void {
  const runner = new ChunkRunner();
  return (data) => {
    const parsed = toWorkerMessageSchema.safeParse(data);
    if (!parsed.success) {
      send({ type: 'error', runId: '', chunkId: null, message: 'Invalid message sent to worker' });
      return;
    }
    const message = parsed.data;
    if (message.type === 'cancel') {
      runner.forget(message.runId);
      return;
    }

    const { runId, chunkId, config, firstSimulation, simulationCount } = message;
    try {
      const outcome = runner.run(
        runId,
        config,
        firstSimulation,
        simulationCount,
        (simulationsDone, roundsDone) => {
          send({ type: 'progress', runId, chunkId, simulationsDone, roundsDone });
        },
        now,
      );
      send({
        type: 'chunk-result',
        runId,
        chunkId,
        simulations: outcome.simulations,
        roundsPlayed: outcome.roundsPlayed,
      });
    } catch (error) {
      send({ type: 'error', runId, chunkId, message: describe(error) });
    }
  };
}
