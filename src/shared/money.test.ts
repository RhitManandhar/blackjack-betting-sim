import { describe, expect, it } from 'vitest';
import {
  ceilDivide,
  floorDivide,
  formatCentsGrouped,
  formatCentsPlain,
  isCents,
  parseUnitsToCents,
} from './money';

describe('floorDivide', () => {
  // Spec 5.5 rounding rules: the house keeps any fraction of a cent.
  it.each([
    { case: '3:2 on 25.01 (37.515 → 37.51)', numerator: 3 * 2501, divisor: 2, expected: 3751 },
    { case: '3:2 on 20.00', numerator: 3 * 2000, divisor: 2, expected: 3000 },
    { case: '6:5 on 20.01 (24.012 → 24.01)', numerator: 6 * 2001, divisor: 5, expected: 2401 },
    { case: '6:5 on 20.00', numerator: 6 * 2000, divisor: 5, expected: 2400 },
    { case: '6:5 on 21.00', numerator: 6 * 2100, divisor: 5, expected: 2520 },
    { case: 'surrender refund on 20.01', numerator: 2001, divisor: 2, expected: 1000 },
    { case: 'zero', numerator: 0, divisor: 7, expected: 0 },
    {
      case: 'large exact',
      numerator: Number.MAX_SAFE_INTEGER - 1,
      divisor: 2,
      expected: (Number.MAX_SAFE_INTEGER - 1) / 2,
    },
  ])('$case', ({ numerator, divisor, expected }) => {
    expect(floorDivide(numerator, divisor)).toBe(expected);
  });

  it.each([
    { numerator: -1, divisor: 2 },
    { numerator: 1.5, divisor: 2 },
    { numerator: 10, divisor: 0 },
    { numerator: 10, divisor: -2 },
  ])('rejects numerator $numerator / divisor $divisor', ({ numerator, divisor }) => {
    expect(() => floorDivide(numerator, divisor)).toThrow(RangeError);
  });
});

describe('ceilDivide', () => {
  // Spec 3.1: target amounts round up.
  it.each([
    { numerator: 50000, divisor: 2, expected: 25000 },
    { numerator: 50001, divisor: 2, expected: 25001 },
    { numerator: 50001 * 5, divisor: 2, expected: 125003 },
    { numerator: 0, divisor: 3, expected: 0 },
  ])('$numerator / $divisor → $expected', ({ numerator, divisor, expected }) => {
    expect(ceilDivide(numerator, divisor)).toBe(expected);
  });
});

describe('parseUnitsToCents', () => {
  it.each([
    { input: '500', expected: 50000 },
    { input: '20.00', expected: 2000 },
    { input: '20.5', expected: 2050 },
    { input: '0.01', expected: 1 },
    { input: '0.10', expected: 10 },
    { input: ' 1,250.00 ', expected: 125000 },
    { input: '0', expected: 0 },
  ])('"$input" → $expected cents', ({ input, expected }) => {
    expect(parseUnitsToCents(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '20.001', '1e3', '20.', '.5', '12 34', 'NaN', '99999999999999'])(
    'rejects "%s"',
    (input) => {
      expect(parseUnitsToCents(input)).toBeNull();
    },
  );

  it('does not lose cents to floating point', () => {
    // 0.1 + 0.2 style errors would show up here if floats were used.
    expect(parseUnitsToCents('0.29')).toBe(29);
    expect(parseUnitsToCents('1.15')).toBe(115);
    expect(parseUnitsToCents('4.35')).toBe(435);
  });
});

describe('formatting', () => {
  it.each([
    { cents: 0, plain: '0.00', grouped: '0.00' },
    { cents: 5, plain: '0.05', grouped: '0.05' },
    { cents: 2000, plain: '20.00', grouped: '20.00' },
    { cents: -1250, plain: '-12.50', grouped: '-12.50' },
    { cents: 125000, plain: '1250.00', grouped: '1,250.00' },
    { cents: -123456789, plain: '-1234567.89', grouped: '-1,234,567.89' },
  ])('$cents cents', ({ cents, plain, grouped }) => {
    expect(formatCentsPlain(cents)).toBe(plain);
    expect(formatCentsGrouped(cents)).toBe(grouped);
  });

  it('round-trips parse and plain format', () => {
    for (const cents of [0, 1, 99, 100, 2001, 50000, 123456789]) {
      expect(parseUnitsToCents(formatCentsPlain(cents))).toBe(cents);
    }
  });

  it('rejects non-integer cents', () => {
    expect(isCents(20.5)).toBe(false);
    expect(() => formatCentsPlain(20.5)).toThrow(RangeError);
  });
});
