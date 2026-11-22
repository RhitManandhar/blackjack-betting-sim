# src/workers and the run controller — guidance

Loaded by Claude Code when working in this folder. The root `CLAUDE.md` rules still apply.

- `simulation.worker.ts` is a thin wrapper around `workerMessageHandler.ts`, which validates messages and drives `chunkRunner.ts`. Neither has worker globals, so Node tests and the Node benchmark worker (`scripts/perf/nodeWorker.ts`) run the same code. The worker is type-checked by `tsconfig.worker.json` (WebWorker lib, no DOM).
- `messages.ts` is the only message contract. Both directions are validated with Zod on arrival. Never add a per-round or per-card message. Workers send throttled progress (`PROGRESS_INTERVAL_MS`) and whole chunk results only.
- Every message carries the run id. The controller (`src/features/experiment/run/RunController.ts`) ignores anything from an older or cancelled run, and each pool slot remembers which run its chunk belongs to.
- A chunk is a range of simulation indices with no seed of its own. Chunk size and worker count must never change results: `RunController.test.ts` checks 1, 2 and 4 workers with several chunk sizes. The controller cuts chunks as workers become free, sized from the `computeMs` each chunk result reports (simulation time without table preparation) and capped at an even share of what is left (spec 2.9). A retried chunk keeps its exact range.
- Chunks are applied whole or not at all. `ExperimentResults` throws on a duplicate simulation, so a retried chunk can never be double counted.
- Stop All discards chunks still running and kills workers still busy after `CANCEL_BACKSTOP_MS`. A chunk that fails three times stops the run as `failed` (spec 10.4, v2.5).
- Controller tests use in-process fake workers that run the real `ChunkRunner` and pass messages through the real schemas. Behaviour in a real browser (responsiveness, Stop All timing, real worker counts) is checked by hand until Playwright arrives.
