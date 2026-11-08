// Running count, sum and sum of squares of integer values (cents or rounds), kept exactly so the
// order in which values or partial results are merged can never change a result (spec 8.4, 10.2).
// The sum of squares is a BigInt because it can pass 2^53.

export class IntegerMoments {
  count = 0;
  sum = 0;
  sumSquares = 0n;

  add(value: number): void {
    if (!Number.isSafeInteger(value))
      throw new RangeError(`Expected an integer, got ${String(value)}`);
    this.count += 1;
    this.sum += value;
    if (!Number.isSafeInteger(this.sum))
      throw new RangeError('Sum exceeded the safe integer range');
    const big = BigInt(value);
    this.sumSquares += big * big;
  }

  merge(other: IntegerMoments): void {
    this.count += other.count;
    this.sum += other.sum;
    if (!Number.isSafeInteger(this.sum))
      throw new RangeError('Sum exceeded the safe integer range');
    this.sumSquares += other.sumSquares;
  }

  mean(): number | null {
    return this.count === 0 ? null : this.sum / this.count;
  }

  /** Sample variance (n − 1), from exact integers: (nΣx² − (Σx)²) / (n(n − 1)). */
  sampleVariance(): number | null {
    const n = this.count;
    if (n < 2) return null;
    const numerator = BigInt(n) * this.sumSquares - BigInt(this.sum) * BigInt(this.sum);
    return Number(numerator) / (n * (n - 1));
  }

  sampleSd(): number | null {
    const variance = this.sampleVariance();
    return variance === null ? null : Math.sqrt(variance);
  }
}
