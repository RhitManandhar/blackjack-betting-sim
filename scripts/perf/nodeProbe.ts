import { monitorEventLoopDelay } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
import type { Probe } from '../../src/features/benchmark/benchmark';
import type { WorkerFactory } from '../../src/features/experiment/run/RunController';
import { NODE_WORKER_FILE } from './vite.worker.config';

// Node versions of the benchmark's platform pieces: worker threads in place of Web Workers,
// event-loop delay in place of frame gaps, and heap use in place of browser memory.

export const nodeWorkerFactory: WorkerFactory = (handlers) => {
  const worker = new Worker(NODE_WORKER_FILE);
  worker.on('message', (data: unknown) => {
    handlers.onMessage(data);
  });
  worker.on('error', (error: unknown) => {
    handlers.onError(error instanceof Error ? error.message : String(error));
  });
  return {
    send: (message) => {
      worker.postMessage(message);
    },
    terminate: () => {
      void worker.terminate();
    },
  };
};

const MB = 1024 * 1024;

export function nodeProbe(): Probe {
  const delay = monitorEventLoopDelay({ resolution: 10 });
  let peak = 0;
  return {
    start() {
      delay.reset();
      delay.enable();
      peak = process.memoryUsage().heapUsed;
    },
    sample() {
      peak = Math.max(peak, process.memoryUsage().heapUsed);
    },
    stop() {
      delay.disable();
      return { mainThreadMaxGapMs: delay.max / 1e6, peakMemoryMb: peak / MB };
    },
  };
}
