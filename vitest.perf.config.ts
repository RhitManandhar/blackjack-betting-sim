import { defineConfig } from 'vitest/config';

// Performance benchmark (plan Phase 9). Long-running; run with `npm run bench:perf`, never in CI.
// One file, run serially, so the workers it starts have the machine to themselves.
export default defineConfig({
  test: {
    include: ['scripts/perf/*.perf.ts'],
    environment: 'node',
    silent: false,
    fileParallelism: false,
    testTimeout: 3_600_000,
  },
});
