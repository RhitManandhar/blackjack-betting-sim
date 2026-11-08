# CLAUDE.md — Blackjack Betting Simulator

Claude Code loads this file automatically from the repository root. It holds the standing rules for every session.

- **Source of truth:** `docs/spec.md`, the frozen simulation specification (v2.7), with exact definitions, schemas, CSV columns and worked examples. If code and spec disagree, flag it instead of silently choosing one.
- **Roadmap, UX and hosting:** `docs/project-plan-v2.md`.
- The spec is long, so it is not imported here. Read the sections relevant to the task before writing engine, strategy or statistics code.

## Current status

- Phase 1 (specification freeze): **done** 2026-11-07. `docs/spec.md` v2.0 frozen; D1–D19 and A1–A4 confirmed. v2.1 (2026-11-08) renamed "session" to "simulation" (terminology only).
- Phase 2 (foundation): **done** 2026-11-08. Merged to `main` (PR #1), CI green, live on Cloudflare Pages over HTTPS.
- Phase 3 (blackjack engine, rules Tier 1): **done** 2026-11-08 on branch `phase-3-engine` (spec v2.2, pins P1–P6). Chart gate and house-edge gate pass for all 16 Tier 1 rule sets; see `docs/validation.md`. Merged to `main` (PR #2); deploys use `wrangler.jsonc` (static assets, `previews` block for branch previews).
- Phase 4 (betting strategies): **done** 2026-11-08, merged to `main` (PR #3). Spec v2.3 corrected an Oscar's Grind note.
- Phase 5 (simulation runner and statistics): **done** 2026-11-08, merged to `main` (PR #4). Spec v2.4 pins the checkpoint histogram layout and the curve-point bet field. Runner throughput is about 1.23 µs per round.
- Phase 6 (worker pool and end-to-end slice): **done** 2026-11-08, merged to `main` (PR #5) and live. Spec v2.5 adds the `failed` run status. Only simulation 1's panel is drawn; the n-panel grid is deferred to Phase 8. Run always starts a fresh experiment.
- Phase 7 (rules Tier 2 and Tier 3): **done** 2026-11-08, merged to `main` (PR #6). Spec v2.6. Both gates pass for every option; two pinned chart exceptions (`docs/validation.md`).
- Phase 8 (dashboards and reports): **in progress** in three slices: 8a setup screen (done, merged PR #7), 8b live screen and dashboard (done on branch `phase-8b-dashboard`, not yet merged; spec v2.7; checkpoints capped at 20, user-approved), 8c exports. Agreed 2026-11-08: goal rankings (spec v2.7); bet progression from per-checkpoint bets across all simulations; keep the last 10 experiment summaries in browser storage.
- Known: `npm audit` reports a moderate `minimatch` advisory inside ESLint tooling only (dev dependency; `npm audit --omit=dev` is clean). The only fix downgrades ESLint 10 to 9, so it is deliberately left. Recheck when ESLint updates.

Update this section at the end of each phase.

## How to work in this repo

- Work one roadmap phase at a time. Name the phase and the spec sections a task covers before starting.
- For changes touching more than a couple of files, present a plan and wait for agreement before editing.
- Tests first: turn the spec's worked examples (section 7) into table-driven tests, then implement.
- A task is done only after `npm run lint`, `npm run typecheck` and `npm test` pass. Report the real output; never claim a pass that was not run.
- Do not run `npm run bench:houseedge` unless asked. It is long-running.
- Commit or push only when asked. Use a branch per phase.
- When the spec is ambiguous or silent, ask. Do not invent behaviour. When behaviour changes, update `docs/spec.md` and add an entry to its changelog with a version bump.
- Keep this file concise. Put directory-specific guidance in nested `CLAUDE.md` files (for example `src/engine/CLAUDE.md`).

## Non-negotiable rules (read these first)

1. **Money is integer minor units** (cents). Never use floating point for bankroll, bets, payouts or profit. Format to currency only in the UI and reports. A 3:2 payout on an odd bet must be handled by an explicit, tested rounding rule, never by floats.
2. **The engine is deterministic.** Never call `Math.random()`, `Date.now()` or any crypto function inside `src/engine`. All randomness comes from the seeded generator passed in. The same seed and config must always produce identical results, regardless of worker count.
3. **`src/engine` is pure TypeScript.** It must not import React, the DOM, `window`, workers or any browser API. It runs inside Web Workers and in Node tests.
4. **A betting strategy decides only the next initial wager.** It never influences hit, stand, double, split or surrender. The player always plays perfect basic strategy for the selected rules. There is no mistake or deviation option.
5. **Never silently cap or adjust a bet.** If the required next bet exceeds the bankroll the strategy has gone bust; if it exceeds the optional table maximum it is blocked. Both stop that strategy, with the matching stop reason.
6. **Never send per-hand or per-card messages from workers.** Workers aggregate and send compact progress and chunk results only.
7. **No betting system changes the house edge.** Never write UI text, comments or variable names claiming a strategy is winning, guaranteed or beats the casino. Rankings are always worded “best under this selected configuration”.
8. **Every behavioural change needs a test.** Rules, strategy transitions and statistics are table-driven unit tests. Do not use snapshot tests for anything that depends on random output.

## Project summary

A personal, browser-only Monte Carlo simulator. The user picks table rules, bankroll, limits, stop conditions and betting strategies. Thousands of seeded simulations run in a bounded pool of Web Workers while a live dashboard shows progress. The user can stop everything. At the end the app shows interactive comparisons and offers a standalone interactive HTML report plus two CSV files. No backend, accounts, database or real-money features. Hosted as a static site on Cloudflare Pages (free tier).

## Tech stack

- TypeScript (strict mode), React, Vite
- Tailwind CSS (shadcn/ui only if a component is genuinely needed)
- Apache ECharts for all charts
- Zod for validating configuration and imported JSON
- Web Workers (bundled by Vite) for all simulation work
- Vitest for unit and integration tests; Playwright only later for browser tests
- ESLint and Prettier; GitHub Actions for CI; Cloudflare Pages for hosting
- Prefer plain React state. Add a state library only when sharing state becomes painful.
- Do not add a backend, database, server framework or `SharedArrayBuffer` use. Do not add dependencies without a clear reason; prefer the standard library and existing packages.

## Commands (keep these scripts working)

`npm run dev`, `npm run build`, `npm run preview`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run format` / `npm run format:check`, and `npm run bench:houseedge` (the house-edge gate in `scripts/house-edge/`, run through `vitest.houseedge.config.ts`; about 7 minutes for all 38 rule sets; `-- t2` for Tiers 2–3 only; not part of CI; `HOUSE_EDGE_ROUNDS` overrides the 50M rounds per rule set). `npm test` includes the chart gate for 60 rule sets (about 17 s, in parallel files). A change is not done until lint, typecheck and tests pass. CI also runs `format:check` and `build`. Node 24 (`.nvmrc`).

How the engine boundary is enforced (do not weaken either layer):

- `eslint/boundaries.js`: lint rules for `src/engine` and `src/shared`, covering no UI or worker imports, no browser globals, no `Math.random`, `Date` or `crypto`, and no `src/shared` → `src/engine` imports. `eslint/boundaries.test.ts` proves each rule fires.
- `tsconfig.engine.json`: type-checks `src/engine` and `src/shared` with no DOM lib, so browser globals do not compile there.
- Markdown is excluded from Prettier (`.prettierignore`) so the hand-aligned spec is never reformatted.

## Repository structure and boundaries

- `src/engine/blackjack` — cards, shoe, hand values, dealer play, round settlement
- `src/engine/basic-strategy` — expected-value solver, generated and cached strategy tables, decision lookup
- `src/engine/betting` — strategy interface, registry, the five strategies
- `src/engine/simulation` — seeded RNG, simulation-group runner, chunk runner
- `src/engine/statistics` — online mean and variance, percentiles, histograms, confidence intervals
- `src/workers` — worker entry point and typed message contracts
- `src/features/experiment` — setup form, validation, run controller, progress state
- `src/features/results` — dashboards, tables, charts, report and CSV export
- `src/shared` — money helpers, Zod schemas, shared types, constants
- `docs/spec.md` — the frozen specification and worked examples (golden test data)
- `docs/project-plan-v2.md` — the project plan and roadmap
- `docs/validation.md` — published charts and house-edge sources and gate results

Dependencies flow one way: UI and workers may import the engine; the engine imports only `src/shared`. Keep files small and functions single-purpose. Prefer clear names over comments; comment the reason for a rule, not what the line does.

## Core domain definitions

- **Round:** one initial player hand plus everything it triggers (splits, doubles, dealer play, payouts). Net round profit is the sum of all wagers and payouts. A progression advances once per round, never once per split hand.
- **Win / loss / push for progressions:** decided only by the sign of net round profit (above zero is a win, below zero a loss, exactly zero a push). This applies to blackjacks, doubles, splits and surrender alike.
- **Simulation:** one seeded run in which every selected strategy plays from the same starting bankroll. The “number of simulations” input is the number of these runs. A simulation contains up to `roundLimit` rounds per strategy; it is not a round count. Always say “simulation” for this, in code, UI, docs and exports. Never use “session” (it was renamed in spec 2.1 to avoid confusion).
- **Simulation group:** each strategy has its own bankroll, betting state and its own shoe created from the same simulation seed. Strategies never influence each other. Paths diverge only when a bankroll shortage changes a double or split for one strategy.
- **Independent stopping:** each strategy stops on its own; its final profit is frozen and it takes no further bets. The simulation ends when every selected strategy has stopped. The round limit applies per strategy, so simulations always end.
- **Stop reasons (per strategy):** `target_reached`, `bust` (cannot fund the required next bet; bankroll may still be above zero), `blocked_table_max` (required bet exceeds the optional table maximum), `round_limit`. A run cancelled by the user is `cancelled` at run level and is never mixed with normal outcomes.
- **Defaults:** bankroll 500.00, table minimum 20.00, starting bet equal to the table minimum, table maximum optional (blank means none), AUD.

## Profit targets

Targets are multiples of the starting bankroll and measure net profit: 0.5x, 1x, 2x, 2.5x (with a 500 bankroll: +250, +500, +1,000, +1,250). Three modes:

- **No target:** simulations end at round limit, bust or block.
- **Single target:** each strategy stops on reaching the chosen multiple. First-crossing rounds are still recorded for lower thresholds.
- **Compare all four targets:** each strategy runs to 2.5x; record the first round each of the four thresholds is crossed. Final-profit statistics in this mode are capped at 2.5x and must be labelled so.

Stopped strategies carry their frozen profit forward in round-checkpoint charts, and the UI says so.

## Betting strategies (exact rules)

Each strategy has a version identifier (for example `flat-v1`, `martingale-v1`, `paroli-classic-v1`, `paroli-1326-v1`, `oscars-grind-bj-v1`) saved with all results. The strategy interface: initialise state, compute the next bet from state and bankroll, receive the round’s net result, update state, and explain why a bet cannot be placed. Strategy state is small and explicit. Adding a strategy requires a written rule, a version id and table-driven tests before it appears in the UI.

| Strategy | Rule |
|---|---|
| Flat | Bet the base unit every round. |
| Martingale | Start at 1 unit. Loss: double. Win: reset to 1 unit. Push: repeat the bet. |
| Paroli (classic, 1-2-4) | Start at 1 unit. Win: double. After N consecutive wins (setting, default 3) reset to 1 unit. Loss: reset. Push: keep the current step. |
| Paroli (1-3-2-6) | Steps 1, 3, 2, 6 units. Win: advance. Loss, or completing step 6: reset to 1. Push: keep the step. |
| Oscar’s Grind (blackjack-adapted) | Track profit for the current cycle; start a cycle at 1 unit. Loss or push: keep the bet. Win: raise the bet by 1 unit, but never above what is needed to reach the one-unit cycle goal on a normal even-money win. If the table minimum prevents an exact amount, use the minimum and record the overshoot. When cycle profit reaches 1 unit or more, close the cycle and reset to 1 unit. Cycle progress uses actual net round profit. |

Classic Paroli and 1-3-2-6 are separate strategies. Never merge them or reuse one’s state logic for the other.

## Blackjack engine and basic strategy

- Default rules: 6 decks, dealer stands on soft 17, blackjack pays 3:2, double on any two cards, double after split allowed, late surrender off, max 4 split hands, one card on split aces without re-split, American hole card with dealer peek, insurance never taken, 75% shoe penetration. All are configurable except peek and insurance in the MVP.
- Model a real shoe: shuffle without replacement and reshuffle when the cut card is reached.
- Basic-strategy tables are generated per rule set by an exact expected-value solver and cached. Never hand-copy one chart and reuse it across rule sets (S17 and H17 differ, and so do deck counts and double-after-split).
- Correctness gates: generated tables must match published charts, and a long flat-betting run must reproduce the published house edge for each supported rule set within statistical error. Do not weaken or skip these checks.
- If the bankroll cannot fund a double or split that basic strategy calls for, play the best remaining legal action and increment the “unavailable action” counter; never ignore it silently.
- Rules are delivered in tiers (Tier 1: 6 and 8 decks, S17/H17, DAS, 3:2 and 6:5; Tier 2: other deck counts, surrender, double and split options; Tier 3: penetration). A rule option appears in the UI only after it is validated.

## Randomness and reproducibility

- Use a small, fast seeded PRNG inside workers. A cryptographic source may create the initial seed once, in the UI layer only.
- Derive child seeds deterministically for each simulation and chunk. Record seeds in exports.
- Results must be identical for 1, 2 or 4 workers. Use integer sums so merge order cannot change aggregates, and never let chunk size or scheduling influence outcomes.

## Workers and concurrency

- Fixed pool of at most 4 workers. Auto = min(4, max(1, logical cores − 1)); manual 1–4. Never one worker per simulation.
- Split work into chunks of roughly 100–200 ms so cancellation is prompt. Queue chunks to free workers.
- Typed message contracts (discriminated unions): start chunk, progress, chunk result, cancel, error. Validate shapes at the boundary.
- Throttle progress to every 250–500 ms. Stop All cancels queued and active chunks, terminates and recreates workers as a backstop, and marks the run `cancelled` with partial results labelled.
- A failed chunk is failed or re-queued without double counting.
- Caps (initial, confirm by benchmark): 50,000 simulations per experiment, 10,000 rounds per simulation, about 100 million total rounds (simulations × strategies × rounds). Show an estimated runtime before starting.

## Statistics

- Use running (online) mean and variance. Keep one compact typed-array entry per simulation for exact final percentiles. Checkpoints use running sums plus fixed-bin histograms. Never store per-hand data.
- Always report the number of simulations beside every percentage and average. Use Wilson intervals for proportions and a confidence interval for means and for return per unit wagered. Describe differences inside the intervals as inconclusive.
- Always include **return per unit wagered** next to currency profit; profit in currency mostly follows how much a system wagers.
- Metrics per strategy: status counts, win/loss/break-even share, mean, median, standard deviation, 5th/25th/75th/95th percentiles, total and maximum wager, drawdown, first-crossing hit rates and rounds per target, bust and block rates, outcome frequencies, unavailable-action count.

## UI and charts

- Update the live dashboard every 250–500 ms from aggregates. Never draw every simulation.
- Per-simulation comparison grid: the user picks n simulations to show (default 6, maximum 25). Show simulations 1 to n, one panel each, overlaying all chosen strategies' downsampled bankroll curves. A panel fills in when its simulation finishes; never slow the run for display. See spec section 10.9.
- Setup screen shows calculated target amounts, the total work estimate and a warning when over budget.
- Final dashboard charts (ECharts): checkpoint profit with percentile bands, final profit distribution, target attainment, drawdown distribution, bet progression, sample simulations. Provide tooltips, series toggles, zoom and click-through.
- Rankings are labelled by goal and by configuration, never as a universal “best strategy”.
- Keep components small, accessible (labels, keyboard use, contrast) and responsive.

## Reports and exports

- **Standalone interactive HTML report:** one self-contained file with the chart library, styling and data embedded; works offline; contains configuration and seed, comparison table, charts, target attainment, checkpoint data and a bounded sample of simulations (up to 500 per strategy); states whether the run was complete or partial.
- **CSV 1 (summary):** one row per strategy with the metrics above.
- **CSV 2 (per simulation):** one row per simulation per strategy: simulation id, seed, strategy id and version, rounds played, final bankroll, net profit, total wagered, maximum wager, maximum drawdown, first-crossing round for each target (blank if not reached), stop reason, unavailable-action count.
- Write large exports in chunks with a size warning so the interface never freezes. Also offer a JSON download of configuration and seed.

## Testing requirements

- Unit tests: ace handling, soft and hard totals, dealer S17/H17, blackjack payouts for 3:2 and 6:5, pushes, doubles and splits fully accounted, strategy transitions after win, loss, push, blackjack and mixed split rounds, integer money arithmetic.
- Property tests: no bet below the table minimum, above the bankroll or above the table maximum without a recorded stop reason.
- Simulation tests: final bankroll equals starting bankroll plus net profit; same seed gives the same result; paired seeds are consistent; strategies stop independently and the simulation ends only when all have stopped; first-crossing rounds are ordered (0.5x no later than 1x, and so on); aggregates match a hand calculation on a small known set; results are identical across worker counts.
- Use the worked examples in `docs/spec.md` as golden test data.

## Performance rules for hot code

The round loop runs hundreds of millions of times. In `src/engine` hot paths avoid allocating objects or arrays per round, avoid spreading and destructuring in loops, prefer typed arrays and numeric enums, reuse shoe buffers, and avoid string building. Measure before and after any optimisation; do not trade correctness or readability for unmeasured speed.

## Code style

- TypeScript strict, no `any`, no non-null assertions without a reason. Prefer `readonly`, discriminated unions and exhaustive `switch` checks.
- Small pure functions, early returns, descriptive names, no abbreviations except common ones (RNG, EV).
- Validate all external input (form values, imported JSON) with Zod at the boundary; trust internal types after that.
- Handle errors explicitly; surface worker failures to the user clearly.

## Workflow

- Follow the roadmap phases in the project plan in order. Do not start UI polish before the engine passes its correctness gates.
- Keep pull requests small and focused. Each PR includes tests and, when behaviour changes, an update to `docs/spec.md` with a version bump and changelog entry.
- Commit messages: short imperative summary, then a line on why if not obvious.
- When a request conflicts with these rules, say so and propose the compliant option instead.

## Never do

- Add real-money, gambling-site, account or payment features.
- Add card counting, side bets or insurance strategy unless the spec is updated first.
- Use floating-point money, `Math.random()` in the engine, or browser APIs in `src/engine`.
- Present any strategy as beating the house or guaranteeing profit.
- Hide the rules in use; the active table rules and strategy definitions must be visible to the user.
