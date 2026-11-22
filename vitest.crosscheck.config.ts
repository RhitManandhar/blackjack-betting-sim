import { defineConfig } from 'vitest/config';

// Independent cross-checks (plan Phase 9, task 4). Long-running; run with
// `npm run bench:crosscheck`, never in CI. One file per check so they run in parallel.
export default defineConfig({
  test: {
    include: ['scripts/cross-check/*.check.ts'],
    environment: 'node',
    silent: false,
    testTimeout: 3_600_000,
  },
});
