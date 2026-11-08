// Layout of a generated basic-strategy table (spec 6.1).
// All EVs are in units of the initial bet. Cells are indexed by row * 10 + (upcard - 1),
// where the upcard runs 1 (ace) to 10.
//
// Total rows: hard 4..20 then soft 12..20. A total of 21 is never looked up; the
// player always stands on 21. Pair rows: pair value 1 (aces) .. 10.

export const UPCARDS = 10;
export const HARD_MIN = 4;
export const HARD_MAX = 20;
export const SOFT_MIN = 12;
export const SOFT_MAX = 20;
export const HARD_ROWS = HARD_MAX - HARD_MIN + 1;
export const SOFT_ROWS = SOFT_MAX - SOFT_MIN + 1;
export const TOTAL_ROWS = HARD_ROWS + SOFT_ROWS;
export const PAIR_ROWS = 10;

export interface StrategyTable {
  readonly ruleKey: string;
  /** Per total cell: EV of standing, of hitting (then playing on by EV), of doubling. */
  readonly stand: Float64Array;
  readonly hit: Float64Array;
  readonly double: Float64Array;
  /** Per pair cell: EV of splitting, and the best EV of not splitting that exact pair. */
  readonly split: Float64Array;
  readonly noSplit: Float64Array;
  /** Like noSplit but never surrendering; used to render "surrender, else split" (Rp). */
  readonly noSplitWithoutSurrender: Float64Array;
}

export function hardRow(total: number): number {
  return total - HARD_MIN;
}

export function softRow(total: number): number {
  return HARD_ROWS + total - SOFT_MIN;
}

/** Row for a hand given its hard sum (aces as 1), whether it holds an ace, and best total <= 20. */
export function totalRow(hardSum: number, hasAce: boolean): number {
  return hasAce && hardSum <= 11 ? softRow(hardSum + 10) : hardRow(hardSum);
}

export function cellIndex(row: number, upcard: number): number {
  return row * UPCARDS + upcard - 1;
}

export function pairCellIndex(pairValue: number, upcard: number): number {
  return (pairValue - 1) * UPCARDS + upcard - 1;
}

export function createEmptyTable(ruleKey: string): StrategyTable {
  return {
    ruleKey,
    stand: new Float64Array(TOTAL_ROWS * UPCARDS),
    hit: new Float64Array(TOTAL_ROWS * UPCARDS),
    double: new Float64Array(TOTAL_ROWS * UPCARDS),
    split: new Float64Array(PAIR_ROWS * UPCARDS),
    noSplit: new Float64Array(PAIR_ROWS * UPCARDS),
    noSplitWithoutSurrender: new Float64Array(PAIR_ROWS * UPCARDS),
  };
}
