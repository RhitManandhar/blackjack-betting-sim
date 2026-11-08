import { createWorkerMessageHandler } from './workerMessageHandler';

// Simulation worker entry point (browser). All logic is in `workerMessageHandler.ts`.

const handle = createWorkerMessageHandler(
  (message) => {
    postMessage(message);
  },
  () => performance.now(),
);

addEventListener('message', (event: MessageEvent<unknown>) => {
  handle(event.data);
});
