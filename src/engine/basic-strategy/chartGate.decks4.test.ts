import { describe } from 'vitest';
import { runChartGate, standardCases } from './__fixtures__/chartGateCases';

// Chart gate (spec 6.3) for 4-deck rule sets. Split by deck count so files run in parallel.
describe('chart gate: 4 deck(s)', () => {
  runChartGate(standardCases(4));
});
