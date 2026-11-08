import { describe } from 'vitest';
import { runChartGate, standardCases } from './__fixtures__/chartGateCases';

// Chart gate (spec 6.3) for 1-deck rule sets. Split by deck count so files run in parallel.
describe('chart gate: 1 deck(s)', () => {
  runChartGate(standardCases(1));
});
