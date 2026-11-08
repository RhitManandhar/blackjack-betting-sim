import { createDefaultConfig } from '../../../shared/defaults';
import { type ExperimentConfig, experimentConfigSchema } from '../../../shared/schema';
import { Outcome } from '../../blackjack/round';
import { OUTCOMES, type OutcomeCode } from '../../betting/__tests__/replay';
import type { RoundSourceFactory } from '../roundSource';

// Test-only: replays spec 7.1 outcome codes instead of dealing cards, so the runner can be
// checked against the spec's worked examples (7.7, 7.9).

const CATEGORY: Record<OutcomeCode, Outcome> = {
  W: Outcome.Win,
  DW: Outcome.Win,
  'S+': Outcome.Win,
  BJ: Outcome.Blackjack,
  P: Outcome.Push,
  S0: Outcome.Push,
  L: Outcome.Loss,
  DL: Outcome.Loss,
  'S-': Outcome.Loss,
};

/** Each strategy (by index) replays its own outcome list; running past the end is a test bug. */
export function scriptedSources(
  outcomesByStrategy: readonly (readonly OutcomeCode[])[],
): RoundSourceFactory {
  return (_seed, strategyIndex) => {
    const outcomes = outcomesByStrategy[strategyIndex] ?? outcomesByStrategy[0] ?? [];
    let next = 0;
    return {
      play: (bet, _bankrollBefore, out) => {
        const code = outcomes[next];
        if (code === undefined) throw new Error(`Script exhausted after ${String(next)} rounds`);
        next += 1;
        const outcome = OUTCOMES[code];
        out.netProfit = outcome.net(bet);
        out.totalWagered = outcome.stake(bet);
        out.outcome = CATEGORY[code];
        out.unavailableActions = 0;
        out.reshuffled = false;
      },
    };
  };
}

/** A validated config: spec 7.1 defaults, with overrides. */
export function testConfig(overrides: Partial<ExperimentConfig> = {}): ExperimentConfig {
  return experimentConfigSchema.parse({
    ...createDefaultConfig('test-experiment', 20_261_108),
    checkpoints: [],
    ...overrides,
  });
}
