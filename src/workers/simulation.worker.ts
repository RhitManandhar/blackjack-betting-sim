import { ChunkRunner } from './chunkRunner';
import { type FromWorkerMessage, toWorkerMessageSchema } from './messages';

// Simulation worker entry point. A chunk runs synchronously (about 100-200 ms), so a cancel
// message is handled between chunks; the controller discards results from a cancelled run and,
// as a backstop, terminates any worker still busy (plan section 9).

const runner = new ChunkRunner();

function send(message: FromWorkerMessage): void {
  postMessage(message);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

addEventListener('message', (event: MessageEvent<unknown>) => {
  const parsed = toWorkerMessageSchema.safeParse(event.data);
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
      () => performance.now(),
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
});
