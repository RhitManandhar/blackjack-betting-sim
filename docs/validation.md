# Validation — basic strategy, house edge and cross-checks

Correctness gates from spec section 6.3. A rule option appears in the UI only after it passes both gates. This file records the reference sources, the method and every gate result.

- **Tier 1 (Phase 3):** 6 or 8 decks × S17/H17 × DAS on/off × blackjack 3:2 or 6:5 (16 rule sets).
- **Tiers 2 and 3 (Phase 7):** 1, 2 and 4 decks; late surrender; doubling on 9–11 or 10–11 only; at most 2 or 3 split hands; re-split aces; shoe penetration 50–90%.
- **Defaults:** unless a rule set says otherwise, all other rules are double on any two cards, no surrender, up to 4 split hands, split aces get one card and cannot be re-split, American peek, only the original bet lost to a dealer blackjack, and 75% penetration.

## Gate 1 — chart gate

**Reference.** Michael Shackleford, Wizard of Odds strategy pages (each last updated 3 August 2026, retrieved 8 November 2026). Each grid is transcribed cell by cell from the page's chart image into `src/engine/basic-strategy/__fixtures__/wizardOfOddsCharts.ts`, keeping the source's own codes (Ph, Pd, Ps, Rh, Rs, Rp):

- 1 deck: <https://wizardofodds.com/games/blackjack/strategy/1-deck/> (S17 and H17 charts)
- 2 decks: <https://wizardofodds.com/games/blackjack/strategy/2-decks/> (S17 and H17 charts)
- 4–8 decks: <https://wizardofodds.com/games/blackjack/strategy/4-decks/> (S17 and H17 charts, one chart for 4, 6 and 8 decks)

A resolver turns each published grid into our notation for a given double-after-split and surrender setting. For example, "Rh" becomes surrender-else-hit when surrender is on and plain hit when it is off.

**Test.** `src/engine/basic-strategy/chartGate.*.test.ts`, one file per deck count plus one for options, so they run in parallel (about 17 s of `npm test`). It compares the rendered table cell by cell, for hard 5–20, soft 13–20 and every pair against upcards 2–A, across 60 rule sets:

- every deck count (1, 2, 4, 6, 8) × S17/H17 × DAS on/off × surrender off/on (40);
- 6:5 payout for 6 and 8 decks (8);
- doubling on 9–11 and on 10–11, for 6 decks and 1 deck (4);
- at most 2 or 3 split hands, and re-split aces, for 6 decks and 1 deck (6);
- penetration 50% and 90% (2).

**Doubling restrictions.** No chart is published for them. The reference is the base chart with every double the restriction forbids replaced by the chart's own fallback (Dh → H, Ds → S). This is sound for total rows but not for pair rows: a restriction can make a split less valuable, because the split hands can no longer double. For example, with doubling only on 10–11, 4,4 vs 4 is no longer split (split −0.0022 behind standing), so these rule sets compare total rows only.

**Pair rows.** Since spec 2.2, a pair that is not split is played by its total cell. Our chart therefore records only split or no split for pair rows. A published composition-specific play for an unsplit pair is mapped to "no split". The cells where the published play differs from playing the total are:

- 1 deck, S17 and H17: **7,7 vs 10**. Published: stand, or surrender if allowed. Ours: hit (hard 14 vs 10).

**Agreed exceptions** (project owner, 8 November 2026). Two borderline cells differ from the published chart. The test asserts each one exactly and pins its EV margin, so any further drift fails:

| Rule sets | Hand | Published | Ours | EV(published) − EV(ours) | Pinned bound |
| --- | --- | --- | --- | --- | --- |
| 2 decks, S17 (all four DAS × surrender variants) | hard 11 vs A | double | hit | −0.0022 bets | ≥ −0.003 |
| 1 deck, H17, DAS on (surrender off and on) | 9,9 vs A | split | stand | −0.0062 bets | ≥ −0.007 |

Two explanations were considered. Valuing later hits by total instead of exact composition was tested on 8 November 2026 and changed neither cell; their EVs were unchanged. The remaining likely causes are not yet confirmed:

- **11 vs A:** the weighting of the two-card hands that make a total. Published total-dependent charts do not state their method.
- **9,9 vs A:** the agreed split approximation (spec 6.1). With one deck each split removes a large share of the remaining 9s, so the approximation is least accurate there.

Each cell occurs in well under 1% of rounds, so the effect on the house edge is about 0.001% or less. The house-edge gate below checks those rule sets independently and passes.

| Date | Spec | Result |
| --- | --- | --- |
| 2026-11-08 | 2.2 | **Pass**, 16 of 16 Tier 1 rule sets, all cells |
| 2026-11-08 | 2.6 | **Pass**, 60 of 60 rule sets, with the two agreed exceptions above |

## Gate 2 — house-edge gate

**Reference.** Michael Shackleford, "Blackjack House Edge Calculator", Wizard of Odds, <https://wizardofodds.com/games/blackjack/calculator/> (last updated 3 August 2026, retrieved 8 November 2026). The calculator's published "basic strategy with cut card" value is built from three parts, all copied from the page's embedded JavaScript:

1. `edgeTable[decks][soft17][das][doubleOn][resplitTo][rsa][hitSplitAces][originalBetOnly][surrender]`: the base edge for the rule set. Defaults are double on any two cards (0), resplit to 4 hands (2), no re-split aces (0), no hitting split aces (0), only the original bet lost to a dealer blackjack (1) and no surrender (0). It assumes composition-dependent strategy and a shuffle after every hand. The index used for each rule set is commented in `scripts/house-edge/publishedHouseEdge.ts`.
2. The page's cut-card adjustment for total-dependent basic strategy with a cut card: +0.1517 (1 deck), +0.0770 (2), +0.0395 (4), +0.0231 (6), +0.0159 (8). The calculator has no penetration setting, so the penetration rule sets use the 75% baseline's published value.
3. The page's 6:5 adjustment when blackjack pays 6:5: +1.394773 (1 deck), +1.373499 (2), +1.363115 (4), +1.359690 (6), +1.357984 (8).

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

### Results, 2026-11-08 (spec 2.6, Tiers 2 and 3, gate seed 20261108)

`npm run bench:houseedge -- t2`. 22 rule sets × 50,000,000 rounds, all at 3:2. **Pass, 22 of 22** (4 min 15 s on 10 cores). Unavailable actions: 0 in every run.

| Rule set | Simulated edge | 99% half-width | Published | Difference |
| --- | --- | --- | --- | --- |
| 1 deck, S17, DAS | -0.0274% | ±0.0424% | -0.0312% | +0.0038% |
| 1 deck, S17, no DAS | 0.1113% | ±0.0418% | 0.1101% | +0.0012% |
| 1 deck, H17, DAS | 0.1633% | ±0.0424% | 0.1594% | +0.0038% |
| 1 deck, H17, no DAS | 0.3043% | ±0.0418% | 0.3035% | +0.0008% |
| 2 decks, S17, DAS | 0.2689% | ±0.0421% | 0.2553% | +0.0136% |
| 2 decks, S17, no DAS | 0.4130% | ±0.0414% | 0.3980% | +0.0150% |
| 2 decks, H17, DAS | 0.4667% | ±0.0423% | 0.4569% | +0.0098% |
| 2 decks, H17, no DAS | 0.6132% | ±0.0417% | 0.6023% | +0.0109% |
| 4 decks, S17, DAS | 0.3879% | ±0.0420% | 0.3870% | +0.0009% |
| 4 decks, S17, no DAS | 0.5309% | ±0.0413% | 0.5291% | +0.0018% |
| 4 decks, H17, DAS | 0.5921% | ±0.0422% | 0.5967% | −0.0046% |
| 4 decks, H17, no DAS | 0.7379% | ±0.0415% | 0.7416% | −0.0037% |
| 6 decks, S17, DAS, late surrender | 0.3912% | ±0.0416% | 0.3536% | +0.0376% |
| 6 decks, H17, DAS, late surrender | 0.5790% | ±0.0417% | 0.5505% | +0.0285% |
| 1 deck, S17, DAS, late surrender | -0.0264% | ±0.0422% | -0.0532% | +0.0268% |
| 6 decks, S17, DAS, double 9–11 | 0.5599% | ±0.0412% | 0.5223% | +0.0376% |
| 6 decks, S17, DAS, double 10–11 | 0.6508% | ±0.0406% | 0.6183% | +0.0325% |
| 6 decks, S17, DAS, max 2 hands | 0.5152% | ±0.0418% | 0.4800% | +0.0352% |
| 6 decks, S17, DAS, max 3 hands | 0.4675% | ±0.0420% | 0.4349% | +0.0326% |
| 6 decks, S17, DAS, re-split aces | 0.3917% | ±0.0421% | 0.3577% | +0.0340% |
| 6 decks, S17, DAS, 50% penetration | 0.4453% | ±0.0420% | 0.4262% | +0.0191% |
| 6 decks, S17, DAS, 90% penetration | 0.4471% | ±0.0420% | 0.4262% | +0.0209% |

**Observations.**

- **1, 2 and 4 decks** sit very close to the published values: every difference is within 0.015%, and most are within 0.004%.
- **The 6-deck option sets** sit 0.02–0.04% above their published values. That is the same offset as the 6-deck baseline in the Tier 1 results above (+0.0332%). So each option's effect relative to the baseline closely matches the published effect; for example, surrender is published as −0.073% and measured as −0.068%.
- **Closest to the limit:** two rule sets landed near the edge of their interval, surrender and doubling on 9–11, both at +0.0376% against a ±0.041% half-width. The 6-deck offset is worth confirming with a longer run (200M rounds halves the interval).
- **Penetration:** 50% and 90% gave 0.4453% and 0.4471%, indistinguishable at this sample size. The cut-card effect varies with penetration, but the variation is smaller than the gate can resolve. Both lie within the interval of the 75% published value.

## Cross-checks (Phase 9, task 4)

Independent checks of the whole simulator, beyond the two gates. Run with `npm run bench:crosscheck` (about 1 minute on 10 cores; never in CI). Code in `scripts/cross-check/`. `CROSS_CHECK_SIMULATIONS` (default 20,000) and `CROSS_CHECK_ROUNDS` (default 20,000,000) change the sizes. Seed 20261122.

### Cross-check 1 — return per base bet

**Claim checked.** No betting system changes the house edge. For every strategy, the return per unit of initial bet must match the published edge of the default rules (6 decks, S17, DAS, 3:2, 0.4262%; see gate 2).

**Method.**

- Each strategy plays alone through the real runner (`createSimulationPlan` + `runSimulation`) on the default configuration: 20,000 simulations of 1,000 rounds, no target.
- One change: the bankroll is unlimited (10^15 cents, far above the form's limit; the plan is built directly). Nothing busts, and basic strategy is never cut short by an unaffordable double or split.
- A counting wrapper around the real round source records every round. For every simulation, its totals must equal the runner's `roundsPlayed`, `netProfit` and `sumInitialBets`, and final bankroll must equal starting bankroll plus net profit.
- Two estimates, each with a 99% interval clustered by simulation (delta method; rounds within a simulation share a shoe):
  - **Bet-weighted return:** total profit ÷ total initial bets, the house-edge definition. This is where strategies differ.
  - **Per-bet return:** the mean of net ÷ initial bet per round. Each strategy has its own shoe from the same seed, so with an unlimited bankroll the cards and decisions are the same whatever the bet. This figure is therefore identical for every strategy and equal to flat betting's. It shows that bet size never changes play.
- **Pass:** both intervals contain 0.4262%, no unavailable actions, no bookkeeping mismatches.
- **Martingale needs a table maximum to be checked.** Without a bankroll or table limit, a Martingale bet after k losses is 2^k units while such a streak has a probability of about 0.53^k, so the variance of its bet total is unbounded and no interval for the ratio is reliable (at 200, 2,000 and 20,000 simulations the 99% half-width was ±4.8%, ±10.4% and ±2.6%). Its gated run therefore uses a table maximum of 1,024 units (20,480.00): it stops as `blocked_table_max` after ten straight losses, so bets stay bounded, and stopping cannot change the expected return per unit bet. The run without a maximum is reported only.
- A last pass at the default 500.00 bankroll, exactly as a user runs it, is reported only. Busts stop strategies early, and unaffordable doubles and splits are played as the best remaining action (spec 6.2).

### Results, 2026-11-22 (spec 2.9, seed 20261122): pass, 5 of 5 strategies

Unlimited bankroll, 20,000 simulations each. "Edge" is minus the return per unit of initial bet; the published value is 0.4262%.

| Strategy | Rounds | Bet-weighted edge | 99% half-width | Difference | Per-bet edge |
| --- | ---: | ---: | ---: | ---: | ---: |
| `flat-v1` | 20,000,000 | 0.4162% | ±0.0664% | −0.0100% | 0.4162% ± 0.0664% |
| `martingale-v1` (table max 1,024 units) | 16,897,741 | 0.2221% | ±0.4158% | −0.2041% | 0.4100% ± 0.0722% |
| `paroli-classic-v1` | 20,000,000 | 0.4192% | ±0.0772% | −0.0070% | 0.4162% ± 0.0664% |
| `paroli-1326-v1` | 20,000,000 | 0.4274% | ±0.0809% | +0.0012% | 0.4162% ± 0.0664% |
| `oscars-grind-bj-v1` | 20,000,000 | 0.4063% | ±0.1904% | −0.0199% | 0.4162% ± 0.0664% |

Unavailable actions: 0. Bookkeeping mismatches: 0. Martingale stops: 14,094 round limit, 5,906 blocked at the table maximum.

**Reported only.**

| Run | Rounds | Unavailable actions | Bet-weighted edge |
| --- | ---: | ---: | --- |
| `martingale-v1`, unlimited bankroll, no table maximum | 20,000,000 | 0 | −1.1884% ± 2.6483% (interval not reliable, see above) |
| `flat-v1`, default 500.00 bankroll | 13,614,388 | 2,699 | 0.4093% ± 0.0805% |
| `martingale-v1`, default 500.00 bankroll | 1,384,800 | 2,361 | 0.4352% ± 0.5693% |
| `paroli-classic-v1`, default 500.00 bankroll | 8,599,484 | 6,701 | 0.4328% ± 0.1180% |
| `paroli-1326-v1`, default 500.00 bankroll | 7,245,730 | 6,047 | 0.4400% ± 0.1342% |
| `oscars-grind-bj-v1`, default 500.00 bankroll | 4,572,650 | 4,663 | 0.3993% ± 0.2069% |

At the default bankroll every strategy's interval also contains the published edge. The extra cost of the unaffordable doubles and splits is too small to see at this sample size.

### Cross-check 2 — outcome frequencies

**Reference.** Michael Shackleford, "Variance in Blackjack: Standard Deviation & Multiple Hands", Wizard of Odds, <https://wizardofodds.com/games/blackjack/appendix/4/> (last updated 3 August 2026, retrieved 22 November 2026). Its table of net-win probabilities for one hand assumes basic strategy in a cut-card game under the page's "liberal Strip rules": 6 decks, S17, double on any two cards, DAS, late surrender, re-split aces, up to four hands. The page does not state its penetration; the check uses the engine's 75% default. Values are copied into `scripts/cross-check/publishedOutcomes.ts`.

**Method.** Flat betting at 20.00, unlimited bankroll, 20,000,000 rounds in simulations of 100,000 rounds, as in gate 2.

- **The spec's four categories** (spec 1: blackjack, win, push, loss) come from the table. With these rules +1.5 occurs only for an unsplit natural, and surrender (−0.5) is a loss. Each passes when the published share lies within the simulated share ± 2.5758 standard errors (99%).
- **Every table row with probability ≥ 0.0005** (11 rows, covering surrender, doubles and splits) passes at |z| ≤ 3.5, about 99% for the family. Smaller rows are reported only.
- No simulated net result may fall outside the table's values.

### Results, 2026-11-22 (spec 2.9, seed 20261122): pass

| Category | Simulated | 99% half-width | Published | Difference |
| --- | ---: | ---: | ---: | ---: |
| Blackjack | 4.5315% | ±0.0120% | 4.5296% | +0.0018% |
| Win | 37.9207% | ±0.0279% | 37.8971% | +0.0235% |
| Push | 8.4852% | ±0.0160% | 8.4833% | +0.0019% |
| Loss | 49.0627% | ±0.0288% | 49.0900% | −0.0273% |

| Net (bets) | −3 | −2 | −1 | −0.5 | 0 | +1 | +1.5 | +2 | +3 | +4 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| z | 1.11 | 0.75 | −2.46 | −1.10 | 0.30 | 0.80 | 0.40 | **3.19** | −1.20 | 0.18 |

(The −4 row, 0.00048, is just below the gating threshold: z 0.40.) Net results outside the table: none. Unavailable actions: 0.

**Observations.**

- Win and loss sit close to their limits: win at +0.0235% against ±0.0279%, loss at −0.0273% against ±0.0288%. Most of the shift is in the +2 row (z 3.19; doubles won), with the −1 row correspondingly lower (z −2.46).
- The mean result per bet, reported only, is −0.2196% (SE about 0.026%). The table's own expectation is −0.2773%, about 2.2 standard errors away.
- So the simulation wins slightly more doubles than the table, while the categories and every other row agree. The reference does not say whether its strategy is total-dependent like ours or composition-dependent, or what its penetration is; either could move doubled hands by this much. This does not fail the check, but it is worth revisiting with a longer run (`CROSS_CHECK_ROUNDS=100000000`) before treating it as a real difference.
