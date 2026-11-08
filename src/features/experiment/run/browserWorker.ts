import type { WorkerFactory } from './RunController';

// The real worker factory. Vite bundles the worker from this URL (plan section 9).
// Kept apart from RunController so Node tests never touch the Worker API.

export const browserWorkerFactory: WorkerFactory = (handlers) => {
  const worker = new Worker(new URL('../../../workers/simulation.worker.ts', import.meta.url), {
    type: 'module',
    name: 'simulation',
  });
  worker.addEventListener('message', (event: MessageEvent<unknown>) => {
    handlers.onMessage(event.data);
  });
  worker.addEventListener('error', (event) => {
    event.preventDefault();
    handlers.onError(event.message || 'The simulation worker stopped unexpectedly');
  });
  worker.addEventListener('messageerror', () => {
    handlers.onError('A worker message could not be read');
  });
  return {
    send: (message) => {
      worker.postMessage(message);
    },
    terminate: () => {
      worker.terminate();
    },
  };
};

export function logicalCores(): number {
  return typeof navigator === 'undefined' ? 1 : navigator.hardwareConcurrency;
}
