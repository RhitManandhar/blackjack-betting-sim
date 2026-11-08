import { describe, expect, it } from 'vitest';
import { LIMITS } from '../../shared/constants';
import { Rng, fmix32, simulationSeed, splitmix32Next } from './rng';

// Independent BigInt reference implementations of the published algorithms.
// They share no code with rng.ts, so a slip in the Math.imul version shows up here.
const MASK = 0xffff_ffffn;
const mul = (a: bigint, b: bigint): bigint => (a * b) & MASK;
const rotlBig = (x: bigint, k: bigint): bigint => ((x << k) | (x >> (32n - k))) & MASK;

function fmix32Reference(value: bigint): bigint {
  let h = value & MASK;
  h ^= h >> 16n;
  h = mul(h, 0x85ebca6bn);
  h ^= h >> 13n;
  h = mul(h, 0xc2b2ae35n);
  h ^= h >> 16n;
  return h;
}

function xoshiroReference(seed: bigint, count: number): number[] {
  let state = seed;
  const s: bigint[] = [];
  for (let i = 0; i < 4; i += 1) {
    state = (state + 0x9e3779b9n) & MASK;
    let z = state;
    z = mul(z ^ (z >> 16n), 0x21f0aaadn);
    z = mul(z ^ (z >> 15n), 0x735a2d97n);
    s.push(z ^ (z >> 15n));
  }
  let [s0, s1, s2, s3] = s as [bigint, bigint, bigint, bigint];
  const outputs: number[] = [];
  for (let i = 0; i < count; i += 1) {
    outputs.push(Number(mul(rotlBig(mul(s1, 5n), 7n), 9n)));
    const t = (s1 << 9n) & MASK;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotlBig(s3, 11n);
  }
  return outputs;
}

describe('fmix32', () => {
  it.each([
    [0, 0],
    [1, 0x514e28b7],
  ])('fmix32(%i) is the published MurmurHash3 value', (input, expected) => {
    expect(fmix32(input)).toBe(expected);
  });

  it.each([2, 0x9e3779b9, 0xffff_ffff, 123_456_789])('matches the reference for %i', (input) => {
    expect(fmix32(input)).toBe(Number(fmix32Reference(BigInt(input))));
  });
});

describe('simulationSeed (spec 8.1)', () => {
  it.each([
    [0, 0],
    [0, 1],
    [42, 0],
    [0xffff_ffff, 49_999],
  ])('experiment seed %i, simulation %i matches the formula', (experimentSeed, index) => {
    const mixedInput = (BigInt(experimentSeed) + BigInt(index + 1) * 0x9e3779b9n) & MASK;
    expect(simulationSeed(experimentSeed, index)).toBe(Number(fmix32Reference(mixedInput)));
  });

  it('gives every simulation a different seed up to the cap (D17)', () => {
    for (const experimentSeed of [0, 1, 0xdead_beef, 0xffff_ffff]) {
      const seeds = new Set<number>();
      for (let index = 0; index < LIMITS.maxSimulations; index += 1) {
        seeds.add(simulationSeed(experimentSeed, index));
      }
      expect(seeds.size).toBe(LIMITS.maxSimulations);
    }
  });
});

describe('splitmix32', () => {
  it('advances the state by the golden gamma', () => {
    expect(splitmix32Next(0).state).toBe(0x9e3779b9);
    expect(splitmix32Next(0xffff_ffff).state).toBe(0x9e3779b8);
  });
});

describe('Rng (xoshiro128**)', () => {
  it.each([0, 1, 42, 0xffff_ffff])('seed %i matches the reference for 1,000 outputs', (seed) => {
    const rng = new Rng(seed);
    const actual = Array.from({ length: 1000 }, () => rng.nextUint32());
    expect(actual).toEqual(xoshiroReference(BigInt(seed), 1000));
  });

  // Pinned test vectors (spec 8.2). These must never change without a spec version bump.
  it('produces the pinned first outputs for seed 0 and seed 42', () => {
    const first = (seed: number): number[] => {
      const rng = new Rng(seed);
      return Array.from({ length: 4 }, () => rng.nextUint32());
    };
    expect(first(0)).toEqual(PINNED_SEED_0);
    expect(first(42)).toEqual(PINNED_SEED_42);
  });

  it('is deterministic for the same seed', () => {
    const a = new Rng(7);
    const b = new Rng(7);
    for (let i = 0; i < 100; i += 1) expect(a.nextUint32()).toBe(b.nextUint32());
  });
});

describe('Rng.nextBelow (spec 2.2, P1)', () => {
  it('stays inside [0, bound)', () => {
    const rng = new Rng(3);
    for (const bound of [1, 2, 3, 10, 52, 312, 416, 0x8000_0001, 0x1_0000_0000]) {
      for (let i = 0; i < 200; i += 1) {
        const value = rng.nextBelow(bound);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(bound);
        expect(Number.isInteger(value)).toBe(true);
      }
    }
  });

  it('rejects raw values below the threshold, so residues are exactly uniform', () => {
    // bound = 3 * 2^30: plain modulo would map [3 * 2^30, 2^32) onto [0, 2^30), so values
    // below 2^30 would appear half the time instead of one third.
    const bound = 0xc000_0000;
    const rng = new Rng(11);
    let low = 0;
    const draws = 30_000;
    for (let i = 0; i < draws; i += 1) if (rng.nextBelow(bound) < 0x4000_0000) low += 1;
    expect(Math.abs(low / draws - 1 / 3)).toBeLessThan(0.02);
  });

  it('is roughly uniform for a deck-sized bound', () => {
    const rng = new Rng(5);
    const counts = new Array<number>(10).fill(0);
    const draws = 100_000;
    for (let i = 0; i < draws; i += 1) {
      const value = rng.nextBelow(10);
      counts[value] = (counts[value] ?? 0) + 1;
    }
    for (const count of counts) expect(Math.abs(count / draws - 0.1)).toBeLessThan(0.006);
  });
});

const PINNED_SEED_0 = [1_789_933_344, 44_971_166, 2_521_387_044, 3_848_737_593];
const PINNED_SEED_42 = [660_444_221, 3_652_823_732, 77_672_526, 910_233_633];
