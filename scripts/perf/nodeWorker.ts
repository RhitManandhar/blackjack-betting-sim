import { performance } from 'node:perf_hooks';
import { parentPort } from 'node:worker_threads';
import { createWorkerMessageHandler } from '../../src/workers/workerMessageHandler';

// Node worker-thread entry for the performance benchmark: the browser worker's exact handler,
// with Node's message port in place of the worker globals. Built to an .mjs file by
// `vite.worker.config.ts` before the benchmark runs, because worker threads load plain JS.

const port = parentPort;
if (port === null) throw new Error('nodeWorker must run as a worker thread');

const handle = createWorkerMessageHandler(
  (message) => {
    port.postMessage(message);
  },
  () => performance.now(),
);

port.on('message', (data: unknown) => {
  handle(data);
});
