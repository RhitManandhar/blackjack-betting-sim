import { describe } from 'vitest';
import { optionCases, runChartGate } from './__fixtures__/chartGateCases';

// Chart gate (spec 6.3) for doubling restrictions, split limits, re-split aces and penetration.
describe('chart gate: rule options', () => {
  runChartGate(optionCases());
});
