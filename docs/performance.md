# Performance — benchmarks and final limits

The Phase 9 benchmark report (plan Phase 9). It records measured speed, responsiveness and memory, and the limits chosen from them.

## How to measure

- **Node:** `npm run bench:perf`, the full grid (about 15–20 minutes on an M2 Pro), or `npm run bench:perf:quick` for 500 and 5,000 simulations only. It runs the real run controller and the browser worker's exact message handler (`src/workers/workerMessageHandler.ts`) on Node worker threads. Results are written to `node_modules/.perf/results.md` and `memory.md`. It is never part of CI.
- **Browser:** open the site with `/?benchmark`. It runs the same grid through the real Web Worker pool. Keep the tab in front, because browsers slow down hidden tabs. Then use "Copy results" and paste the output here.
- **Configuration:** the defaults, unchanged except for the number of simulations. That is 5 strategies, a 1,000-round limit, no target, 6 decks S17 DAS 3:2, 5 checkpoints and 6 displayed simulations, with seed 20261108.
- **Columns:**
  - "Cold start" (from slice 9b) is a warm-up of one simulation per worker on fresh workers, mostly the strategy-table build. The other columns are for the measured run on those same, now warm, workers.
  - "Rounds" counts rounds actually played. Strategies stop early, so it is below the upper bound of simulations × strategies × round limit.
  - "Speed-up" is relative to 1 worker at the same simulation count.
  - "Max main-thread gap" is the longest event-loop delay in Node, or the longest gap between frames in a browser.
  - "Summary" is a fingerprint of the final summary. It must be identical in every row with the same simulation count (spec 8.4).

## Results

### Node, full grid — 2026-11-08 (after slice 9b)

**Node v24.14.1, Apple M2 Pro, 10 logical cores.** Total run time: 5 minutes.

| Simulations | Workers | Status | Cold start (s) | Time (s) | Rounds | Rounds/s | Speed-up | Messages/s | Max main-thread gap (ms) | Peak memory (MB) | Summary |
| ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 500 | 1 | complete | 1.6 | 0.9 | 964,918 | 1,050,424 | 1.0× | 7.6 | 11 | 31 | f08c5807 |
| 500 | 2 | complete | 1.5 | 0.5 | 964,918 | 2,023,205 | 1.9× | 29.4 | 11 | 36 | f08c5807 |
| 500 | 3 | complete | 1.6 | 0.3 | 964,918 | 3,133,386 | 3.0× | 58.5 | 11 | 24 | f08c5807 |
| 500 | 4 | complete | 1.6 | 0.2 | 964,918 | 3,897,355 | 3.7× | 92.9 | 11 | 27 | f08c5807 |
| 5,000 | 1 | complete | 1.6 | 8.3 | 8,855,531 | 1,064,572 | 1.0× | 6.9 | 13 | 36 | 3dd4d418 |
| 5,000 | 2 | complete | 1.6 | 4.1 | 8,855,531 | 2,164,490 | 2.0× | 15.6 | 13 | 30 | 3dd4d418 |
| 5,000 | 3 | complete | 1.5 | 2.7 | 8,855,531 | 3,250,606 | 3.1× | 25.3 | 13 | 30 | 3dd4d418 |
| 5,000 | 4 | complete | 1.6 | 2.1 | 8,855,531 | 4,291,126 | 4.0× | 36.3 | 14 | 34 | 3dd4d418 |
| 20,000 | 1 | complete | 1.5 | 33.0 | 35,354,201 | 1,070,221 | 1.0× | 6.7 | 14 | 35 | 6f0a124f |
| 20,000 | 2 | complete | 1.6 | 16.3 | 35,354,201 | 2,174,508 | 2.0× | 13.7 | 14 | 34 | 6f0a124f |
| 20,000 | 3 | complete | 1.6 | 10.8 | 35,354,201 | 3,287,016 | 3.1× | 21.0 | 15 | 33 | 6f0a124f |
| 20,000 | 4 | complete | 1.6 | 8.1 | 35,354,201 | 4,344,810 | 4.1× | 28.8 | 14 | 30 | 6f0a124f |
| 50,000 | 1 | complete | 1.5 | 84.7 | 88,291,301 | 1,041,946 | 1.0× | 6.5 | 34 | 38 | cff6947a |
| 50,000 | 2 | complete | 1.5 | 41.1 | 88,291,301 | 2,147,151 | 2.1× | 13.3 | 16 | 34 | cff6947a |
| 50,000 | 3 | complete | 1.5 | 27.0 | 88,291,301 | 3,272,447 | 3.1× | 20.3 | 15 | 38 | cff6947a |
| 50,000 | 4 | complete | 1.6 | 20.2 | 88,291,301 | 4,370,807 | 4.2× | 27.3 | 16 | 34 | cff6947a |

"Cold start" is the warm-up on fresh workers, which is mostly each worker building its strategy table. "Time" and the columns after it are for the measured run on the same, now warm, workers, as in the app between runs.

**Memory:** the heap after garbage collection was 18.4, 18.3, 18.3 (cancelled run), 18.3, 18.3 and 18.4 MB over 6 consecutive runs of 5,000 simulations × 4 workers. It does not grow. The "Peak memory" column is the JavaScript heap only. The per-simulation result columns are typed arrays held outside it, so their size is given by the computed bound under "Final limits".

### Browsers, quick grid — 2026-11-08 (before slice 9b)

These ran before chunks were sized from measured speed and before the cold start was timed separately. The "Time" column therefore includes the about 1.4 s table build, which makes the speed-ups look small. Their summaries are identical to Node's (`f08c5807`, `3dd4d418`), so Chrome, Safari and Node give exactly the same results.

**Chrome 155, macOS, Apple M2 Pro (10 logical cores, 16 GB)**

| Simulations | Workers | Status | Time (s) | Rounds | Rounds/s | Speed-up | Messages/s | Max frame gap (ms) | Peak memory (MB) | Summary |
| ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 500 | 1 | complete | 1.9 | 964,918 | 521,465 | 1.0× | 11.3 | 18 | 11 | f08c5807 |
| 500 | 2 | complete | 1.4 | 964,918 | 684,388 | 1.3× | 14.9 | 18 | 13 | f08c5807 |
| 500 | 3 | complete | 1.4 | 964,918 | 689,424 | 1.3× | 15.0 | 18 | 13 | f08c5807 |
| 500 | 4 | complete | 1.4 | 964,918 | 681,728 | 1.3× | 14.8 | 18 | 16 | f08c5807 |
| 5,000 | 1 | complete | 3.6 | 8,855,531 | 2,429,434 | 1.0× | 57.3 | 18 | 25 | 3dd4d418 |
| 5,000 | 2 | complete | 2.5 | 8,855,531 | 3,527,397 | 1.5× | 83.3 | 18 | 34 | 3dd4d418 |
| 5,000 | 3 | complete | 2.1 | 8,855,531 | 4,220,135 | 1.7× | 99.6 | 18 | 39 | 3dd4d418 |
| 5,000 | 4 | complete | 1.9 | 8,855,531 | 4,641,507 | 1.9× | 109.5 | 18 | 39 | 3dd4d418 |

Chrome memory check, without forced garbage collection: 19.2, 30.4, 17.3 (cancelled), 24.3, 35.0 and 42.2 MB. This is inconclusive, because Chrome collects garbage whenever it chooses. To settle it, start Chrome with `--js-flags=--expose-gc`; the page then forces a collection before each reading.

**Safari 26.5, macOS, same Mac (Safari reports at most 8 cores)**

| Simulations | Workers | Status | Time (s) | Rounds | Rounds/s | Speed-up | Messages/s | Max frame gap (ms) | Peak memory (MB) | Summary |
| ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 500 | 1 | complete | 2.0 | 964,918 | 494,070 | 1.0× | 10.8 | 18 | — | f08c5807 |
| 500 | 2 | complete | 1.5 | 964,918 | 641,142 | 1.3× | 14.0 | 18 | — | f08c5807 |
| 500 | 3 | complete | 1.4 | 964,918 | 713,697 | 1.4× | 15.5 | 18 | — | f08c5807 |
| 500 | 4 | complete | 1.3 | 964,918 | 726,048 | 1.5× | 15.8 | 18 | — | f08c5807 |
| 5,000 | 1 | complete | 9.0 | 8,855,531 | 981,005 | 1.0× | 23.2 | 18 | — | 3dd4d418 |
| 5,000 | 2 | complete | 5.0 | 8,855,531 | 1,755,656 | 1.8× | 41.4 | 18 | — | 3dd4d418 |
| 5,000 | 3 | complete | 3.7 | 8,855,531 | 2,408,358 | 2.5× | 56.8 | 18 | — | 3dd4d418 |
| 5,000 | 4 | complete | 3.1 | 8,855,531 | 2,867,724 | 2.9× | 67.7 | 18 | — | 3dd4d418 |

Safari does not report memory.

**Firefox, Edge:** not yet measured.

### Findings

- **Speed per worker.** Node and Safari both play about 1M rounds/s per worker. Chrome is about 2.5× faster, at about 2.4M rounds/s on 1 worker including the table build. The cautious 1.25 µs per round used before any measurement is therefore an upper bound on every device measured so far.
- **Scaling.** On warm workers, speed scales almost linearly up to 4 workers: 4.0–4.2× from 5,000 simulations up. Small runs are dominated by the one-off table build of about 1.5 s per worker. The app keeps its workers between runs and caches each table per rule set, so only the first run with a given set of rules pays it. Saving tables in browser storage, or splitting the solver across workers, would save about a second once per visit, so neither was done.
- **Responsiveness.** The main thread never stalled noticeably. In Node the longest delay was 34 ms, once, in the 1-worker 50,000 case. In both browsers the longest frame gap was 18 ms, about one frame.
- **Messages.** Before 9b, chunks were sized from the worst case (1.25 µs per round, every strategy playing to the round limit). Real chunks were therefore 15–20 ms long in Chrome, reaching 110 messages per second. Chunks are now sized from measured speed (spec 2.9). At 5,000 simulations and above, a Node run on 4 workers sends 27–36 messages per second. The 500-simulation runs reach 93 per second on 4 workers, but they last only 0.2 s.
- **Memory.** In Node it returns to the same level after every run, including a cancelled one.

## Manual checks (plan Phase 9, tasks 2, 5 and 6)

| Check | Chrome | Firefox | Safari | Edge |
| --- | --- | --- | --- | --- |
| Default run completes; the live screen updates smoothly | | | | |
| Stop All during a 50,000-simulation run stops within about a second; a fresh run then starts and completes | | | | |
| The memory check on `/?benchmark` shows no growth over 6 runs (Chrome and Edge report memory) | | | | |
| Keyboard only: setup, Run, Stop All, grid enlarge and close, rankings tabs, table sorting, downloads | | | | |
| Phone width (about 375 px): no horizontal page scroll; charts and tables readable | | | | |
| HTML report opens offline with tooltips, toggles and zoom | | | | |

## Final limits (spec 2.9)

| Limit | Value | Basis |
| --- | --- | --- |
| Simulations per experiment | 50,000 (default 5,000) | 50,000 default-config simulations: 20 s on 4 Node workers on this Mac |
| Rounds per simulation | 10,000 (default 1,000) | Unchanged; total work is the real bound |
| Total-work warning | 100 million rounds (upper bound: simulations × strategies × rounds) | About 25 s on 4 workers at the Node and Safari speed; a device 10× slower would take a few minutes, and the user is warned first |
| Workers | Up to 4; Auto = min(4, cores − 1) | Scaling stays near-linear up to 4 |
| Result memory | About `101 + 8 × checkpoints` bytes per simulation per strategy | About 35 MB at 50,000 simulations × 5 strategies with the default 5 checkpoints; about 65 MB with 20 |

**Not yet checked on a low-power device.** The plan's exit criterion ("the defaults run comfortably on the low-power device") is still open. The default experiment is 5,000 simulations, about 8.9M rounds played. At a pessimistic 0.25M rounds/s per worker, a quarter of this Mac's Node speed, that is about 18 s on 2 workers, plus the table build. Run `/?benchmark` on such a device when one is available, and lower the limits if the full grid is uncomfortable.
