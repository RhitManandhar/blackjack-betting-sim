# Blackjack Betting Simulator — Simulation Specification

| Field | Value |
| --- | --- |
| Spec version | **2.8** (2.0 frozen 7 November 2026; 2.1 terminology change 8 November 2026; 2.2 Phase 3 pins 8 November 2026; 2.3 note correction 8 November 2026; 2.4 Phase 5 pins 8 November 2026; 2.5 failed run status 8 November 2026; 2.6 rules Tiers 2–3 8 November 2026; 2.7 rankings and bet progression 8 November 2026; 2.8 export formats 8 November 2026) |
| Results schema version | 1 |
| Based on | [Project Plan v2](project-plan-v2.md) |
| Status | **Frozen** 7 November 2026. Decisions D1–D19 and assumptions A1–A4 confirmed by the project owner. Changes need a version bump and a changelog entry (section 13). |

This document is the source of truth for simulation behaviour. The project plan describes the roadmap, UI and hosting. Where the plan is less precise, this spec settles the question. Where they conflict, raise it; do not pick one silently.

Notation: all money is stored as **integer cents**. Tables in this document show amounts in currency units (AUD) for readability, so `20.00` means `2000` cents in tests. *Unit* means the base bet (default 20.00).

---

## 1. Core definitions

**Simulation.** One seeded run in which every selected strategy plays from the same starting bankroll until each strategy stops. The "number of simulations" input is the number of these runs. Simulations are numbered from `0` internally and shown to the user as 1, 2, 3 and so on. A simulation is **not** a number of rounds: it contains up to `roundLimit` rounds per strategy. (Spec 2.0 and the plan's first draft called this a "session"; that word is no longer used for it.)

**Round.** One initial player hand and everything it triggers: dealer peek, splits, doubles, surrender, dealer play and settlement. Rounds are counted per strategy, starting at `1`.

**Initial bet.** The wager the betting strategy chooses before the cards are dealt. This is the only thing a strategy controls.

**Stake.** Money put at risk during a round: the initial bet plus every double and every additional split hand.

**Net round profit.** Total returned to the player minus total staked in that round. It is an integer number of cents and can be positive, negative or zero.

**Round result for progressions.** Decided only by the sign of net round profit, in one shared function that every strategy uses:

| Net round profit | Result |
| --- | --- |
| `> 0` | `win` |
| `< 0` | `loss` |
| `= 0` | `push` |

This covers blackjacks, doubles, splits, surrender and dealer blackjack alike. A progression advances once per round, never once per split hand.

**Round outcome category** (for frequency statistics). Each round falls into exactly one category:

| Category | Condition |
| --- | --- |
| `blackjack` | Player has a natural and the dealer does not |
| `win` | Any other round with net profit `> 0` |
| `push` | Net profit `= 0`, including natural against natural |
| `loss` | Net profit `< 0`, including dealer blackjack |

The four counts always sum to rounds played.

**Cumulative profit.** The sum of net round profit over all rounds played so far by that strategy in that simulation. Bankroll is always `starting bankroll + cumulative profit`.

---

## 2. Simulation group and stopping

### 2.1 Simulation group

Each selected strategy in a simulation has:

- its own bankroll, starting at the configured starting bankroll;
- its own betting state, initialised fresh;
- its own shoe and RNG, created from the **same simulation seed** (section 8).

Strategies never read each other's state. Because the shoes start identical, all strategies see the same cards until something makes one of them use a different number of cards, for example an unaffordable double or split (section 5.4) or a different stake on a split hand. After that their cards may differ. This is expected.

### 2.2 Order of checks

Before each round `r` (starting at `r = 1`), and after settling each round, the runner applies these checks to each strategy that is still playing, in this exact order:

**After settling round `r`:**

1. Record first crossings (section 3.3).
2. If the active stop target is reached (`cumulative profit ≥ target amount`) → stop with `target_reached`.
3. Otherwise, if `r = round limit` → stop with `round_limit`.

**Before round `r + 1`:**

4. Ask the strategy for the next initial bet `b`.
5. If a table maximum is set and `b > table maximum` → stop with `blocked_table_max`.
6. Otherwise, if `b > bankroll` → stop with `bust`.
7. Otherwise place `b` and play the round.

Consequences:

- A target reached on the last allowed round is `target_reached`, not `round_limit`.
- When the bet breaks both limits, the reason is `blocked_table_max`: a bet over the table maximum is never allowed, whatever the bankroll.
- A bet equal to the whole bankroll is allowed. `bust` can occur with money left (for example 200.00 left and 320.00 required).
- No bet is ever reduced, rounded or capped to fit. The strategy simply stops.

The same check (steps 4–7) also runs before round 1. Configuration validation (section 9) makes sure the first bet always passes, so round 1 is always played.

### 2.3 Independent stopping

A stopped strategy freezes its bankroll and profit, takes no further bets and stops drawing cards. The others keep playing. The simulation ends when every strategy has stopped. The round limit applies to each strategy, so every simulation ends.

### 2.4 Stop reasons

| Code | Meaning |
| --- | --- |
| `target_reached` | Cumulative profit reached the active stop target |
| `bust` | The next required bet is greater than the bankroll |
| `blocked_table_max` | The next required bet is greater than the table maximum |
| `round_limit` | The strategy played the configured number of rounds |

`cancelled` is a **run status**, not a stop reason (section 10.4). Simulations that did not finish in a cancelled run are left out of the results. They are never counted under any stop reason.

---

## 3. Profit targets

### 3.1 Thresholds

There are four fixed thresholds, as multiples of the starting bankroll `B`:

| Id | Multiple | Amount (B = 500.00) | Bankroll at target |
| --- | --- | --- | --- |
| `0_5x` | 0.5 | +250.00 | 750.00 |
| `1x` | 1 | +500.00 | 1,000.00 |
| `2x` | 2 | +1,000.00 | 1,500.00 |
| `2_5x` | 2.5 | +1,250.00 | 1,750.00 |

Amount in cents = `ceil(B × multiple)`, computed in integers as `ceil(B × numerator / denominator)` with multiples 1/2, 1/1, 2/1, 5/2. Rounding up means "reaching" a target never needs less than the exact multiple.

### 3.2 Target modes

| Mode | Stop target | First crossings recorded for |
| --- | --- | --- |
| `none` | none | all four thresholds |
| `single` (with one threshold chosen) | the chosen threshold | all four thresholds that are reached before stopping (in practice the chosen one and lower ones) |
| `compare_all` | `2_5x` | all four thresholds |

**Compare-all capping.** In `compare_all` mode, each strategy stops at the first round its profit is at or above 2.5x. Its recorded final profit is the **actual** profit after that round, which can be slightly above 2.5x. Values are never clamped, so `final bankroll = starting bankroll + net profit` always holds. Final-profit statistics in this mode are labelled "upside truncated: strategies stop at the 2.5x target". The same label, naming the chosen target, applies in `single` mode.

### 3.3 First crossing

The first-crossing round for threshold `t` is the smallest round number `r` after whose settlement cumulative profit `≥ amount(t)`. It stays recorded even if profit later falls back below it. If the threshold is never reached, it is blank (`null`).

Ordering invariant: `first(0_5x) ≤ first(1x) ≤ first(2x) ≤ first(2_5x)` wherever both values exist. A single round can cross several thresholds; each then gets that same round number.

---

## 4. Betting strategies

### 4.1 Interface

```ts
interface BettingStrategy<State> {
  readonly id: StrategyId;            // e.g. "martingale"
  readonly version: string;           // e.g. "martingale-v1"
  initialState(params: StrategyParams): State;
  nextBet(state: State, params: StrategyParams): Cents;      // required initial bet
  update(state: State, result: RoundResult, netProfit: Cents, params: StrategyParams): State;
}
// params: { unit: Cents; tableMinimum: Cents; paroliStreakLength: number }
// RoundResult = "win" | "loss" | "push", from the shared function in section 1.
```

The runner, not the strategy, decides `bust` or `blocked_table_max` (section 2.2). The plan's "explain why a bet cannot be placed" is the stop reason plus the required bet, which are recorded with the result. Strategies never see cards, hands or the bankroll's effect on hand play. (In the hot loop, state may be mutated in place for speed. The observable transitions must match the tables below.)

Every strategy must keep the invariant `tableMinimum ≤ nextBet`. Because `unit ≥ tableMinimum` (section 9), this holds automatically for every strategy except Oscar's Grind, whose rule handles it explicitly.

### 4.2 Version identifiers

| Strategy | `id` | `version` |
| --- | --- | --- |
| Flat | `flat` | `flat-v1` |
| Martingale | `martingale` | `martingale-v1` |
| Paroli (classic, 1-2-4) | `paroli-classic` | `paroli-classic-v1` |
| Paroli (1-3-2-6) | `paroli-1326` | `paroli-1326-v1` |
| Oscar's Grind (blackjack-adapted) | `oscars-grind-bj` | `oscars-grind-bj-v1` |

### 4.3 Exact rules

**Flat (`flat-v1`).** State: none. `nextBet = unit`.

**Martingale (`martingale-v1`).** State: `currentBet`, initially `unit`.

| Result | New `currentBet` |
| --- | --- |
| win | `unit` |
| loss | `2 × currentBet` |
| push | unchanged |

The doubling is based on the previous **initial bet**, not on the amount lost. After losing a doubled 40.00 hand (80.00 lost) the next bet is 80.00, not 160.00.

**Paroli classic (`paroli-classic-v1`).** Parameter `N` = streak length (default 3, allowed 2–5). State: `consecutiveWins`, initially 0. `nextBet = unit × 2^consecutiveWins`.

| Result | New `consecutiveWins` |
| --- | --- |
| win | `consecutiveWins + 1`; if that equals `N`, reset to `0` |
| loss | `0` |
| push | unchanged (a push neither extends nor breaks the streak) |

With `N = 3` the bets are 1, 2, 4 units, then back to 1 after the third win.

**Paroli 1-3-2-6 (`paroli-1326-v1`).** State: `stepIndex` into `[1, 3, 2, 6]`, initially 0. `nextBet = unit × steps[stepIndex]`.

| Result | New `stepIndex` |
| --- | --- |
| win at index 0, 1 or 2 | `stepIndex + 1` |
| win at index 3 (sequence completed) | `0` |
| loss | `0` |
| push | unchanged |

This strategy has its own state and code. It shares nothing with Paroli classic.

**Oscar's Grind, blackjack-adapted (`oscars-grind-bj-v1`).** State: `cycleProfit` (cents, initially 0), `currentBet` (initially `unit`), `minimumOvershootCount` (initially 0), `minimumOvershootTotal` (cents, initially 0).

After each round with net profit `p`:

1. `cycleProfit = cycleProfit + p`.
2. If `cycleProfit ≥ unit`: the cycle is complete. Set `cycleProfit = 0` and `currentBet = unit`. Any excess over one unit is discarded. Stop here.
3. If the result is `loss` or `push`: keep `currentBet`. Stop here.
4. If the result is `win`: let `needed = unit − cycleProfit` (always `> 0` here).
   `candidate = min(currentBet + unit, needed)`.
   - If `candidate ≥ tableMinimum`: `currentBet = candidate`.
   - Otherwise: `currentBet = tableMinimum`, `minimumOvershootCount += 1` and `minimumOvershootTotal += tableMinimum − candidate`.

Notes:

- The bet may go **down** after a win when a large win (blackjack, double, split) leaves less than one bet needed.
- After a loss or push, "keep the bet" respects the cycle-goal cap except after a minimum overshoot. A loss only raises `needed`, so a bet set by step 4 to at most `needed` stays at most `needed`. A bet forced up to the table minimum in step 4 can stay above `needed` through one or more pushes. It is still the table minimum, so it is still the smallest legal bet, and it is recorded once, when step 4 sets it, not again on each push.
- "Normal even-money win" in the plan means `needed` is worked out as if the next round pays 1:1. Larger payouts simply finish the cycle sooner.

---

## 5. Blackjack rules and settlement

### 5.1 Rule set

| Setting | Default | Options | Tier |
| --- | --- | --- | --- |
| Decks | 6 | 6, 8 (Tier 1); 1, 2, 4 (Tier 2) | 1 / 2 |
| Soft 17 | Stand (`S17`) | `S17`, `H17` | 1 |
| Blackjack payout | 3:2 | 3:2, 6:5 | 1 |
| Double after split (DAS) | on | on / off | 1 |
| Doubling allowed on | any first two cards | any two, 9–11, 10–11 | 2 |
| Late surrender | off | on / off | 2 |
| Maximum split hands | 4 | 2, 3, 4 | 2 |
| Split aces | one card each, no re-split | + re-split aces option | 2 |
| Shoe penetration | 75% | 50–90% in steps of 5 (pinned in 2.6) | 3 |
| Dealer peek | American hole card, peeks with A or 10-value upcard | fixed | — |
| Insurance / even money | never taken | fixed | — |

A rule option appears in the UI only after its tier passes validation (section 6.3).

### 5.2 Round sequence

1. Reshuffle check (section 8.3), then place the initial bet.
2. Deal player, dealer upcard, player, dealer hole card.
3. If the dealer upcard is an ace or 10-value card, the dealer peeks. On dealer blackjack the round ends at once: a player natural pushes; otherwise the player loses only the initial bet. No surrender, double or split happens.
4. If the player has a natural (and the dealer does not): the player is paid at the blackjack payout and the round ends.
5. Otherwise the player plays each hand by basic strategy (section 6), left to right. On a split, the hand becomes two hands of one card each, with the new hand placed immediately to the right. The left hand receives its second card at once and is played to completion (including any re-split) before the next hand to the right receives its second card.
6. If at least one player hand is neither busted nor surrendered, the dealer plays: hits to hard 17+, stands on soft 17 under S17, hits soft 17 under H17.
7. Settle each hand on its own; net round profit is the sum.

### 5.3 Hand rules

- Ace counts 11 unless that busts the hand; then it counts 1. A hand is **soft** if an ace is currently counted as 11.
- A **natural** is an ace plus a 10-value card as the first two cards of the initial hand. Two cards totalling 21 after a split are **not** a natural and pay 1:1.
- Split: two cards of equal value form a pair, so any two 10-value cards count as a pair, as in published charts. Basic strategy never splits them, so this does not change results. Each split hand gets a stake equal to the initial bet. Re-split up to the maximum number of hands.
- Split aces: each ace gets exactly one card. No hit, no double. With the re-split aces option on, an ace that receives another ace may be split again, up to the maximum number of hands; the new ace again receives one card. Otherwise an ace pair after a split stands as soft 12.
- Double: one more card, stake doubled. Allowed on the first two cards of a hand, subject to the doubling rule and DAS. Pinned in 2.6: "double on 9–11" and "10–11" restrict doubling by the hand's total, so a soft hand (total 13 or more) can never be doubled under a restriction. The same restriction applies to split hands when DAS is on.
- Surrender (Tier 2, late): only on the initial two-card hand, after the dealer has peeked, so a dealer blackjack still takes the whole bet. Never after a split. The player loses `b − floor(b / 2)` (5.5), the round ends and the dealer does not play. Surrender needs no extra stake, so funds can never make it unavailable.
- A busted player hand loses even if the dealer then busts.

### 5.4 When funds are short

**Available funds** during a round = `bankroll before the round − total stake already committed in this round`.

If basic strategy calls for a double or split and its extra stake (`= that hand's stake` for a double, `= initial bet` for a split) is greater than the available funds:

1. Play the best remaining legal action, defined as the action with the highest expected value among those still legal and affordable. The solver produces these EVs (section 6.1), so no extra chart is needed.
2. Increment `unavailableActionCount` by 1 for that decision. A decision is counted once: if a split is unaffordable, the fallback is chosen only from actions that are both legal and affordable, so an equally unaffordable double is not counted again.

An action that the rules forbid (for example a double after a split without DAS, or a split beyond the maximum number of hands) is not a funds shortage and is never counted. The pair is then played by its total.

Typical results: a hard 11 that cannot be doubled hits; a soft 18 vs 3 that cannot be doubled stands; a pair of 8s that cannot be split is played as hard 16.

### 5.5 Payout and rounding rules

All payouts are integer cents. The house keeps any fraction of a cent:

| Case | Formula (bet `b` in cents) | Example |
| --- | --- | --- |
| Win | `+b` | 20.00 → +20.00 |
| Blackjack 3:2 | `+floor(3b / 2)` | 25.01 → +37.51 (exact 37.515) |
| Blackjack 6:5 | `+floor(6b / 5)` | 20.01 → +24.01 (exact 24.012) |
| Surrender | `−(b − floor(b / 2))` | 20.01 → −10.01 |
| Push | `0` | — |
| Loss | `−stake` | — |

Integer division here is done in integers, never with floating point.

### 5.6 Settlement golden cases (bet 20.00, S17, 3:2 unless noted)

| # | Situation | Net round profit | Result |
| --- | --- | --- | --- |
| G1 | Player natural, dealer no natural | +30.00 | win (`blackjack`) |
| G2 | Same, 6:5 | +24.00 | win (`blackjack`) |
| G3 | Player natural, dealer natural | 0.00 | push |
| G4 | Dealer natural after peek, player 20 | −20.00 | loss |
| G5 | Dealer natural after peek, player holds 8,8 (would split) | −20.00 (only initial bet lost) | loss |
| G6 | Player 20, dealer 20 | 0.00 | push |
| G7 | Player busts at 22, dealer then busts | −20.00 | loss |
| G8 | Double on 11, win | +40.00 | win |
| G9 | Split 8s: one hand wins, one loses | 0.00 | push |
| G10 | Split 8s, double one (DAS) and win it, other loses | +20.00 | win |
| G11 | Split aces, one receives a ten (21), dealer 20 | +20.00 on that hand, paid 1:1 | — |
| G12 | Dealer upcard 6, H17: dealer A,6 hits; S17: dealer stands on soft 17 | — | rule check |

Phase 3 turns these into card-exact tests with fixed shoe orders.

---

## 6. Basic strategy

### 6.1 Generation

- The strategy table is **total-dependent**: one decision per (hard total, soft total or pair) × dealer upcard, as in published charts.
- It is generated per rule set by an exact expected-value solver for the configured deck count, S17/H17, DAS, doubling rule, surrender, split limits and split-ace rule, with dealer peek.
- For each cell the solver stores the EV of every legal action (stand, hit, double, split, surrender), so the funds-short fallback (5.4) is "best affordable action by EV".
- Tables are cached by a canonical rule-set key. A table generated for one rule set is never reused for another.

**Solver method (pinned in 2.2).**

- *Card removal.* EVs are exact for the finite shoe minus the dealer upcard and every card in the player's hand so far, recalculated after each further card. The dealer's final-total probabilities are conditioned on the peek: with an ace up the hole card is not a ten-value card, and with a ten-value card up it is not an ace.
- *Total cells.* A cell's EV for stand, hit and double is the average over every two-card hand that makes that total (pairs included), weighted by its probability from the shoe minus the upcard. Hit EV means hitting and then standing or hitting by exact EV. Totals of 21 are always stood on and have no cell. Hands of three or more cards, and split hands, use the cell for their total; doubling is offered only where the rules allow it.
- *Pair cells.* The split decision compares the EV of splitting with the best non-split EV of that exact pair. If the pair is not split, it is played by its total cell.
- *Split EV.* The approximation is fixed and standard. Remove the upcard and both pair cards, and let q be the probability of drawing another pair card. Compute the expected number of finished hands and of hands left as an unsplit pair once the hand limit is reached, holding q fixed. Split EV is (finished hands × average EV of a post-split hand whose second card is not the pair card) + (unsplit hands × EV of the unsplit pair). A post-split hand may double only with DAS. Split aces receive one card and stand.
- *Where.* Tables are generated at run time and cached in memory per rule-set key. Generation takes about 1.3 s per rule set on a current laptop core.
- *Legality (pinned in 2.6).* Cells store the raw EV of doubling; whether a double is allowed (doubling restriction, DAS) is decided for each hand when it is played. Late surrender has EV −0.5 and is offered only on the initial two-card hand. The pair decision's "not splitting" value uses the same legality for that exact pair: a double only where the restriction allows it, and surrender when it is on. If surrender is best and the pair is not split, the hand surrenders. Split hands may double only when DAS is on and the restriction allows the total.

### 6.2 Decision rule

The player always takes the highest-EV legal action from the table for the current hand. There is no mistake or deviation option, no insurance and no card counting. The betting strategy never affects this.

### 6.3 Correctness gates (per rule set, before its options appear in the UI)

1. **Chart gate.** The generated table matches a published total-dependent chart for that rule set, cell by cell. The source of each reference chart is cited in the test file.
   - Pair rows record only split or no split, because an unsplit pair is played by its total (6.1).
   - Where no chart is published (the doubling restrictions), only total rows are compared, against the base chart with forbidden doubles replaced by their fallback.
   - Agreed exceptions (2.6): hard 11 vs A with 2 decks and S17, and 9,9 vs A with 1 deck, H17 and DAS. Each differs from the published chart by a small EV margin. The test asserts each exactly and pins its margin, and `docs/validation.md` records the numbers.
2. **House-edge gate.** A flat-betting run of tens of millions of rounds gives a house edge within the 99% confidence interval of the published value for that rule set. The published values and their sources are recorded in `docs/validation.md`. Options are validated one at a time: every deck count with S17/H17 and DAS on/off, then each other option from the 6-deck baseline, plus surrender with one deck and penetration at 50% and 90%. Do not weaken or skip these checks.

---

## 7. Worked examples (golden test data)

### 7.1 Shared setup

Starting bankroll 500.00, table minimum 20.00, unit 20.00, no table maximum, target mode `none`, round limit ≥ 14, Paroli streak `N = 3`. All stakes in these sequences are affordable, so `unavailableActionCount = 0` throughout.

Every strategy faces the same 14 round outcomes. Each outcome is defined relative to that round's initial bet `b`:

| Code | Meaning | Net profit | Total stake |
| --- | --- | --- | --- |
| `W` | plain win | `+b` | `b` |
| `L` | plain loss | `−b` | `b` |
| `P` | push | `0` | `b` |
| `BJ` | player natural, 3:2 | `+1.5b` | `b` |
| `DW` | double, win | `+2b` | `2b` |
| `DL` | double, loss | `−2b` | `2b` |
| `S0` | split, one hand wins, one loses | `0` (push) | `2b` |
| `S+` | split, doubled hand wins, other loses | `+b` (win) | `3b` |
| `S−` | split, one hand wins, doubled hand loses | `−b` (loss) | `3b` |

Sequence: `W, BJ, W, P, DW, L, S0, DL, L, W, S+, S−, W, BJ`.

"Profit" is cumulative profit after the round. "Next" is the initial bet for the following round.

### 7.2 Flat (`flat-v1`)

| Round | Outcome | Bet | Net | Profit | Bankroll | Next |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | W | 20 | +20 | 20 | 520 | 20 |
| 2 | BJ | 20 | +30 | 50 | 550 | 20 |
| 3 | W | 20 | +20 | 70 | 570 | 20 |
| 4 | P | 20 | 0 | 70 | 570 | 20 |
| 5 | DW | 20 | +40 | 110 | 610 | 20 |
| 6 | L | 20 | −20 | 90 | 590 | 20 |
| 7 | S0 | 20 | 0 | 90 | 590 | 20 |
| 8 | DL | 20 | −40 | 50 | 550 | 20 |
| 9 | L | 20 | −20 | 30 | 530 | 20 |
| 10 | W | 20 | +20 | 50 | 550 | 20 |
| 11 | S+ | 20 | +20 | 70 | 570 | 20 |
| 12 | S− | 20 | −20 | 50 | 550 | 20 |
| 13 | W | 20 | +20 | 70 | 570 | 20 |
| 14 | BJ | 20 | +30 | 100 | 600 | 20 |

### 7.3 Martingale (`martingale-v1`)

| Round | Outcome | Bet | Net | Profit | Bankroll | Next | Why |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | W | 20 | +20 | 20 | 520 | 20 | win → 1 unit |
| 2 | BJ | 20 | +30 | 50 | 550 | 20 | win → 1 unit |
| 3 | W | 20 | +20 | 70 | 570 | 20 | win |
| 4 | P | 20 | 0 | 70 | 570 | 20 | push → repeat |
| 5 | DW | 20 | +40 | 110 | 610 | 20 | win |
| 6 | L | 20 | −20 | 90 | 590 | 40 | loss → double |
| 7 | S0 | 40 | 0 | 90 | 590 | 40 | split push → repeat |
| 8 | DL | 40 | −80 | 10 | 510 | 80 | loss → double the **bet** (40), not the 80 lost |
| 9 | L | 80 | −80 | −70 | 430 | 160 | loss → double |
| 10 | W | 160 | +160 | 90 | 590 | 20 | win → reset |
| 11 | S+ | 20 | +20 | 110 | 610 | 20 | split win → reset |
| 12 | S− | 20 | −20 | 90 | 590 | 40 | split loss → double |
| 13 | W | 40 | +40 | 130 | 630 | 20 | win → reset |
| 14 | BJ | 20 | +30 | 160 | 660 | 20 | win |

### 7.4 Paroli classic (`paroli-classic-v1`, N = 3)

| Round | Outcome | Bet | Net | Profit | Bankroll | Wins after | Next | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | W | 20 | +20 | 20 | 520 | 1 | 40 | win → double |
| 2 | BJ | 40 | +60 | 80 | 580 | 2 | 80 | win → double |
| 3 | W | 80 | +80 | 160 | 660 | 0 | 20 | 3rd win → reset |
| 4 | P | 20 | 0 | 160 | 660 | 0 | 20 | push → keep |
| 5 | DW | 20 | +40 | 200 | 700 | 1 | 40 | win |
| 6 | L | 40 | −40 | 160 | 660 | 0 | 20 | loss → reset |
| 7 | S0 | 20 | 0 | 160 | 660 | 0 | 20 | push → keep |
| 8 | DL | 20 | −40 | 120 | 620 | 0 | 20 | loss |
| 9 | L | 20 | −20 | 100 | 600 | 0 | 20 | loss |
| 10 | W | 20 | +20 | 120 | 620 | 1 | 40 | win |
| 11 | S+ | 40 | +40 | 160 | 660 | 2 | 80 | split win |
| 12 | S− | 80 | −80 | 80 | 580 | 0 | 20 | split loss → reset |
| 13 | W | 20 | +20 | 100 | 600 | 1 | 40 | win |
| 14 | BJ | 40 | +60 | 160 | 660 | 2 | 80 | win |

### 7.5 Paroli 1-3-2-6 (`paroli-1326-v1`)

| Round | Outcome | Step | Bet | Net | Profit | Bankroll | Next step | Next | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | W | 1 | 20 | +20 | 20 | 520 | 3 | 60 | win → advance |
| 2 | BJ | 3 | 60 | +90 | 110 | 610 | 2 | 40 | win → advance |
| 3 | W | 2 | 40 | +40 | 150 | 650 | 6 | 120 | win → advance |
| 4 | P | 6 | 120 | 0 | 150 | 650 | 6 | 120 | push → keep step |
| 5 | DW | 6 | 120 | +240 | 390 | 890 | 1 | 20 | step 6 won → sequence complete |
| 6 | L | 1 | 20 | −20 | 370 | 870 | 1 | 20 | loss → reset |
| 7 | S0 | 1 | 20 | 0 | 370 | 870 | 1 | 20 | push |
| 8 | DL | 1 | 20 | −40 | 330 | 830 | 1 | 20 | loss |
| 9 | L | 1 | 20 | −20 | 310 | 810 | 1 | 20 | loss |
| 10 | W | 1 | 20 | +20 | 330 | 830 | 3 | 60 | win |
| 11 | S+ | 3 | 60 | +60 | 390 | 890 | 2 | 40 | split win → advance |
| 12 | S− | 2 | 40 | −40 | 350 | 850 | 1 | 20 | split loss → reset |
| 13 | W | 1 | 20 | +20 | 370 | 870 | 3 | 60 | win |
| 14 | BJ | 3 | 60 | +90 | 460 | 960 | 2 | 40 | win |

### 7.6 Oscar's Grind (`oscars-grind-bj-v1`)

| Round | Outcome | Bet | Net | Profit | Bankroll | Cycle after | Next | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | W | 20 | +20 | 20 | 520 | 0 | 20 | cycle +20 ≥ 20 → close |
| 2 | BJ | 20 | +30 | 50 | 550 | 0 | 20 | cycle +30 → close, excess dropped |
| 3 | W | 20 | +20 | 70 | 570 | 0 | 20 | close |
| 4 | P | 20 | 0 | 70 | 570 | 0 | 20 | push → keep |
| 5 | DW | 20 | +40 | 110 | 610 | 0 | 20 | close |
| 6 | L | 20 | −20 | 90 | 590 | −20 | 20 | loss → keep |
| 7 | S0 | 20 | 0 | 90 | 590 | −20 | 20 | push → keep |
| 8 | DL | 20 | −40 | 50 | 550 | −60 | 20 | loss → keep |
| 9 | L | 20 | −20 | 30 | 530 | −80 | 20 | loss → keep |
| 10 | W | 20 | +20 | 50 | 550 | −60 | 40 | needed 80; min(20+20, 80) = 40 |
| 11 | S+ | 40 | +40 | 90 | 590 | −20 | 40 | needed 40; min(60, 40) = 40 |
| 12 | S− | 40 | −40 | 50 | 550 | −60 | 40 | loss → keep |
| 13 | W | 40 | +40 | 90 | 590 | −20 | 40 | needed 40; min(80, 40) = 40 |
| 14 | BJ | 40 | +60 | 150 | 650 | 0 | 20 | cycle +40 → close |

Overshoot count 0 throughout.

### 7.7 Simulation results for the shared sequence

Total wagered counts every stake (doubles and split hands included). Max wager is the largest **initial bet**. Max drawdown is defined in section 10.1.

| Strategy | Final bankroll | Net profit | Total wagered | Max wager | Max drawdown | Return per unit wagered |
| --- | --- | --- | --- | --- | --- | --- |
| Flat | 600.00 | +100.00 | 420.00 | 20.00 | 80.00 (peak R5 → R9) | +0.2381 |
| Martingale | 660.00 | +160.00 | 720.00 | 160.00 | 180.00 (R5 → R9) | +0.2222 |
| Paroli classic | 660.00 | +160.00 | 780.00 | 80.00 | 120.00 (R5 → R12) | +0.2051 |
| Paroli 1-3-2-6 | 960.00 | +460.00 | 1,000.00 | 120.00 | 80.00 (R5 → R9) | +0.4600 |
| Oscar's Grind | 650.00 | +150.00 | 580.00 | 40.00 | 80.00 (R5 → R9) | +0.2586 |

Outcome categories (same for all five, since categories follow the round, not the bet size): `blackjack` 2, `win` 6, `push` 2, `loss` 4.

These numbers are an arithmetic check only. A hand-picked favourable sequence says nothing about which system is better.

### 7.8 Additional transition cases

Same setup as 7.1 unless stated. Each line is: starting state → outcome(s) → bets placed and resulting state.

| Id | Strategy | Case | Expected |
| --- | --- | --- | --- |
| T1 | Paroli classic N=3 | W, P, W, W | bets 20, 40, 40, 80; next 20 (push mid-streak keeps the streak; third win resets) |
| T2 | Paroli classic N=2 | W, W, W | bets 20, 40, 20; next 40 |
| T3 | Paroli classic N=3 | W, W, L | bets 20, 40, 80; next 20 |
| T4 | Paroli 1-3-2-6 | W, W, W, L | bets 20, 60, 40, 120; next 20 (loss at step 6 resets) |
| T5 | Martingale | L, P, L, W | bets 20, 40, 40, 80; next 20 |
| T6 | Oscar's Grind, unit 20, min 20 | L, BJ | bets 20, 20. After BJ cycle = +10; needed 10; candidate 10 < 20 → next bet 20, overshoot count 1, total 10.00 |
| T7 | Oscar's Grind, unit 40, min 20, bankroll 500 | L, BJ | bets 40, 40. After BJ cycle = +20; needed 20; candidate 20 ≥ 20 → next 20, no overshoot |
| T8 | Oscar's Grind, unit 20, min 20 | L, L, L, W, W | bets 20, 20, 20, 20, 40; next 20. After L, L, L cycle = −60. W at 20 → cycle −40, needed 60, next min(40, 60) = 40. W at 40 → cycle 0, needed 20, next min(80, 20) = 20 (bet goes down; cycle still open because 0 < 20) |

### 7.9 Stop-condition cases

| Id | Setup | Sequence | Expected |
| --- | --- | --- | --- |
| X1 | Martingale, bankroll 500, no max | L, L, L, L | bets 20, 40, 80, 160; bankroll 200; next required 320 > 200 → `bust` after 4 rounds, bankroll 200.00 frozen |
| X2 | Martingale, bankroll 500, max 100 | L, L, L | bets 20, 40, 80; next required 160 > 100 → `blocked_table_max` after 3 rounds, bankroll 360.00 |
| X3 | Martingale, bankroll 500, max 300 | L, L, L, L | next required 320 > 300 and > 200 → `blocked_table_max` (table check first) |
| X4 | Flat, bankroll 50 | L, L | bankroll 10; required 20 > 10 → `bust` after 2 rounds |
| X5 | Flat, bankroll 40 | L | bankroll 20; required 20 = 20 → allowed, round 2 played |
| X6 | Paroli 1-3-2-6, single target 0.5x (+250) | shared sequence | profit 390 after round 5 → `target_reached`, rounds played 5, first crossing `0_5x` = 5, others blank |
| X7 | Paroli 1-3-2-6, `compare_all` | shared sequence | first crossing `0_5x` = 5; `1x`, `2x`, `2_5x` blank after 14 rounds; still playing |
| X8 | Any, round limit 5, target reached in round 5 | — | `target_reached`, not `round_limit` |
| X9 | One simulation, Flat and Martingale, bankroll 50 each | L, L | Martingale: bet 20, bankroll 30, requires 40 → `bust` after 1 round, frozen at 30.00. Flat keeps playing: bet 20, 20, bankroll 10 → `bust` after 2 rounds. The simulation ends only once both have stopped |

### 7.10 Funds-short case

| Id | Setup | Expected |
| --- | --- | --- |
| F1 | Martingale bankroll 200.00 before the round, bet 160.00, player hard 11 vs dealer 6 | Available funds 40.00 < 160.00 → cannot double; best remaining action (hit) is played; `unavailableActionCount` = 1 |
| F2 | Bankroll 30.00, bet 20.00, player 8,8 vs dealer 10 | Available 10.00 < 20.00 → cannot split; played as hard 16 by EV; counter +1 |

---

## 8. Randomness and reproducibility

### 8.1 Seeds

- **Experiment seed:** unsigned 32-bit integer (0 to 4,294,967,295). Entered manually or created once in the UI by `crypto.getRandomValues`. Never created inside `src/engine`.
- **Simulation seed:** derived only from the experiment seed and the simulation index, so chunking, worker count and scheduling cannot affect it:

  ```
  simulationSeed(i) = fmix32((experimentSeed + (i + 1) × 0x9E3779B9) mod 2^32)
  ```

  `fmix32` is the MurmurHash3 32-bit finaliser. Chunks do not need seeds of their own; a chunk is just a range of simulation indices.
- **Every simulation in an experiment gets a different seed.** This is guaranteed, not left to chance. `i ↦ (experimentSeed + (i + 1) × 0x9E3779B9) mod 2^32` is one-to-one for `i < 2^32`, because the multiplier is odd, and `fmix32` is a bijection. So `simulationSeed(i) ≠ simulationSeed(j)` whenever `i ≠ j`, far beyond the 50,000-simulation cap. A unit test checks there are no duplicates over the full cap.
- All strategies in simulation `i` create their RNG from `simulationSeed(i)` (paired seeds). This sharing within a simulation is deliberate, so the strategies are compared on the same cards. Seeds differ only *between* simulations.

### 8.2 Generator

- PRNG: **xoshiro128\*\***, with its 128-bit state filled by four outputs of **splitmix32** seeded with the simulation seed.
- splitmix32 (pinned in 2.2): `state = (state + 0x9E3779B9) mod 2^32; z = state; z = (z ^ (z >>> 16)) × 0x21F0AAAD; z = (z ^ (z >>> 15)) × 0x735A2D97; output z ^ (z >>> 15)`, with every multiplication taken mod 2^32. The xoshiro128\*\* state is `s0..s3` = its first four outputs, in order.
- Bounded integers in `[0, n)` (pinned in 2.2): `t = (2^32 − n) mod n`; draw `r` until `r ≥ t`; return `r mod n`. This is exactly unbiased.
- Test vectors (pinned in 2.2): the first four `nextUint32` outputs are `1789933344, 44971166, 2521387044, 3848737593` for seed 0, and `660444221, 3652823732, 77672526, 910233633` for seed 42.
- Changing the generator, seeding or shuffle changes every result. That requires a spec version bump.

### 8.3 Shoe

- The shoe is built in a fixed card order, then shuffled by Fisher–Yates from the last index down. Pinned in 2.2: the order is deck by deck, ranks A, 2, …, 10, J, Q, K, with four cards of each rank. Cards are stored by blackjack value, so J, Q and K are 10. Each step `i` from `n − 1` down to `1` swaps index `i` with `j = nextBelow(i + 1)`. With seed 0 and 6 decks, the first ten cards after the first shuffle are `10, 4, 3, 4, 9, 2, 2, 10, 5, 10`.
- Cut card position = `floor(totalCards × penetration)`, with penetration 50–90% in steps of 5.
- The reshuffle check happens **only before a round**: if cards dealt ≥ cut card position, the whole shoe is reshuffled with the same RNG stream. A round never reshuffles in the middle. There is no burn card. The shoe is shuffled once when it is created. A reshuffle shuffles the current card array in place; it does not restore the fixed order first.
- **Running out mid-round (pinned in 2.6).** A small shoe can run out during a round (for example one deck at 90% penetration with several splits). The discards are then reused: the cards dealt in earlier rounds since the last shuffle, never the cards of the current round. They are shuffled in their own positions by Fisher–Yates from the last index down, with the same RNG. Dealing continues from the first of them, and the whole shoe is reshuffled before the next round. If even the discards run out in the same round, the simulation stops with an error rather than inventing cards. That would need a whole deck's worth of cards in a single round, which has never occurred in testing.

### 8.4 Determinism contract

The same configuration and experiment seed always give identical per-simulation results and identical aggregates, whether run with 1, 2, 3 or 4 workers and whatever the chunk size.

---

## 9. Configuration schema and validation

```ts
interface ExperimentConfig {
  schemaVersion: 1;
  specVersion: "2.8";
  experimentId: string;              // created in the UI
  experimentSeed: number;            // uint32
  simulations: number;                  // 1 .. 50_000 (soft cap, final value from Phase 9)
  roundLimit: number;                // 1 .. 10_000
  currency: "AUD";                   // display only
  startingBankroll: Cents;           // > 0
  tableMinimum: Cents;               // > 0
  unit: Cents;                       // tableMinimum ≤ unit ≤ startingBankroll
  tableMaximum: Cents | null;        // null = none; otherwise ≥ unit
  targetMode: "none" | "single" | "compare_all";
  singleTarget: "0_5x" | "1x" | "2x" | "2_5x" | null;   // required iff mode = single
  strategies: { id: StrategyId; version: string }[];   // 1..5, no duplicates
  paroliStreakLength: number;        // 2 .. 5, default 3
  rules: RuleSet;                    // section 5.1
  checkpoints: number[];             // ascending, unique, each 1..roundLimit, at most 20 (2.7); default [50,100,250,500,1000]
  displayedSimulations: number;         // n panels in the comparison grid: 1 .. min(25, simulations), default 6
  workerCount: "auto" | 1 | 2 | 3 | 4;
}
```

Rules:

- Validate with Zod at every boundary: form input, imported JSON and worker messages.
- Checkpoints above the round limit are removed, and the UI says so.
- Total work = `simulations × strategies × roundLimit` (an upper bound). Over about 100 million rounds triggers a warning before the run.
- Changing `workerCount` never changes results (8.4). It is stored only to describe the run.
- `displayedSimulations` affects only what is drawn, never results. If it is larger than `simulations`, it is lowered to `simulations` and the UI says so.
- Money inputs are typed in currency units and converted to cents once, at the form boundary.

---

## 10. Results, statistics and exports

### 10.1 Per-simulation strategy result

```ts
interface StrategySimulationResult {
  simulationId: number;
  simulationSeed: number;
  strategyId: StrategyId;
  strategyVersion: string;
  roundsPlayed: number;
  startingBankroll: Cents;
  finalBankroll: Cents;              // = startingBankroll + netProfit (invariant)
  netProfit: Cents;
  totalWagered: Cents;               // all stakes incl. doubles and split hands
  sumInitialBets: Cents;             // for average wager
  maxWager: Cents;                   // largest initial bet placed
  maxDrawdown: Cents;
  firstCrossing: { "0_5x": number | null; "1x": number | null; "2x": number | null; "2_5x": number | null };
  stopReason: "target_reached" | "bust" | "blocked_table_max" | "round_limit";
  requiredBetAtStop: Cents | null;   // for bust / blocked
  outcomeCounts: { blackjack: number; win: number; push: number; loss: number };
  unavailableActionCount: number;
  minimumOvershootCount: number;     // Oscar's Grind; 0 for others
  minimumOvershootTotal: Cents;      // Oscar's Grind; 0 for others
  checkpointProfit: (Cents)[];       // one per configured checkpoint, frozen profit carried forward
  checkpointBet: (Cents | null)[];   // 2.7: initial bet placed in each checkpoint round; null once stopped
}
```

**Max drawdown** is the largest fall in bankroll from a previous peak, measured after each round. The starting bankroll counts as the first peak. It is never negative.

**Checkpoint profit** is cumulative profit after round `c`. If the strategy stopped before round `c`, its frozen final profit is used, and charts say "stopped strategies carried forward at their final profit".

**Checkpoint bet** (added in 2.7) is the initial bet placed in round `c`, or `null` if the strategy stopped before round `c`. Unlike profit, a stopped strategy's bet is never carried forward. Checkpoint bets are stored exactly, one value per simulation per strategy per checkpoint; the 20-checkpoint cap (section 9) bounds that memory.

### 10.2 Statistics definitions

All are per strategy over completed simulations `n`. The UI shows `n` next to every percentage and average.

| Statistic | Definition |
| --- | --- |
| Mean, SD | Sample mean and sample standard deviation (`n − 1`) of net profit, computed from exact integer sums |
| Percentiles (5, 25, 50, 75, 95) | Linear interpolation between closest ranks (Hyndman–Fan type 7, same as numpy's default and Excel `PERCENTILE.INC`) on the sorted per-simulation values |
| Profit / break-even / loss share | `netProfit > 0`, `= 0`, `< 0` |
| Return per unit wagered | `R = Σ netProfit / Σ totalWagered` over simulations |
| CI for R | Ratio estimator: `SE = sqrt( Σ (pᵢ − R·wᵢ)² / (n(n−1)) ) / mean(w)`; 95% interval `R ± 1.96·SE` |
| CI for a mean | `mean ± 1.96·SD/√n` |
| CI for a proportion | Wilson score interval, 95% (`z = 1.959964`) |
| Hit rate for target t | Share of simulations with `firstCrossing[t] ≠ null`, Wilson CI |
| Rounds to target t | Mean (and median) of `firstCrossing[t]` over simulations that crossed it |
| Bust before target t | Share of simulations with stop reason `bust` and `firstCrossing[t] = null` |
| Bust rate / block rate | Share with stop reason `bust` / `blocked_table_max` |
| Average wager | `Σ sumInitialBets / Σ roundsPlayed` |
| Outcome frequencies | Category count / total rounds played |
| At or above break-even (2.7) | Share with `netProfit ≥ 0`, Wilson CI |
| Drawdown percentiles (2.7) | Type-7 percentiles (5, 25, 50, 75, 95) of `maxDrawdown`, exact |
| Bet progression (2.7) | At each checkpoint, over strategies still playing: count and share still playing, exact mean and type-7 95th percentile of `checkpointBet` |

Statistics may be fractional and are rounded to cents only for display. Money totals stay integers. Exact integer accumulators are used so merge order cannot change results; where a sum of squares could exceed 2^53 it uses `BigInt`.

**Inconclusive.** When two strategies' 95% intervals for a compared metric overlap, the difference is described as inconclusive. Fewer than 100 completed simulations triggers a small-sample warning.

### 10.3 Checkpoint aggregates

Per checkpoint and strategy: count, exact integer sum of profit, sum of squares, count profitable, minimum (worst loss), and a fixed-bin histogram. The mean has a 95% interval (`mean ± 1.96·SD/√n`, added in 2.7). Checkpoint percentiles (5th, 25th, 50th, 75th and 95th) come from the histogram and are labelled approximate. The bin layout depends only on the configuration, never on the data, so every worker uses the same bins. It has fixed-width bins plus underflow and overflow bins.

**Layout (pinned in 2.4).** With starting bankroll `B`, there are 400 equal bins covering profit from `−B` to `+3B`, each `[low, high)` and 1% of `B` wide (5.00 at the default 500.00). One underflow bin sits below `−B` and one overflow bin at `+3B` or above. A profit `x` in range goes to bin `floor((x + B) × 400 / 4B)`, computed in integers. An approximate percentile uses type-7 ranks, with the k-th smallest value placed at the midpoint of its share of its bin. Values in the underflow or overflow bin report the range edge.

Reasons:

- `−B` is a hard floor. Every stake must be funded (5.4), so a strategy can never lose more than its bankroll.
- `+3B` covers every target with room to spare, since the highest target is `+2.5B`.
- With 1% bins, checkpoint percentiles are accurate to about ±1% of the bankroll.
- Memory is about 3 KB per checkpoint per strategy.
- Only no-target runs that go beyond `+3B` reach the overflow bin. They affect the 5th–95th percentiles only if more than 5% of simulations get there.

### 10.4 Run status

- `complete`: every simulation finished.
- `cancelled`: the user pressed Stop All. Results cover only fully finished simulations, the count of finished simulations is shown, and everything is labelled **partial**. A partly played simulation is thrown away, never counted. Simulations are counted in whole chunks only: a chunk still running when Stop All is pressed is discarded entirely, including any of its simulations that had already finished (added in 2.5).
- `failed` (added in 2.5): a chunk failed on three attempts in a row (the first attempt plus two retries, each on a freshly started worker). The run stops and the error is shown. As with `cancelled`, results cover only whole finished chunks and are labelled **partial**. A retried chunk can never be counted twice, because each simulation is stored once by its id.

### 10.5 CSV conventions

UTF-8, comma-separated, header row, `.` as the decimal separator. Money columns are in currency units with exactly two decimals (`-12.50`). Rates are fractions from 0 to 1 with six decimals. Blank cells mean "not applicable / not reached". Each file starts with the header row (no comment lines), and the run status appears as a column.

Pinned in 2.8:

- **Rounding.** A money statistic that is not a whole number of cents (a mean, percentile, standard deviation or interval bound) is rounded to whole cents, halves away from zero (`-1234.5` cents is `-12.35`). The dashboard and the HTML report use the same rule, so every figure matches the CSV. Money totals are integers and are never rounded.
- **Other averages.** Averages that are neither money nor rates (`avg_rounds_played`, `avg_rounds_to_*`) have exactly two decimals.
- **Rates.** `return_per_unit_wagered` and its interval are written like rates, with six decimals, and may be negative. A rate that rounds to zero is written `0.000000`, never `-0.000000`.
- **Format.** Lines end with CRLF (RFC 4180). There is no byte-order mark. A cell is quoted only if it contains a comma, a double quote or a line break; quotes inside are doubled.

### 10.6 CSV 1 — summary (one row per strategy)

```
experiment_id, experiment_seed, spec_version, run_status, currency,
strategy_id, strategy_version, simulations,
status_target_reached, status_bust, status_blocked_table_max, status_round_limit,
share_profit, share_profit_ci_low, share_profit_ci_high, share_break_even, share_loss,
profit_mean, profit_mean_ci_low, profit_mean_ci_high, profit_sd,
profit_p5, profit_p25, profit_median, profit_p75, profit_p95,
largest_win, largest_loss, profit_upside_truncated,
return_per_unit_wagered, rpuw_ci_low, rpuw_ci_high,
total_wagered, avg_wager, max_wager, avg_rounds_played,
max_drawdown, avg_max_drawdown,
hit_rate_0_5x, hit_rate_0_5x_ci_low, hit_rate_0_5x_ci_high, avg_rounds_to_0_5x, bust_before_0_5x,
hit_rate_1x,   hit_rate_1x_ci_low,   hit_rate_1x_ci_high,   avg_rounds_to_1x,   bust_before_1x,
hit_rate_2x,   hit_rate_2x_ci_low,   hit_rate_2x_ci_high,   avg_rounds_to_2x,   bust_before_2x,
hit_rate_2_5x, hit_rate_2_5x_ci_low, hit_rate_2_5x_ci_high, avg_rounds_to_2_5x, bust_before_2_5x,
bust_rate, block_rate,
freq_blackjack, freq_win, freq_push, freq_loss,
unavailable_actions, minimum_overshoot_count
```

`total_wagered` is summed over all simulations. `max_wager` and `max_drawdown` are maximums over simulations. `profit_upside_truncated` is `true` when a target mode was active.

### 10.7 CSV 2 — per simulation (one row per simulation per strategy)

```
experiment_id, run_status, simulation_id, simulation_seed, strategy_id, strategy_version,
rounds_played, final_bankroll, net_profit, total_wagered, max_wager, max_drawdown,
first_cross_0_5x, first_cross_1x, first_cross_2x, first_cross_2_5x,
stop_reason, unavailable_actions, minimum_overshoot_count
```

Rows are ordered by `simulation_id`, then by strategy in configuration order. Every completed simulation is included, written in chunks with a size warning. `run_status` (added in 2.8, as section 10.5 requires) repeats the run status on every row, so a file from a cancelled or failed run is marked partial. `simulation_id` is zero-based; the UI shows simulation `id + 1`. `final_bankroll` is the starting bankroll plus `net_profit`.

### 10.8 HTML report and JSON

- The HTML report embeds at most 500 simulations per strategy: the first 500 by `simulation_id`, so the sample is deterministic.
- The HTML report (detailed in 2.8) is one file with the chart library, styling and data inlined and no external references, so it works offline. It contains the configuration, seed, table rules and strategy rules; the run status (complete or partial, with completed and total simulations); the comparison table; the rankings for every goal, every target and every checkpoint; the dashboard charts; target attainment and checkpoint tables; the comparison-grid panels; and the simulation sample. Its figures come from the same summary, formatting and rounding as the dashboard.
- The JSON download is the `ExperimentConfig` (section 9). Importing it and running again reproduces the run exactly.

---

### 10.9 Per-simulation comparison grid

The grid lets the user see, for individual simulations, how every chosen strategy fared on the same cards.

- **Which simulations:** simulations `0 … n−1`, where `n = displayedSimulations`, labelled "Simulation 1 … n" with their simulation seed. Fixed indices keep the choice deterministic and independent of worker count. Chunks are queued in simulation order, so these simulations are among the first to finish.
- **One panel per simulation:** each panel overlays one bankroll line per chosen strategy on a shared round axis, starting at round 0 (the starting bankroll). It shows reference lines for the starting bankroll and the active target, and a legend with strategy toggles.
- **Downsampling:** for displayed simulations only, the worker records each strategy's bankroll at round 0, at every `k`-th round where `k = max(1, ceil(roundLimit / 200))`, and at that strategy's final round. Each point holds the round, the bankroll after it, and the initial bet placed in that round (0 at round 0), for the panel tooltip (pinned in 2.4). That is at most about 202 points per strategy per panel. Non-displayed simulations record no curve data.
- **Delivery:** curve points travel in the **chunk result** message for the chunk that contains the simulation, never in progress messages and never per round. A panel fills in when that chunk result arrives. The run is never slowed or paced for display. Panels not yet filled show "running".
- **Stopped strategies:** a strategy's line ends at its final round with a marker showing its stop reason (`target_reached`, `bust`, `blocked_table_max`, `round_limit`). It is not carried forward in the panel. Checkpoint charts still carry frozen profit forward (10.1).
- **Cancelled runs:** panels whose simulation did not finish show "not finished (run cancelled)". They are never drawn from partial data.
- **Interaction:** clicking a panel enlarges it with tooltips (round, bankroll, bet) and zoom. The same grid appears on the final dashboard and in the HTML report.
- Curve points are display data only. Statistics never use them.

### 10.10 Rankings by goal (added in 2.7)

Rankings implement plan sections 1 and 7.2. Every ranking is labelled "best under this selected configuration", never a universal best. For each goal, strategies are sorted by one metric, higher being better; ties keep the configuration order.

| Goal | Metric | Interval |
| --- | --- | --- |
| 1. Best overall | Return per unit wagered | Ratio interval (10.2) |
| 2. Minimal loss most of the time | Share at or above break-even | Wilson |
| 3. Maximum win most of the time | 75th-percentile final profit | none |
| 4. Reaching a target | Hit rate for the chosen target | Wilson |
| 5. Ahead or behind at round N | Mean profit at the chosen checkpoint | Mean interval |

The first strategy is the leader. Every other strategy gets a verdict against the leader:

- **inconclusive** if the two 95% intervals overlap, or the values are exactly equal;
- **lower** if the intervals do not overlap;
- **no verdict** if the metric has no interval (goal 3).

A **clear leader** is declared only when every other strategy is lower with non-overlapping intervals. Otherwise the page says there is no clear leader and the differences are inconclusive.

## 11. Confirmed assumptions (plan section 17)

| # | Assumption | Status |
| --- | --- | --- |
| A1 | "Blocked by table maximum" is reported separately from "bust" | Confirmed |
| A2 | Default checkpoints are 50, 100, 250, 500, 1,000 rounds | Confirmed |
| A3 | European no-hole-card rules stay out of the MVP | Confirmed |
| A4 | Per-simulation CSV covers every simulation; the HTML report embeds only a sample | Confirmed |

## 12. Decisions made at freeze

These close gaps the plan left open. All are confirmed by the project owner (7 November 2026). Each one is reflected in the sections above.

| # | Decision | Section |
| --- | --- | --- |
| D1 | Check order: target → round limit → table maximum → bankroll | 2.2 |
| D2 | If a bet breaks both limits, the reason is `blocked_table_max` | 2.2 |
| D3 | A bet equal to the whole bankroll is allowed | 2.2 |
| D4 | Compare-all mode records actual final profit (never clamped) and labels results upside-truncated | 3.2 |
| D5 | Target amounts round up; payouts and surrender refunds round down (house keeps fractions) | 3.1, 5.5 |
| D6 | Martingale doubles the previous initial bet, not the amount lost | 4.3 |
| D7 | Paroli classic: a push neither extends nor breaks the streak; streak length 2–5 | 4.3 |
| D8 | Oscar's Grind overshoot is recorded as a count and a total in cents; excess cycle profit is discarded when a cycle closes | 4.3 |
| D9 | Max wager = largest initial bet; total wagered includes all stakes | 7.7, 10.1 |
| D10 | Funds-short fallback = best affordable action by solver EV; available funds = bankroll minus stakes already in the round | 5.4 |
| D11 | Seeds: uint32 experiment seed, per-simulation derivation by index (no per-chunk seeds); xoshiro128\*\* + splitmix32 | 8 |
| D12 | Reshuffle only between rounds, no burn card | 8.3 |
| D13 | A cancelled run keeps only fully finished simulations | 10.4 |
| D14 | Percentiles use type-7 interpolation; inconclusive = overlapping 95% intervals; small-sample warning below 100 simulations | 10.2 |
| D15 | CSV additions to the plan's list: `experiment_id`, `minimum_overshoot_count`, and run status in the summary file | 10.6, 10.7 |
| D16 | Any two 10-value cards count as a pair | 5.3 |
| D17 | Every simulation gets a unique seed (proved by construction, checked by test); strategies within a simulation share it | 8.1 |
| D18 | The per-simulation comparison grid shows simulations 1…n, filled when each finishes, never animated or throttled | 10.9 |
| D19 | `displayedSimulations` default 6, maximum 25, never more than `simulations` | 9, 10.9 |

## 13. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 2.0 | 2026-11-07 | Frozen from Project Plan v2. Added exact definitions, worked examples, schemas and CSV columns. Pre-freeze review added the unique-seed guarantee and the per-simulation comparison grid (D17–D19). |
| 2.1 | 2026-11-08 | Terminology only, no behaviour change: "session" renamed to "simulation" everywhere, including identifiers and CSV columns (`simulations`, `displayedSimulations`, `simulationSeed`, `StrategySimulationResult`, `simulation_id`, `simulation_seed`). Results schema stays at version 1 because nothing had been exported yet. |
| 2.2 | 2026-11-08 | Phase 3 pins, agreed with the project owner (plan items P1–P6). **Generator and shoe:** splitmix32 constants, the unbiased bounded-integer method, test vectors, the fixed shoe order and in-place reshuffles (8.2, 8.3). **Basic strategy:** the solver method — exact card removal, peek-conditioned dealer, two-card-weighted total cells, the split approximation and run-time caching (6.1). **Play:** split dealing order (5.2) and how funds-short decisions are counted (5.4). Results produced before 2.2 are not comparable, because none existed. |
| 2.3 | 2026-11-08 | Wording only, no change in behaviour. Corrected the note under Oscar's Grind (4.3): the cycle-goal cap holds after a loss or push except when the bet was forced up to the table minimum, which can stay above `needed` through pushes. The overshoot is recorded once, when it is set. Found by the Phase 4 property tests. |
| 2.4 | 2026-11-08 | Phase 5 pins, agreed with the project owner. **Checkpoint histogram layout (10.3):** 400 equal bins from −B to +3B, plus underflow and overflow bins, the bin formula and the approximate-percentile rule. **Curve points (10.9):** each point also records that round's initial bet, for the tooltip. No change to any simulated result. |
| 2.5 | 2026-11-08 | Phase 6 decisions, agreed with the project owner. **Run status (10.4):** new `failed` status after a chunk fails three times, with partial results kept. Stop All discards chunks still running, including simulations in them that had already finished, so only whole chunks are counted. No change to any simulated result. |
| 2.6 | 2026-11-08 | Rules Tiers 2 and 3, agreed with the project owner and passed by both gates (`docs/validation.md`). **Rules (5.1, 5.3):** 1, 2 and 4 decks; late surrender (initial hand only, after the peek, loses `b − floor(b/2)`, never blocked by funds); doubling on 9–11 or 10–11 means the hand's total, so no soft doubles; at most 2 or 3 split hands; re-split aces; penetration 50–90% in steps of 5. **Solver (6.1):** legality is decided per hand, surrender is part of the pair decision. **Shoe (8.3):** a shoe that runs out mid-round reuses its discards, then reshuffles before the next round. **Gates (6.3):** scope, pair rows and two agreed chart exceptions. Tier 1 results are unchanged: a Tier 1 shoe never runs out mid-round. |
| 2.7 | 2026-11-08 | Phase 8 dashboard decisions, agreed with the project owner. **Rankings by goal (10.10):** metric, interval and verdict rules for the five goals. **Bet progression (10.1, 10.2):** new `checkpointBet` field (bet in each checkpoint round, `null` once stopped) with exact mean and 95th percentile among strategies still playing; at most 20 checkpoints (section 9) to bound memory. **Summary additions (10.2, 10.3):** share at or above break-even with its Wilson interval, exact drawdown percentiles, checkpoint mean interval, and 25th/75th checkpoint percentiles. No change to any simulated result. |
| 2.8 | 2026-11-08 | Phase 8 export decisions, agreed with the project owner. **CSV conventions (10.5):** statistics are rounded to whole cents with halves away from zero, on screen and in the reports alike; non-money averages have two decimals; CRLF line endings, no byte-order mark, RFC 4180 quoting. **CSV 2 (10.7):** new `run_status` column after `experiment_id`, as 10.5 already required. **HTML report (10.8):** contents and the offline rule. No change to any simulated result. |
