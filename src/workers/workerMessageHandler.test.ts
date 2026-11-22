import { describe, expect, it } from 'vitest';
import { testConfig } from '../engine/simulation/__tests__/scripted';
import { createSimulationPlan } from '../engine/simulation/plan';
import { runSimulation } from '../engine/simulation/runSimulation';
import { type FromWorkerMessage, fromWorkerMessageSchema } from './messages';
import { createWorkerMessageHandler } from './workerMessageHandler';

const config = testConfig({ simulations: 6, roundLimit: 60 });

function harness() {
  const sent: FromWorkerMessage[] = [];
  const handle = createWorkerMessageHandler(
    (message) => {
      sent.push(fromWorkerMessageSchema.parse(structuredClone(message)));
    },
    () => 0,
  );
  return { sent, handle };
}

describe('worker message handler (shared by the browser and Node workers)', () => {
  it('answers a start-chunk message with the chunk result runSimulation gives', () => {
    const { sent, handle } = harness();
    handle({
      type: 'start-chunk',
      runId: 'run-1',
      chunkId: 3,
      config,
      firstSimulation: 2,
      simulationCount: 3,
    });
    const result = sent.at(-1);
    expect(result?.type).toBe('chunk-result');
    if (result?.type !== 'chunk-result') return;
    const plan = createSimulationPlan(config);
    expect(result.simulations).toEqual(
      [2, 3, 4].map((index) => JSON.parse(JSON.stringify(runSimulation(plan, index))) as unknown),
    );
  });

  it('reports a malformed message as an error and ignores a cancel', () => {
    const { sent, handle } = harness();
    handle({ type: 'nonsense' });
    handle({ type: 'cancel', runId: 'run-1' });
    expect(sent).toEqual([
      { type: 'error', runId: '', chunkId: null, message: 'Invalid message sent to worker' },
    ]);
  });
});
