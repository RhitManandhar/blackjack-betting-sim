// Seeded randomness, spec section 8 (with the pins added in spec 2.2).
// Everything here is 32-bit integer arithmetic. Changing any of it changes every
// simulated result, which needs a spec version bump.

const GOLDEN_GAMMA = 0x9e3779b9;
const TWO_TO_32 = 0x1_0000_0000;

/** MurmurHash3 32-bit finaliser. A bijection on uint32. */
export function fmix32(value: number): number {
  let h = value >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Spec 8.1: depends only on the experiment seed and the simulation index. */
export function simulationSeed(experimentSeed: number, simulationIndex: number): number {
  return fmix32((experimentSeed + Math.imul(simulationIndex + 1, GOLDEN_GAMMA)) >>> 0);
}

/** splitmix32 as pinned in spec 8.2. Returns the next state and output. */
export function splitmix32Next(state: number): { readonly state: number; readonly output: number } {
  const nextState = (state + GOLDEN_GAMMA) >>> 0;
  let z = nextState;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  z ^= z >>> 15;
  return { state: nextState, output: z >>> 0 };
}

function rotl(value: number, shift: number): number {
  return (value << shift) | (value >>> (32 - shift));
}

/** xoshiro128** seeded from four splitmix32 outputs (spec 8.2). */
export class Rng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seed: number) {
    // Four consecutive splitmix32 outputs are distinct (it is a bijection of its
    // counter), so the state can never be all zero.
    let step = splitmix32Next(seed >>> 0);
    this.s0 = step.output;
    step = splitmix32Next(step.state);
    this.s1 = step.output;
    step = splitmix32Next(step.state);
    this.s2 = step.output;
    step = splitmix32Next(step.state);
    this.s3 = step.output;
  }

  nextUint32(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5), 7), 9) >>> 0;
    const t = this.s1 << 9;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = rotl(this.s3, 11);
    return result;
  }

  /**
   * Unbiased integer in [0, bound) for 1 <= bound <= 2^32 (spec 2.2, P1).
   * Rejects raw values below (2^32 - bound) mod bound so every residue is equally likely.
   * The threshold arithmetic is on integers below 2^53, so it is exact.
   */
  nextBelow(bound: number): number {
    const threshold = (TWO_TO_32 - bound) % bound;
    let value = this.nextUint32();
    while (value < threshold) value = this.nextUint32();
    return value % bound;
  }
}
