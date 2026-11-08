# src/engine — engine-only guidance

Loaded by Claude Code when working in this folder. The root `CLAUDE.md` rules still apply.

## Determinism

- All randomness comes from `Rng` (`simulation/rng.ts`), seeded with `simulationSeed(experimentSeed, index)`. The generator, splitmix32 seeding, `nextBelow`, the shoe build order, the Fisher–Yates direction and the in-place reshuffle are pinned in spec 8.2–8.3 and by test vectors. Changing any of them changes every result and needs a spec version bump.
- The reshuffle check runs only at the start of `playRound`, never in the middle of a round.
- The order in which cards are drawn is part of the spec (5.2): player, upcard, player, hole. After a split, the left hand is finished before the right hand gets its second card. The golden tests in `blackjack/round.test.ts` are card-exact, so any change to dealing order breaks them on purpose.

## Basic strategy

- `basic-strategy/solver.ts` generates a table per rule set; `getStrategyTable` caches it by `ruleSetKey`, which covers every rule field. Never hand-copy a chart into engine code. Reference charts live only in `basic-strategy/__fixtures__` and are read only by the chart gate test.
- Solver EVs are probabilities, so floating point is correct there. Money never passes through the solver.
- Dealer probabilities come from `dealerOutcomes.ts`, which enumerates terminal multisets once per upcard. `dealerOutcomes.test.ts` checks it against a plain recursive walk. Keep that test when optimising.
- Only Tier 1 rules are implemented. `assertTier1Rules` refuses anything else; lift a restriction only together with its validation in Phase 7.

## Betting strategies

- One file per strategy in `betting/`, registered in `betting/registry.ts`. Win, loss or push comes only from `roundResultFromNet` (spec 1). `update` mutates state in place; the transitions must match spec 4.3 and the worked examples in 7.2–7.8, which `workedExamples.test.ts` replays row by row.
- Strategies never decide `bust` or `blocked_table_max`. `checkRequiredBet` does, checking the table maximum first. Never cap or reduce a bet.
- Every state carries `minimumOvershootCount` and `minimumOvershootTotal`, which stay 0 except for Oscar's Grind.
- `betting/__tests__/replay.ts` is a test-only harness for the spec 7.1 outcome codes. The real runner is Phase 5.
- Paroli classic and Paroli 1-3-2-6 must never share code or state.

## Simulation runner and statistics

- `simulation/runSimulation.ts` follows spec 2.2 exactly. Before each round it checks the bet. After each round it records first crossings, then checks the target, then the round limit. Strategies run one after another within a simulation; they never interact.
- `RoundSourceFactory` is the seam for tests. `blackjackRoundSources` plays real rounds, and `simulation/__tests__/scripted.ts` replays spec 7.1 outcome codes.
- `statistics/ExperimentResults` stores one row per simulation per strategy in typed arrays indexed by simulation id. It throws on a duplicate, so a re-queued chunk can never double count. Summaries are computed from the whole table in id order with exact integer and BigInt sums. Never compute a statistic from arrival order.
- Checkpoint histograms use the fixed layout pinned in spec 10.3 (2.4), which depends only on the starting bankroll.

## Hot path (`playRound`)

- No allocation per round. Per-hand state lives in typed arrays on `RoundContext`, and results are written into a caller-owned `RoundSettlement`. Do not return new objects, spread or destructure inside the round loop.
- `Action` and `Outcome` are `as const` numeric objects, not string unions, so comparisons stay cheap.
- Baseline: about 1.06 µs per round (6 decks, S17, DAS) on the development machine. Measure before and after any optimisation, and run the golden tests and the chart gate after any change.

## Gates

- Chart gate: `basic-strategy/chartGate.test.ts`, part of `npm test`.
- House-edge gate: `npm run bench:houseedge` (`scripts/house-edge/`). It takes several minutes and runs only when the user asks. Record each result in `docs/validation.md`.
