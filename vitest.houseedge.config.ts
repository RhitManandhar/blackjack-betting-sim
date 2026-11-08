import { defineConfig } from 'vitest/config';

// House-edge gate (spec 6.3). Long-running; run with `npm run bench:houseedge`, never in CI.
// One file per rule-set group so the groups run in parallel worker processes.
export default defineConfig({
  test: {
    include: ['scripts/house-edge/*.gate.ts'],
    environment: 'node',
    silent: false,
    testTimeout: 3_600_000,
  },
});
