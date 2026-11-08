import { describe } from 'vitest';
import { runChartGate, standardCases } from './__fixtures__/chartGateCases';

// Chart gate (spec 6.3) for 2-deck rule sets. Split by deck count so files run in parallel.
describe('chart gate: 2 deck(s)', () => {
  runChartGate(standardCases(2));
});
