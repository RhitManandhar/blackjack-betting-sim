import type { RuleSet } from '../../shared/schema';
import { type RoundSettlement, createRoundContext, playRound } from '../blackjack/round';
import { createShoe } from '../blackjack/shoe';
import { Rng } from './rng';

// Where a strategy's rounds come from. Real runs play blackjack from a shoe seeded with the
// simulation seed (spec 2.1: every strategy in a simulation gets its own shoe from the same
// seed). Tests can substitute scripted outcomes to replay the spec's worked examples.

export interface RoundSource {
  /** Plays one round for `bet` and writes the settlement into `out`. */
  play(bet: number, bankrollBefore: number, out: RoundSettlement): void;
}

export type RoundSourceFactory = (simulationSeed: number, strategyIndex: number) => RoundSource;

export function blackjackRoundSources(rules: RuleSet): RoundSourceFactory {
  // One context serves every strategy: strategies are played one after another, never at once.
  const context = createRoundContext(rules);
  return (simulationSeed) => {
    const shoe = createShoe(rules.decks, rules.penetrationPercent, new Rng(simulationSeed));
    return {
      play: (bet, bankrollBefore, out) => {
        playRound(context, shoe, bet, bankrollBefore, out);
      },
    };
  };
}
