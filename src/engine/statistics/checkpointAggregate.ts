import { floorDivide } from '../../shared/money';
import { IntegerMoments } from './integerMoments';

// Checkpoint aggregates (spec 10.3, layout pinned in spec 2.4).
// The histogram layout depends only on the starting bankroll B, never on the data, so every
// worker uses identical bins and counts can simply be added. 400 equal bins cover profit
// from -B to +3B (each bin 1% of B), plus an underflow and an overflow bin.
// -B is a hard floor: every stake must be funded, so a strategy can lose at most its bankroll.

export const CHECKPOINT_BINS = 400;
const LOWER_MULTIPLE = -1;
const UPPER_MULTIPLE = 3;
const UNDERFLOW = 0;
const OVERFLOW = CHECKPOINT_BINS + 1;

export interface HistogramLayout {
  readonly lower: number;
  readonly upper: number;
  readonly bins: number;
}

export function checkpointLayout(startingBankroll: number): HistogramLayout {
  return {
    lower: LOWER_MULTIPLE * startingBankroll,
    upper: UPPER_MULTIPLE * startingBankroll,
    bins: CHECKPOINT_BINS,
  };
}

/** Slot in the counts array: 0 underflow, 1..bins regular bins, bins + 1 overflow. Bins are [low, high). */
export function histogramSlot(layout: HistogramLayout, value: number): number {
  if (value < layout.lower) return UNDERFLOW;
  if (value >= layout.upper) return OVERFLOW;
  return 1 + floorDivide((value - layout.lower) * layout.bins, layout.upper - layout.lower);
}

export class CheckpointAggregate {
  readonly moments = new IntegerMoments();
  profitable = 0;
  minimum = Number.POSITIVE_INFINITY;
  readonly counts: Uint32Array;

  constructor(readonly layout: HistogramLayout) {
    this.counts = new Uint32Array(layout.bins + 2);
  }

  add(profit: number): void {
    this.moments.add(profit);
    if (profit > 0) this.profitable += 1;
    if (profit < this.minimum) this.minimum = profit;
    const slot = histogramSlot(this.layout, profit);
    this.counts[slot] = (this.counts[slot] ?? 0) + 1;
  }

  merge(other: CheckpointAggregate): void {
    this.moments.merge(other.moments);
    this.profitable += other.profitable;
    this.minimum = Math.min(this.minimum, other.minimum);
    for (let slot = 0; slot < this.counts.length; slot += 1) {
      this.counts[slot] = (this.counts[slot] ?? 0) + (other.counts[slot] ?? 0);
    }
  }

  /**
   * Approximate percentile from the histogram, labelled approximate in the UI (spec 10.3).
   * Uses type-7 ranks; the k-th smallest value is placed at the midpoint of its share of its bin.
   * Underflow and overflow values report the range edge.
   */
  approximatePercentile(p: number): number | null {
    const n = this.moments.count;
    if (n === 0) return null;
    const h = (n - 1) * p;
    const below = Math.floor(h);
    const lowerValue = this.valueAtRank(below);
    const upperValue = this.valueAtRank(Math.min(below + 1, n - 1));
    return lowerValue + (h - below) * (upperValue - lowerValue);
  }

  private valueAtRank(rank: number): number {
    const { lower, upper, bins } = this.layout;
    const width = (upper - lower) / bins;
    let before = 0;
    for (let slot = 0; slot < this.counts.length; slot += 1) {
      const count = this.counts[slot] ?? 0;
      if (rank < before + count) {
        if (slot === UNDERFLOW) return lower;
        if (slot === OVERFLOW) return upper;
        const binLow = lower + (slot - 1) * width;
        return binLow + ((rank - before + 0.5) / count) * width;
      }
      before += count;
    }
    return upper;
  }
}
