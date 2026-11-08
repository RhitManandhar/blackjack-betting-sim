# Performance — benchmarks and final limits

The Phase 9 benchmark report (plan Phase 9). It records measured speed, responsiveness and memory, and the limits chosen from them.

## How to measure

- **Node:** `npm run bench:perf`, the full grid (about 15–20 minutes on an M2 Pro), or `npm run bench:perf:quick` for 500 and 5,000 simulations only. It runs the real run controller and the browser worker's exact message handler (`src/workers/workerMessageHandler.ts`) on Node worker threads. Results are written to `node_modules/.perf/results.md` and `memory.md`. It is never part of CI.
- **Browser:** open the site with `/?benchmark`. It runs the same grid through the real Web Worker pool. Keep the tab in front, because browsers slow down hidden tabs. Then use "Copy results" and paste the output here.
- **Configuration:** the defaults, unchanged except for the number of simulations. That is 5 strategies, a 1,000-round limit, no target, 6 decks S17 DAS 3:2, 5 checkpoints and 6 displayed simulations, with seed 20261108.
- **Columns:**
  - "Rounds" counts rounds actually played. Strategies stop early, so it is below the upper bound of simulations × strategies × round limit.
  - "Speed-up" is relative to 1 worker at the same simulation count.
  - "Max main-thread gap" is the longest event-loop delay in Node, or the longest gap between frames in a browser.
  - "Summary" is a fingerprint of the final summary. It must be identical in every row with the same simulation count (spec 8.4).

## Results

### Node, quick grid — 2026-11-08

**Node v24.14.1, Apple M2 Pro, 10 logical cores**

| Simulations | Workers | Status | Time (s) | Rounds | Rounds/s | Speed-up | Messages/s | Max main-thread gap (ms) | Peak memory (MB) | Summary |
| ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 500 | 1 | complete | 2.5 | 964,918 | 383,766 | 1.0× | 8.4 | 14 | 32 | f08c5807 |
| 500 | 2 | complete | 2.0 | 964,918 | 484,211 | 1.3× | 10.5 | 11 | 35 | f08c5807 |
| 500 | 3 | complete | 1.9 | 964,918 | 512,725 | 1.3× | 11.2 | 11 | 36 | f08c5807 |
| 500 | 4 | complete | 1.8 | 964,918 | 532,355 | 1.4× | 11.6 | 12 | 31 | f08c5807 |
| 5,000 | 1 | complete | 10.0 | 8,855,531 | 886,316 | 1.0× | 20.9 | 12 | 34 | 3dd4d418 |
| 5,000 | 2 | complete | 5.7 | 8,855,531 | 1,565,265 | 1.8× | 36.9 | 12 | 34 | 3dd4d418 |
| 5,000 | 3 | complete | 4.3 | 8,855,531 | 2,078,856 | 2.3× | 49.1 | 12 | 32 | 3dd4d418 |
| 5,000 | 4 | complete | 3.7 | 8,855,531 | 2,400,983 | 2.7× | 56.7 | 12 | 32 | 3dd4d418 |

Memory: heap after garbage collection was 19.7, 19.6, 19.7 (cancelled run), 19.7, 19.7 and 19.7 MB over 6 consecutive runs of 5,000 simulations × 4 workers. No growth.

First observations:

- **Per-round cost.** One worker plays about 0.89M rounds/s, or 1.13 µs per round including messages, merging and the summary. That matches the 1.23 µs runner figure from Phase 5.
- **Fixed start-up cost.** Each worker builds the strategy table once per run, which takes about 1.3 s. That dominates small runs: 500 simulations gain only 1.4× from 4 workers. At 5,000 simulations it is a smaller share, and 4 workers give 2.7×.
- **Messages and responsiveness.** Message rates stay under 60 per second, and the coordinating thread never stalled for more than 14 ms.

### Node, full grid

_To do._

### Browsers

_To do. Paste the "Copy results" output from `/?benchmark` for each device and browser._

| Device | Browser | Grid | Result |
| --- | --- | --- | --- |
| Low-power laptop | | | |
| Typical desktop | | | |

## Manual checks (plan Phase 9, tasks 2, 5 and 6)

| Check | Chrome | Firefox | Safari | Edge |
| --- | --- | --- | --- | --- |
| Default run completes; the live screen updates smoothly | | | | |
| Stop All during a 50,000-simulation run stops within about a second; a fresh run then starts and completes | | | | |
| The memory check on `/?benchmark` shows no growth over 6 runs (Chrome and Edge report memory) | | | | |
| Keyboard only: setup, Run, Stop All, grid enlarge and close, rankings tabs, table sorting, downloads | | | | |
| Phone width (about 375 px): no horizontal page scroll; charts and tables readable | | | | |
| HTML report opens offline with tooltips, toggles and zoom | | | | |

## Final limits

_To do in slice 9b, from the low-power device's measurements._
