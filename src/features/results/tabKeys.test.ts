import { describe, expect, it } from 'vitest';
import { tabIndexForKey } from './tabKeys';

describe('tabIndexForKey', () => {
  it.each([
    { key: 'ArrowRight', current: 0, count: 4, expected: 1 },
    { key: 'ArrowRight', current: 3, count: 4, expected: 0 },
    { key: 'ArrowLeft', current: 2, count: 4, expected: 1 },
    { key: 'ArrowLeft', current: 0, count: 4, expected: 3 },
    { key: 'Home', current: 2, count: 4, expected: 0 },
    { key: 'End', current: 0, count: 4, expected: 3 },
    { key: 'ArrowRight', current: 0, count: 1, expected: 0 },
    { key: 'Enter', current: 1, count: 4, expected: null },
    { key: 'Tab', current: 1, count: 4, expected: null },
    { key: 'ArrowDown', current: 1, count: 4, expected: null },
    { key: 'ArrowRight', current: 0, count: 0, expected: null },
  ])('$key from $current of $count → $expected', ({ key, current, count, expected }) => {
    expect(tabIndexForKey(key, current, count)).toBe(expected);
  });
});
