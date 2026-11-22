# Blackjack Betting Simulator — Project Plan v2

*Status: revised MVP plan, supersedes v1. Date: 7 November 2026. All review questions are answered; decisions below are final unless listed as an assumption in section 17.*

## 1. Overview

A browser-based Monte Carlo simulator that compares blackjack betting systems while the player uses perfect basic strategy on every decision, with no mistakes. The user chooses table rules, bankroll, limits, stop conditions and strategies. The app runs thousands of simulations in parallel Web Workers, shows live statistics, can be stopped at any moment, and finishes with an interactive comparison plus two downloadable reports (a standalone HTML file and CSV files). It is a personal project: no real money, no accounts, no backend.

**Key interpretation.** A betting progression changes how much is wagered, not the probability of any hand. Every system faces the same house edge per unit wagered (roughly 0.4–0.5% for common rules). Progressions only reshape the distribution of outcomes: many small wins with rare large losses, or the reverse. The app therefore never declares a single winner; it ranks systems per goal and labels every ranking “best under this configuration”.

| Goal | Question | Primary evidence |
| --- | --- | --- |
| 1 | Best overall strategy under perfect basic strategy | Return per unit wagered, mean and median profit, volatility, drawdown |
| 2 | Minimal loss most of the time | Median result, 5th percentile, probability of ending at or above break-even, bust rate |
| 3 | Maximum win most of the time | 75th and 95th percentile profit, mean profit of winning simulations, largest win, with the downside tail shown beside it |
| 4 | Reaching 0.5x, 1x, 2x or 2.5x | First-crossing hit rate for each target, rounds to target, bust before target |
| 5 | Ahead or behind after N rounds; biggest losers | Mean, median, percent profitable and 5th–95th range at user-chosen round checkpoints |

## 2. Confirmed decisions

| Topic | Decision |
| --- | --- |
| Strategies | Flat, Martingale, Paroli (classic, 1-2-4), Paroli (1-3-2-6), Oscar’s Grind; registry open to more |
| Classic Paroli | 3-win streak, then reset; streak length is a setting defaulting to 3 |
| Player skill | Perfect basic strategy every decision; no mistake option |
| Targets | Percentages of the starting bankroll (0.5x, 1x, 2x, 2.5x), net profit |
| Compare-all-targets mode | Included |
| Strategy stops | A strategy that stops (target reached or bust) takes no further bets; the others keep playing; the simulation ends when every strategy has stopped |
| Bust | The strategy cannot fund its required next bet (bankroll may be above zero) |
| Table maximum | Optional field; blank means no maximum |
| Defaults | Bankroll 500, table minimum 20 |
| Rules scope | All configurable options listed in section 5, delivered in tiers |
| Reports | Standalone interactive HTML report plus two CSV files (summary and per-simulation) |

## 3. Scope and definition of done

**In the MVP:** configurable multi-deck blackjack; rule-matched perfect basic strategy; five betting systems; parallel Web Worker pool; live dashboard; Stop All; interactive final dashboard; HTML and CSV reports; JSON configuration download; free static hosting.

**Not in the MVP:** real-money features, card counting, side bets, insurance experiments, multiplayer, server-side simulation, cloud accounts, dealer no-hole-card (European) rules.

**Done when:**

- Each betting system follows a documented, unit-tested rule.
- Basic strategy changes correctly with the selected rules and matches published charts.
- Flat betting over a very large run reproduces the published house edge for the rule set, within statistical error.
- Results are reproducible from a saved seed.
- The interface stays responsive while workers run; Stop All halts work promptly and marks the run cancelled, never completed.
- Both reports download and open correctly; the site runs over HTTPS on a free tier.

## 4. Simulation model

### 4.1 Terminology

- **Simulation:** one seeded run in which every selected strategy plays from the same starting bankroll. The “number of simulations” input is the number of these runs.
- **Round:** one initial player hand and everything it triggers (splits, doubles, dealer play, payouts). Net round profit is the sum of all wagers and payouts. A progression advances once per round, not once per split hand.
- **Win / loss / push for progressions:** decided by the sign of net round profit (above zero win, below zero loss, zero push). This covers blackjacks, doubles, splits and surrender.

### 4.2 Simulation group

Each strategy in a simulation has its own bankroll, its own betting state and its own copy of the shoe created from the same seed. All strategies therefore see identical cards unless a bankroll shortage changes a double or split decision for one of them, in which case the paths may diverge and the app records that. Strategies never influence each other.

Each strategy keeps playing until it hits one of its own stop reasons. A stopped strategy freezes its final profit and takes no further bets. The simulation finishes when every selected strategy has stopped. The round limit applies to each strategy, so the simulation always ends.

### 4.3 Stop reasons (per strategy)

1. **Target reached:** cumulative net profit reaches or exceeds the active target (see 4.4).
2. **Bust:** the strategy cannot fund its required next bet.
3. **Blocked by table maximum:** the required next bet exceeds the optional table maximum. No further betting is allowed; bets are never silently capped.
4. **Round limit reached.**

Stop All is different. It cancels the whole experiment, including queued simulations, and is shown as “cancelled”, never as a normal outcome. Partial results from a cancelled run are labelled as partial.

### 4.4 Profit targets

Targets are multiples of the starting bankroll and measure net profit. With a 500 bankroll: 0.5x is +250, 1x is +500, 2x is +1,000 and 2.5x is +1,250. The app shows these amounts and the matching bankroll before the run starts.

Three target modes:

- **No target:** simulations end at the round limit, bust or table block.
- **Single target:** each strategy stops when it reaches the chosen multiple. First-crossing rounds are also recorded for any lower thresholds.
- **Compare all four targets:** each strategy runs until it reaches 2.5x. The first round at which it crosses 0.5x, 1x, 2x and 2.5x is recorded separately. Final-profit statistics in this mode are capped at 2.5x and the report says so.

With a target active, final-profit statistics are truncated on the upside and are not directly comparable to a no-target run. Round-checkpoint charts carry a stopped strategy’s frozen profit forward, and this is labelled.

### 4.5 Bankroll and limits

- **Starting bankroll** (default 500), **table minimum** (default 20) and **starting bet / base unit** (default equal to the table minimum, editable but never below it).
- **Table maximum:** optional. Blank means only the bankroll limits bets.
- Example: Martingale at 20 with a 500 bankroll funds bets of 20, 40, 80 and 160, then busts holding 200 because it cannot fund 320.
- All money is stored as integers in the smallest currency unit. Floating point is never used for accounting. Currency defaults to AUD.

### 4.6 Doubles and splits when funds are short

If the bankroll cannot fund a double or split that basic strategy calls for, the engine plays the best remaining legal action from the chart (for example hit or stand) and counts the occurrence. The count appears in the results and is exported.

## 5. Table rules and basic strategy

| Setting | Default | Options |
| --- | --- | --- |
| Decks | 6 | 1, 2, 4, 6, 8 |
| Dealer on soft 17 | Stands (S17) | S17 / H17 |
| Blackjack payout | 3:2 | 3:2 / 6:5 |
| Doubling | Any first two cards | Any two, 9–11, 10–11 |
| Double after split | Allowed | On / off |
| Late surrender | Off | On / off |
| Maximum split hands | 4 | 2–4 |
| Split aces | One card each, no re-split | Configurable (Tier 2) |
| Dealer peek | American hole card with peek | Fixed in the MVP |
| Insurance | Never taken | Fixed |
| Shoe penetration | 75% | Configurable |

Basic-strategy tables are generated per rule set by an exact expected-value solver and cached, instead of hand-copying charts. Each generated table is checked against published charts, and each supported rule set is checked against its published house edge. A 6-deck S17 table must never be reused for H17.

**Delivery tiers.** Each tier is validated before its options appear in the UI.

- **Tier 1:** 6 and 8 decks, S17/H17, double after split on/off, 3:2 and 6:5.
- **Tier 2:** 1, 2 and 4 decks, late surrender, double restrictions, split limits, split-ace rules.
- **Tier 3:** shoe penetration options and polish.

## 6. Betting strategies

A strategy decides only the next initial wager. It never changes any hand-playing decision. All strategies share the same base unit, limits, bankroll and seeds. All progressions use the win / loss / push definition in 4.1.

**6.1 Flat betting.** Bet the base unit every round. The baseline in every comparison.

**6.2 Martingale.** Start at one unit. After a loss, double the next bet. After a win, reset to one unit. After a push, repeat the bet. If the required bet exceeds the bankroll the strategy busts; if it exceeds the table maximum it is blocked. No silent capping.

**6.3 Paroli (classic, 1-2-4).** Start at one unit. After a win, double the bet. After the configured number of consecutive wins (default 3), reset to one unit. After any loss, reset to one unit. After a push, keep the current step. Streak length is a documented setting.

**6.4 Paroli (1-3-2-6).** Bet 1 unit. After each win advance through 3, 2 and 6 units. After any loss, or after completing the sequence, reset to 1. After a push, keep the step.

**6.5 Oscar’s Grind (blackjack-adapted variant).** Labelled as a variant because blackjack pays 3:2 and has doubles and splits.

- Track profit for the current cycle; start a cycle at one unit.
- After a loss or push, keep the same bet.
- After a win, raise the bet by one unit, but never above the amount needed to reach the one-unit cycle goal on a normal even-money win. If the table minimum prevents an exact amount, use the minimum and record the overshoot.
- When cycle profit reaches one unit or more, close the cycle and reset to one unit.
- Cycle progress uses actual net round profit.
- A variant identifier is saved with results so alternative interpretations can be compared later.

**6.6 Extensibility.** Strategies sit behind a small interface: initialise state, calculate the next bet from state and bankroll, receive the round’s net result, update state, and explain why a bet cannot be placed. Each new strategy needs a written rule, a version identifier and table-driven tests before it appears in the UI. An “About this system” panel states each rule and its main risk.

## 7. Metrics and rankings

### 7.1 Per-strategy statistics

- Simulations by final status: target reached, bust, blocked, round limit, cancelled.
- Percent of simulations ending in profit, break-even and loss.
- Mean, median and standard deviation of simulation profit; 5th, 25th, 75th and 95th percentiles.
- **Return per unit wagered** (net profit divided by total wagered) with a confidence interval. This is the key fairness metric and should land near the house edge for every system.
- Total wagered, average and maximum single wager, average rounds played.
- Largest win, largest loss, maximum and average maximum drawdown.
- Hit rate and average rounds for each target threshold; bust rate before each target.
- Blackjack, player-win, dealer-win and push frequencies.
- Count of double/split actions unavailable because of funds.

### 7.2 Rankings by goal

Rankings follow the table in section 1, always shown with supporting metrics and the label “best under this selected configuration”. Mean profit in currency mostly follows how much a system wagers, so flat betting at the minimum will tend to lose least by that measure. The app shows return per unit wagered beside it so this is not mistaken for a better strategy.

### 7.3 Statistical reliability

Show the number of simulations beside every percentage and average. Use Wilson intervals for proportions and a confidence interval for means and for return per unit wagered. Differences inside the intervals are described as inconclusive, and small samples trigger a warning.

### 7.4 Round checkpoints (Goal 5)

The user sets checkpoint rounds (default 50, 100, 250, 500, 1,000, limited to the round limit). At each checkpoint the app reports mean and median profit, percent profitable, 5th–95th percentile range, and worst loss. “Which loses most” is read from mean loss and the 5th percentile at each checkpoint. Checkpoint data is stored as running sums plus fixed-bin histograms, to keep memory bounded. Final-result percentiles are computed exactly from compact typed arrays of one value per simulation.

## 8. User experience

### 8.1 Setup screen

- **Simulation size:** number of simulations, rounds per simulation, seed (auto or manual), presets.
- **Bankroll and limits:** starting bankroll, table minimum, starting bet, optional table maximum, currency.
- **Stop conditions:** target mode (none, single, compare all four), target multiple with the calculated amount and bankroll, and the text “Each strategy stops at whichever comes first: round limit, profit target, or inability to place its next bet.”
- **Table rules:** all options in section 5 with a “Recommended baseline” preset.
- **Strategies:** checkboxes for all five, select all, reset, info icons; Paroli streak length setting.
- **Checkpoints:** list of rounds for Goal 5.
- **Simulations shown on screen (n):** how many simulations get their own comparison panel. Default 6, maximum 25, minimum 1, and never more than the number of simulations.
- **Performance:** worker count Auto or 1–4, with an explanation that simulations are not threads.
- **Pre-run summary:** total rounds of work and an estimated runtime, and a warning if over budget.

### 8.2 Live screen

- Overall and per-strategy progress, completed simulations, rounds per second, elapsed time.
- Per-strategy live counts of strategies still playing, targets reached, busts, and blocks.
- Provisional mean profit, win rate, target-hit rates and average bet.
- **Per-simulation comparison grid:** one small chart panel for each of the n simulations shown (simulations 1 to n). Each panel overlays the bankroll curves of every chosen strategy in that simulation, so they can be compared on the same cards. A panel fills in as soon as its simulation finishes; simulations finish in milliseconds, so they are not animated round by round and the run is never slowed for display. A strategy that stops early has its line end with a marker naming the stop reason. Clicking a panel enlarges it with tooltips and zoom.
- Live profit histogram built from aggregates.
- Worker pool status and a prominent Stop All button.
- Updates every 250–500 ms from compact worker summaries; never per hand.

### 8.3 Final dashboard (interactive)

1. Summary cards.
2. Sortable comparison table with ranking explanations.
3. Cumulative profit at checkpoints with percentile bands.
4. Final profit distribution (histogram or box plot).
5. Target attainment chart for 0.5x, 1x, 2x and 2.5x.
6. Drawdown distribution.
7. Bet progression chart.
8. Per-simulation comparison grid (the same n panels as the live screen).
9. Sample-simulation table with seed, rounds, final profit, maximum bet and stop reason.

Interactions: hover tooltips, strategy toggles, zoom and pan, series selection, and click-through from a summary to its sample simulations. Cancelled runs are clearly marked partial.

### 8.4 Reports

**Standalone interactive HTML report.** A single self-contained file with the chart library and data embedded. It opens offline with working tooltips, toggles and zoom. It contains configuration and seed, the comparison table, charts, target attainment, checkpoint data, and a bounded sample of simulations (up to 500 per strategy) to keep the file a few megabytes. It states whether the run was complete or partial.

**CSV file 1 — summary** (one row per strategy): strategy id and version, simulations, status counts, profit mean, median, standard deviation and percentiles, return per unit wagered with interval, total wagered, average and maximum wager, drawdown, target hit rates and average rounds per threshold, bust and block rates, and win/loss/push frequencies.

**CSV file 2 — per simulation** (one row per simulation per strategy): simulation id, seed, strategy id and version, rounds played, final bankroll, net profit, total wagered, maximum wager, maximum drawdown, first-crossing round for each target (blank if not reached), stop reason, count of unavailable double/split actions. Large exports warn the user and are written in chunks so the interface does not freeze.

Also available: a JSON download of the configuration and seed so a run can be repeated. Recent experiment summaries are kept in browser storage.

## 9. Technology and parallel design

| Layer | Choice | Reason |
| --- | --- | --- |
| Language | TypeScript | Type safety for money, rules, messages and strategy state |
| UI | React + Vite | Clear components and simple worker bundling |
| Styling | Tailwind CSS (shadcn/ui only if needed) | Maintainable styling |
| State | React state; Zustand only if sharing becomes painful | Keep it simple |
| Charts | Apache ECharts | Interactive legends, zoom, tooltips; embeddable in the HTML report |
| Concurrency | Browser Web Workers, bounded pool | Keeps the UI thread free |
| Validation | Zod | Validate inputs and imported configurations |
| Testing | Vitest first; Playwright later | Engine correctness matters most |
| Quality | ESLint + Prettier | Readability |
| Hosting / CI | Cloudflare Pages + GitHub Actions | Free static hosting and automatic checks |

**Worker pool.** TypeScript compiles to JavaScript that runs inside Web Workers; the workers provide the parallelism. Use a fixed pool of up to 4, defaulting to the lesser of 4 and the logical core count minus one (at least 1), with a manual 1–4 setting. Work is split into chunks sized to roughly 100–200 ms so cancellation is prompt, and chunks are queued to free workers. Workers aggregate results and send compact progress messages. On Stop All the controller cancels the queue, signals active workers and, as a backstop, terminates and recreates them. A crashed chunk is marked failed or re-queued without double counting. Avoid SharedArrayBuffer in the MVP. A browser cannot be limited to a CPU percentage; “Low CPU” simply means 1–2 workers.

**Limits (confirmed as final by the Phase 9 benchmark, spec 2.9; see `docs/performance.md`):**

| Limit | Value |
| --- | --- |
| Parallel workers | 4 |
| Simulations per experiment | 50,000 soft cap; default 5,000 |
| Rounds per simulation | 10,000 maximum; default 1,000 |
| Total work (simulations × strategies × rounds) | About 100 million rounds; the estimate is shown before the run |
| Simulations shown on screen (n) | Default 6, maximum 25 (so at most 25 curves per strategy) |
| Dashboard refresh | Every 250–500 ms |

The cap is on total rounds rather than only on simulations, because the same simulation count at 10,000 rounds is twenty times the work. The live screen shows aggregates and a sample of curves; it never draws every simulation.

## 10. Architecture, data and randomness

```text
React UI (main thread)
   |  inputs, run and stop commands
   v
Experiment controller: validate, create seeds, queue chunks
   v
Bounded worker pool (1–4)
   +-- Blackjack engine: shoe, dealing, rule-aware basic strategy, settlement
   +-- Betting strategies: flat, Martingale, Paroli x2, Oscar’s Grind
   +-- Simulation-group runner and metrics aggregator
   |  compact progress and final summaries
   v
Results store -> live dashboard, final charts, HTML and CSV reports, history
```

The engine, strategies and statistics are plain TypeScript with no React imports, so they can be tested alone.

**Randomness.** Model a real shoe with shuffle without replacement and reshuffle at the penetration point. Use a seeded pseudorandom generator inside workers, with deterministic child seeds per simulation and chunk. A cryptographic source may create the initial seed only. Every strategy in a simulation receives its own shoe created from the same simulation seed (paired seeds). Record all seeds in exports.

**Possible later optimisation.** Because round outcomes in bet units do not depend on bet size, one generated outcome stream per seed could be replayed for every strategy, cutting compute roughly in proportion to strategy count. It needs special handling where a double or split is unaffordable, so benchmark before adopting it.

**Data model** (typed before any screens):

- **Configuration:** experiment id, seed, strategy ids and versions, simulations, rounds, bankroll, table minimum, base bet, optional maximum, target mode and multiple, rules, checkpoint rounds, worker count.
- **Strategy result per simulation:** simulation id, strategy id, seed, rounds played, starting and final bankroll, net profit, total wagered, round outcome counts, maximum and average wager, maximum drawdown, first-crossing rounds for each target, stop reason, unavailable-action count.
- **Strategy state:** step or current wager, cycle profit for Oscar’s Grind, sequence index. The blackjack engine never reads it.
- **Live aggregates:** simulations completed, rounds, sum and sum of squares of profit, status counts, target hits, bounded sample of simulations.

## 11. Roadmap

Build in this order. Each phase ends with a deliverable and exit criteria, and the next phase starts only when they pass and lint, type-check and tests are green. Correct simulation logic matters more than visual polish, so the engine comes before the interface.

**Building with Claude Code.** The project is built with Claude Code. `CLAUDE.md` at the repository root holds the standing rules and is loaded automatically in every session. `docs/spec.md` is the frozen simulation specification that code and tests are checked against. Each phase follows the same loop:

1. Start a fresh session per phase (or per large task) and name the phase and the spec sections it covers.
2. For anything touching more than a couple of files, use plan mode first and agree the plan before code is written.
3. Write the table-driven tests from the spec's worked examples first, then the implementation.
4. Before calling a task done, Claude runs `npm run lint`, `npm run typecheck` and `npm test` and reports the real output.
5. Work on a branch per phase, in small commits. Claude commits or pushes only when asked.
6. At the end of the phase, update `CLAUDE.md` with anything learned (new commands, pitfalls, decisions) and tick the phase in its status section.

### Phase 1 — Specification freeze

**Tasks**

1. Freeze this document as the versioned simulation specification (v2.0).
2. Write a worked example for each strategy: a table of round results (win, loss, push, blackjack, split with mixed result) against the next bet, using the 500 / 20 defaults.
3. Fix the exact definitions of round, win/loss/push, stop reasons, target modes and first-crossing.
4. Fix the CSV column lists and the results data schema.
5. Choose a version identifier for every strategy (for example flat-v1, martingale-v1, paroli-classic-v1, paroli-1326-v1, oscars-grind-bj-v1).
6. Confirm the assumptions in section 17.

**Deliverable:** a spec file in the repository whose worked examples double as golden test data.

**Exit criteria:** two people reading the spec calculate the same next bet for the same history.

### Phase 2 — Foundation and early deployment

**Tasks**

1. Create the GitHub repository and scaffold React + TypeScript + Vite with TypeScript strict mode on.
2. Add ESLint, Prettier and Vitest, with scripts for dev, build, preview, lint, typecheck, test, and a separate long-running benchmark script for house-edge checks.
3. Create the folder structure from section 10 and add a lint rule that the engine folders never import React or browser-only APIs.
4. Add Tailwind CSS, the basic page layout, the Zod configuration schema and the shared types (money as integer minor units).
5. Keep `CLAUDE.md` (supplied alongside this plan) at the repository root, where Claude Code loads it automatically. Add `.claude/settings.json` (checked in) that allows the project's npm scripts and read-only git commands without prompts. Once `src/engine` exists, move engine-only guidance (hot-path performance, determinism details) into `src/engine/CLAUDE.md`, which Claude Code loads when working in that folder, to keep the root file short. Add a pull-request template with a checklist: tests added, spec section referenced.
6. Add GitHub Actions to run lint, typecheck, tests and build on every pull request.
7. Connect Cloudflare Pages and deploy the empty shell now, to prove the pipeline before there is anything to lose.

**Deliverable:** a deployed shell with a stub setup screen.

**Exit criteria:** CI is green, the site loads over HTTPS, and a deliberate engine-imports-React change is blocked by lint.

### Phase 3 — Blackjack engine (rules Tier 1)

**Tasks**

1. Implement the seeded random generator (a small, fast, well-known algorithm), deterministic child-seed derivation, and shuffle without replacement.
2. Implement cards, the multi-deck shoe, cut-card penetration and reshuffle, and hand values (soft and hard totals, aces).
3. Implement dealer play for S17 and H17, and dealer peek: a dealer blackjack ends the round before the player acts, and only the original bet is lost.
4. Implement settlement: win, loss, push, bust, blackjack at 3:2 and 6:5, double down, split with the maximum number of hands, double after split, split-ace handling.
5. Implement the expected-value solver that generates the basic-strategy tables (hard totals, soft totals, pairs against each dealer upcard) for each rule set, and cache the results.
6. Implement the funds-short fallback (best remaining legal action) and the counter for unavailable doubles and splits.
7. Keep all money as integers and return each round’s net profit and total wagered.

**Deliverable:** a standalone `playRound` function that plays and settles one round for any Tier 1 rule set and a given bet.

**Exit criteria:**

- Unit tests cover hard and soft totals, pairs, aces, dealer blackjack, pushes, splits, doubles, natural payouts and reshuffling.
- Generated tables match published charts for every Tier 1 rule set.
- **House-edge gate:** a flat-betting run of tens of millions of rounds reproduces the published house edge for each Tier 1 rule set within statistical error. Do not continue until this passes.

### Phase 4 — Betting strategies

**Tasks**

1. Define the strategy interface and registry from section 6.6.
2. Implement Flat, Martingale, Paroli (classic, with the streak-length setting), Paroli (1-3-2-6) and Oscar’s Grind (blackjack-adapted variant).
3. Implement the limit rules: a required bet above the bankroll is a bust, a required bet above the optional table maximum is a block, and nothing is ever silently capped.
4. Apply the win / loss / push definition (sign of net round profit) in one shared place so every strategy uses it.
5. Add a short “about this system” description and version identifier to each strategy.

**Deliverable:** five strategies that give the next bet and update their state after each round.

**Exit criteria:** table-driven tests verify every transition after a win, loss, push, blackjack and a mixed split round, matching the Phase 1 worked examples; property tests confirm no bet is ever below the table minimum, above the bankroll or above the maximum without a recorded stop reason.

### Phase 5 — Simulation-group simulator and statistics

**Tasks**

1. Run one simulation: every selected strategy gets its own bankroll, betting state and shoe created from the same simulation seed.
2. Let each strategy stop independently (target reached, bust, blocked, round limit), freeze its profit, and end the simulation when all have stopped.
3. Implement the three target modes, recording the first round at which each threshold is crossed.
4. Track total wagered, maximum wager, maximum drawdown, outcome counts and the unavailable-action counter.
5. Record profit at the user-chosen checkpoint rounds, carrying frozen profit forward for stopped strategies.
6. Implement online statistics (running mean and variance), exact percentiles from compact typed arrays, fixed-bin histograms for checkpoints, Wilson intervals and the return-per-unit-wagered interval.

**Deliverable:** a deterministic simulation result and an aggregate summary for any configuration, with no UI.

**Exit criteria:** the same seed and configuration give identical results; final bankroll equals starting bankroll plus net profit to the cent; first-crossing rounds are correctly ordered; aggregates match a hand calculation on a small known set.

### Phase 6 — Worker pool and thin vertical slice

**Tasks**

1. Define typed worker messages (start chunk, progress, chunk result, cancel, error).
2. Build the worker entry point and a fixed pool of up to four workers, with the Auto worker-count rule.
3. Split the run into chunks of roughly 100–200 ms, queue them, and merge chunk results on the main thread.
4. Throttle progress messages to every 250–500 ms.
5. Implement Stop All: cancel the queue, signal active workers, terminate and recreate them as a backstop, and mark the run cancelled with partial results labelled.
6. Handle worker errors by failing or re-queuing the chunk without double counting.
7. Build a minimal interface: a few setup inputs, a progress bar, a Stop All button and one chart, so the whole pipeline works end to end.

**Deliverable:** a working end-to-end run in the browser, small but complete.

**Exit criteria:** the page stays responsive during a long run; Stop All halts work within about a second; identical seeds give identical aggregates with 1, 2 or 4 workers; a new run works after a cancellation.

### Phase 7 — Rules Tier 2 and Tier 3

**Tasks**

1. Add 1-, 2- and 4-deck rule sets, late surrender, double restrictions, split limits and split-ace options to the solver and engine.
2. For each new option: regenerate tables, compare with published charts, and run the house-edge check.
3. Add shoe penetration options and the matching UI controls only after each option passes.

**Deliverable:** every configurable rule in section 5 available and validated.

**Exit criteria:** each option has table tests and a passed house-edge check recorded in the repository.

### Phase 8 — Dashboards and reports

**Tasks**

1. Complete the setup screen: all inputs, validation messages, calculated target amounts and the pre-run work and runtime estimate with the budget warning.
2. Build the live screen: per-strategy progress and status counts, provisional statistics, the per-simulation comparison grid (n panels, default 6, maximum 25), live histogram, worker status and Stop All.
3. Build the final dashboard: summary cards, sortable comparison table with ranking explanations, checkpoint chart with percentile bands, distribution, target attainment, drawdown, bet progression and sample simulations, with toggles, zoom and click-through.
4. Add confidence intervals, small-sample warnings and “best under this configuration” wording.
5. Build the standalone HTML report: one file with the chart library, report styling and data embedded, opening offline with working interactions.
6. Build both CSV files (summary and per-simulation), written in chunks with a size warning, and the JSON configuration download.
7. Save recent experiment summaries in browser storage.

**Deliverable:** the complete experience from setup to downloadable reports.

**Exit criteria:** numbers in the reports match the on-screen numbers; the HTML report works with the network disabled; CSV columns match the spec; cancelled runs are clearly marked partial.

### Phase 9 — Performance, correctness and usability

**Tasks**

1. Benchmark 500, 5,000, 20,000 and 50,000 simulations with 1, 2, 3 and 4 workers, and record rounds per second.
2. Test on a low-power laptop and a typical desktop; profile main-thread responsiveness, memory and message frequency.
3. Set the final caps for simulations, rounds and total work from the measurements.
4. Cross-check results against independent reference calculations where possible.
5. Check accessibility, keyboard use, responsive layouts and the main browsers (Chrome, Firefox, Safari, Edge).
6. Test cancelling a heavy run, then starting a fresh one.

**Deliverable:** a short benchmark report and the final safe default limits.

**Exit criteria:** the defaults run comfortably on the low-power device; no memory growth across repeated runs; no accessibility blockers.

### Phase 10 — Deploy and document

**Tasks**

1. Confirm the Cloudflare Pages build command, output folder, Node version and production branch.
2. Write the README: local setup, scripts, architecture, testing, deployment, and how to run the house-edge benchmark.
3. Add the in-app methodology page: rules, strategy definitions, statistical limits and the disclaimer that no betting system changes the house edge.
4. Re-read `CLAUDE.md` (and any nested `CLAUDE.md` files) against the finished code and update it: remove rules that no longer apply, correct paths and commands, and keep it concise.
5. Test the deployed site on desktop and mobile browsers.

**Deliverable:** the live HTTPS application on a free tier, with documentation.

**Exit criteria:** a fresh clone builds and passes tests from the README alone; the production site passes the browser checks.

## 12. Testing and validation

**Unit:**

- Ace handling, soft and hard totals, dealer S17/H17 behaviour, blackjack payouts for 3:2 and 6:5, pushes.
- Doubles and splits fully accounted; strategy decisions match the selected rule chart.
- Every progression transitions correctly, including the Paroli streak setting.
- No bet is placed below the minimum, above the bankroll or above the maximum without a recorded stop.
- Integer money arithmetic.

**Simulation and integration:**

- Final bankroll equals starting bankroll plus net profit.
- Same seed and configuration give the same result; paired seeds are consistent across strategies.
- Strategies stop independently; a stopped strategy’s profit is frozen; the simulation ends only when every strategy has stopped.
- First-crossing rounds are correct and ordered (0.5x no later than 1x, and so on).
- Aggregates match a hand calculation on a small known set.
- Flat betting reproduces the published house edge within confidence intervals.
- Reports match on-screen figures, and CSV columns match the specification.

**Browser:** main thread stays responsive, message volume is controlled, Stop All cancels active and queued chunks, worker failures show clearly, large exports do not freeze the page, and the deployed HTTPS site works.

## 13. Hosting

Cloudflare Pages serves the static Vite build, GitHub holds code and runs checks, simulations run in the visitor’s browser, and preferences and recent summaries live in browser storage. There is no backend, database or paid compute. A custom domain is optional and may cost money. Check current free-plan limits before deployment; they are far above this app’s needs. Free serverless functions are unsuitable because of their very small per-request CPU allowance.

## 14. Risks

| Risk | Mitigation |
| --- | --- |
| Wrong basic-strategy tables | EV solver, published-chart comparison, house-edge validation gate per rule set |
| Ambiguous progression definitions | Published exact rules, versioned strategy ids |
| Misleading dollar rankings | Show return per unit wagered; label rankings by configuration |
| Target truncation distorts statistics | Separate target modes; label capped results |
| Strategies diverge through unaffordable doubles | Record unavailable-action counts |
| Small samples | Show counts, confidence intervals and warnings |
| Browser overload | Worker cap, total-round budget, throttled updates, bounded live curves |
| Memory growth | Online statistics, typed arrays, histograms, chunked export |
| Floating-point money errors | Integer currency units |
| Oversized HTML report | Bounded simulation sample, embedded data only |

## 15. Future enhancements

D’Alembert, Fibonacci and percentage-of-bankroll systems; a custom strategy builder; capped-bet variants (such as capped Martingale) as separately named strategies; dealer no-hole-card rules; simulation replay; comparing two experiments side by side; shared outcome-stream optimisation; optional WebAssembly engine if profiling demands it; cloud save and share.

## 16. Initial defaults

| Setting | Default |
| --- | --- |
| Strategies | Flat, Martingale, Paroli (classic), Paroli (1-3-2-6), Oscar’s Grind |
| Starting bankroll | 500 |
| Table minimum / starting bet | 20 / 20 |
| Table maximum | None (optional) |
| Simulations | 5,000 |
| Rounds per simulation | 1,000 |
| Target mode | None; user can choose single target or compare all four |
| Paroli classic streak | 3 |
| Rules | 6 decks, S17, 3:2, double after split, no surrender, 75% penetration |
| Checkpoints | 50, 100, 250, 500, 1,000 |
| Simulations shown on screen | 6 (maximum 25) |
| Workers | Auto, maximum 4 |
| Currency | AUD |

With the defaults, total work is 5,000 × 5 × 1,000 = 25 million rounds. Expect high targets (2x and 2.5x) to be reached rarely by slow systems like flat betting; that is a valid finding, not a bug.

## 17. Assumptions to confirm

1. “Blocked by table maximum” is reported separately from “bust”.
2. Default checkpoints are 50, 100, 250, 500 and 1,000 rounds.
3. European no-hole-card rules stay out of the MVP.
4. Per-simulation CSV covers every simulation; the HTML report embeds only a sample.
