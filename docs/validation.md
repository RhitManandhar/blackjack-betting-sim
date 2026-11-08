# Validation — basic strategy and house edge

Correctness gates from spec section 6.3. Each Tier 1 rule set must pass both gates before its options appear in the UI. This file records the reference sources, the method and every gate result.

Tier 1 rule sets (16): 6 or 8 decks × S17/H17 × DAS on/off × blackjack 3:2 or 6:5. All other rules are at their defaults: double on any two cards, no surrender, up to 4 split hands, split aces get one card and cannot be re-split, American peek, only the original bet lost to a dealer blackjack, 75% penetration.

## Gate 1 — chart gate

**Reference.** Michael Shackleford, "4-Deck to 8-Deck Blackjack Strategy", Wizard of Odds, <https://wizardofodds.com/games/blackjack/strategy/4-decks/> (last updated 3 August 2026, retrieved 8 November 2026). The text strategy on that page (S17), its DAS-conditional splits and its "hit soft 17" modifications are transcribed cell by cell in `src/engine/basic-strategy/__fixtures__/wizardOfOdds4to8Decks.ts`, quoting the source sentence for each row. The source assumes late surrender is allowed. Tier 1 has no surrender, so each surrender cell takes the source's own hit, stand or split rule instead.

**Test.** `src/engine/basic-strategy/chartGate.test.ts`. It runs in `npm test` (about 20 s) and compares the rendered generated table for all 16 rule sets cell by cell: hard 5–20, soft 13–20 and every pair against upcards 2–A.

| Date | Spec | Result |
| --- | --- | --- |
| 2026-11-08 | 2.2 | **Pass**, 16 of 16 rule sets, all cells |

## Gate 2 — house-edge gate

**Reference.** Michael Shackleford, "Blackjack House Edge Calculator", Wizard of Odds, <https://wizardofodds.com/games/blackjack/calculator/> (last updated 3 August 2026, retrieved 8 November 2026). The calculator's published "basic strategy with cut card" value is built from three parts, all copied from the page's embedded JavaScript:

1. `edgeTable[decks][soft17][das][0][2][0][0][1][0]`: the base edge for double on any two cards, resplit to 4 hands, no re-split aces, no hitting split aces, only the original bet lost to a dealer blackjack, and no surrender. It assumes composition-dependent strategy and a shuffle after every hand.
2. The page's cut-card adjustment for total-dependent basic strategy with a cut card: +0.0231 (6 decks), +0.0159 (8 decks).
3. The page's 6:5 adjustment when blackjack pays 6:5: +1.359690 (6 decks), +1.357984 (8 decks).

| Decks | Soft 17 | DAS | Base | Published, 3:2 | Published, 6:5 |
| --- | --- | --- | --- | --- | --- |
| 6 | S17 | yes | 0.403115 | 0.4262% | 1.7859% |
| 6 | S17 | no | 0.544889 | 0.5680% | 1.9277% |
| 6 | H17 | yes | 0.615626 | 0.6387% | 1.9984% |
| 6 | H17 | no | 0.760168 | 0.7833% | 2.1430% |
| 8 | S17 | yes | 0.430961 | 0.4469% | 1.8048% |
| 8 | S17 | no | 0.572499 | 0.5884% | 1.9464% |
| 8 | H17 | yes | 0.644928 | 0.6608% | 2.0188% |
| 8 | H17 | no | 0.789206 | 0.8051% | 2.1631% |

Known differences from the reference, all small next to the confidence interval: the calculator does not state its cut-card penetration (ours is 75%), its 6:5 adjustment is additive, and our split EVs use the approximation pinned in spec 6.1.

**Method.**

- Run with `npm run bench:houseedge`. It is long-running and never runs in CI.
- Each rule set plays 50,000,000 rounds of flat betting at 20.00, with an unlimited bankroll. Set `HOUSE_EDGE_ROUNDS` to change the count.
- Rounds are split into simulations of 100,000 rounds. Each simulation has its own shoe, seeded by `simulationSeed(20261108, i)`.
- The simulated house edge is the mean net result per initial bet. The gate passes when the published value lies inside the simulated 99% confidence interval: mean ± 2.5758 × SD / √rounds, which is about ±0.042% at 50 million rounds.
- Any unavailable-action count above zero fails the gate, because with an unlimited bankroll no action should ever be unaffordable.

| Date | Spec | Rounds per rule set | Result |
| --- | --- | --- | --- |
| 2026-11-08 | 2.2 | 50,000,000 | **Pass**, 16 of 16 rule sets (2 min 18 s on 10 cores) |

### Results, 2026-11-08 (spec 2.2, gate seed 20261108)

| Decks | Soft 17 | DAS | Payout | Simulated edge | 99% half-width | Published | Difference |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 6 | S17 | yes | 3:2 | 0.4594% | ±0.0420% | 0.4262% | +0.0332% |
| 6 | S17 | no | 3:2 | 0.5979% | ±0.0413% | 0.5680% | +0.0299% |
| 6 | H17 | yes | 3:2 | 0.6581% | ±0.0423% | 0.6387% | +0.0194% |
| 6 | H17 | no | 3:2 | 0.7986% | ±0.0415% | 0.7833% | +0.0154% |
| 8 | S17 | yes | 3:2 | 0.4538% | ±0.0421% | 0.4469% | +0.0069% |
| 8 | S17 | no | 3:2 | 0.5971% | ±0.0413% | 0.5884% | +0.0087% |
| 8 | H17 | yes | 3:2 | 0.6863% | ±0.0423% | 0.6608% | +0.0254% |
| 8 | H17 | no | 3:2 | 0.8273% | ±0.0415% | 0.8051% | +0.0222% |
| 6 | S17 | yes | 6:5 | 1.8162% | ±0.0415% | 1.7859% | +0.0303% |
| 6 | S17 | no | 6:5 | 1.9548% | ±0.0407% | 1.9277% | +0.0271% |
| 6 | H17 | yes | 6:5 | 2.0151% | ±0.0417% | 1.9984% | +0.0166% |
| 6 | H17 | no | 6:5 | 2.1558% | ±0.0409% | 2.1430% | +0.0128% |
| 8 | S17 | yes | 6:5 | 1.8091% | ±0.0415% | 1.8048% | +0.0042% |
| 8 | S17 | no | 6:5 | 1.9525% | ±0.0407% | 1.9464% | +0.0061% |
| 8 | H17 | yes | 6:5 | 2.0413% | ±0.0417% | 2.0188% | +0.0225% |
| 8 | H17 | no | 6:5 | 2.1828% | ±0.0410% | 2.1631% | +0.0197% |

Unavailable actions: 0 in every run. SD per round: 1.13–1.16 bets for 3:2 and 1.12–1.14 bets for 6:5.

**Observation.** Every difference is positive: the simulated edge is 0.004–0.033% above the published value, about 0.02% on average. Each one is inside its interval, so the gate passes. But a consistent sign suggests a small systematic offset rather than noise. The 3:2 and 6:5 runs of a rule set use the same seeds and cards, so the evidence amounts to 8 independent rule-set groups, not 16. Plausible causes, none of them verified: our 75% cut card versus the calculator's unstated penetration, total-dependent split decisions, and the additive approximations in the calculator itself. Revisit this if the gate is ever run with more rounds; at 200M rounds the half-width would be about ±0.021%.
