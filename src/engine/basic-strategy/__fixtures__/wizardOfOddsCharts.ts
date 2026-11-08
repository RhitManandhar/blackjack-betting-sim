import type { ChartCode } from '../chart';

// Reference charts for the chart gate (spec 6.3). Test-only: the engine never reads these.
//
// Source: Michael Shackleford, Wizard of Odds (all pages last updated 3 Aug 2026, retrieved
// 8 Nov 2026). Each grid is transcribed cell by cell from the chart image on its page:
//   1 deck   https://wizardofodds.com/games/blackjack/strategy/1-deck/   (bj_1d_s17.gif, bj_1d_h17.gif)
//   2 decks  https://wizardofodds.com/games/blackjack/strategy/2-decks/  (bj_2d_s17.gif, bj_2d_h17.gif)
//   4-8      https://wizardofodds.com/games/blackjack/strategy/4-decks/  (bj_4d_s17.gif, bj_4d_h17.gif)
//
// Published codes: H, S, Dh, Ds; P split; Ph split if DAS else hit; Pd split if DAS else double;
// Ps split if DAS else stand; Rh / Rs surrender if allowed else hit / stand; Rp surrender if
// allowed else split; Rpn (2-deck H17 8,8 vs A) surrender if allowed and DAS is not, else split.
// Columns: dealer 2, 3, 4, 5, 6, 7, 8, 9, 10, A.

type Published = 'H' | 'S' | 'Dh' | 'Ds' | 'P' | 'Ph' | 'Pd' | 'Ps' | 'Rh' | 'Rs' | 'Rp' | 'Rpn';
type Grid = Readonly<Record<string, readonly Published[]>>;

const all = (code: Published): Published[] => new Array<Published>(10).fill(code);
const STIFF: Published[] = ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'];
const H5 = (code: Published, from: number, to: number): Published[] =>
  all('H').map((cell, index) => (index >= from && index <= to ? code : cell));

const ONE_DECK_S17: Grid = {
  'hard 5': all('H'),
  'hard 6': all('H'),
  'hard 7': all('H'),
  'hard 8': H5('Dh', 3, 4),
  'hard 9': H5('Dh', 0, 4),
  'hard 10': H5('Dh', 0, 7),
  'hard 11': all('Dh'),
  'hard 12': ['H', 'H', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  'hard 13': STIFF,
  'hard 14': STIFF,
  'hard 15': STIFF,
  'hard 16': ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'Rh', 'Rh'],
  'hard 17': all('S'),
  'hard 18': all('S'),
  'hard 19': all('S'),
  'hard 20': all('S'),
  'soft 13': H5('Dh', 2, 4),
  'soft 14': H5('Dh', 2, 4),
  'soft 15': H5('Dh', 2, 4),
  'soft 16': H5('Dh', 2, 4),
  'soft 17': H5('Dh', 0, 4),
  'soft 18': ['S', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'S'],
  'soft 19': ['S', 'S', 'S', 'S', 'Ds', 'S', 'S', 'S', 'S', 'S'],
  'soft 20': all('S'),
  'pair A': all('P'),
  'pair 2': ['Ph', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  'pair 3': ['Ph', 'Ph', 'P', 'P', 'P', 'P', 'Ph', 'H', 'H', 'H'],
  'pair 4': ['H', 'H', 'Ph', 'Pd', 'Pd', 'H', 'H', 'H', 'H', 'H'],
  'pair 5': all('Dh'),
  'pair 6': ['P', 'P', 'P', 'P', 'P', 'Ph', 'H', 'H', 'H', 'H'],
  'pair 7': ['P', 'P', 'P', 'P', 'P', 'P', 'Ph', 'H', 'Rs', 'H'],
  'pair 8': all('P'),
  'pair 9': ['P', 'P', 'P', 'P', 'P', 'S', 'P', 'P', 'S', 'S'],
  'pair 10': all('S'),
};

const ONE_DECK_H17: Grid = {
  ...ONE_DECK_S17,
  'hard 15': ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'Rh'],
  'hard 17': ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'Rs'],
  'soft 18': ['S', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H'],
  'pair 7': ['P', 'P', 'P', 'P', 'P', 'P', 'Ph', 'H', 'Rs', 'Rh'],
  'pair 9': ['P', 'P', 'P', 'P', 'P', 'S', 'P', 'P', 'S', 'Ps'],
};

const TWO_DECK_S17: Grid = {
  'hard 5': all('H'),
  'hard 6': all('H'),
  'hard 7': all('H'),
  'hard 8': all('H'),
  'hard 9': H5('Dh', 0, 4),
  'hard 10': H5('Dh', 0, 7),
  'hard 11': all('Dh'),
  'hard 12': ['H', 'H', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  'hard 13': STIFF,
  'hard 14': STIFF,
  'hard 15': ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'Rh', 'H'],
  'hard 16': ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'Rh', 'Rh'],
  'hard 17': all('S'),
  'hard 18': all('S'),
  'hard 19': all('S'),
  'hard 20': all('S'),
  'soft 13': H5('Dh', 3, 4),
  'soft 14': H5('Dh', 3, 4),
  'soft 15': H5('Dh', 2, 4),
  'soft 16': H5('Dh', 2, 4),
  'soft 17': H5('Dh', 1, 4),
  'soft 18': ['S', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H'],
  'soft 19': all('S'),
  'soft 20': all('S'),
  'pair A': all('P'),
  'pair 2': ['Ph', 'Ph', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  'pair 3': ['Ph', 'Ph', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  'pair 4': ['H', 'H', 'H', 'Ph', 'Ph', 'H', 'H', 'H', 'H', 'H'],
  'pair 5': H5('Dh', 0, 7),
  'pair 6': ['P', 'P', 'P', 'P', 'P', 'Ph', 'H', 'H', 'H', 'H'],
  'pair 7': ['P', 'P', 'P', 'P', 'P', 'P', 'Ph', 'H', 'H', 'H'],
  'pair 8': all('P'),
  'pair 9': ['P', 'P', 'P', 'P', 'P', 'S', 'P', 'P', 'S', 'S'],
  'pair 10': all('S'),
};

const TWO_DECK_H17: Grid = {
  ...TWO_DECK_S17,
  'hard 15': ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'Rh', 'Rh'],
  'hard 17': ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'Rs'],
  'soft 13': H5('Dh', 3, 4),
  'soft 14': H5('Dh', 2, 4),
  'soft 18': ['Ds', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H'],
  'soft 19': ['S', 'S', 'S', 'S', 'Ds', 'S', 'S', 'S', 'S', 'S'],
  'pair 8': ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'Rpn'],
};

const FOUR_TO_EIGHT_S17: Grid = {
  'hard 5': all('H'),
  'hard 6': all('H'),
  'hard 7': all('H'),
  'hard 8': all('H'),
  'hard 9': H5('Dh', 1, 4),
  'hard 10': H5('Dh', 0, 7),
  'hard 11': H5('Dh', 0, 8),
  'hard 12': ['H', 'H', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'],
  'hard 13': STIFF,
  'hard 14': STIFF,
  'hard 15': ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'Rh', 'H'],
  'hard 16': ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'Rh', 'Rh', 'Rh'],
  'hard 17': all('S'),
  'hard 18': all('S'),
  'hard 19': all('S'),
  'hard 20': all('S'),
  'soft 13': H5('Dh', 3, 4),
  'soft 14': H5('Dh', 3, 4),
  'soft 15': H5('Dh', 2, 4),
  'soft 16': H5('Dh', 2, 4),
  'soft 17': H5('Dh', 1, 4),
  'soft 18': ['S', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H'],
  'soft 19': all('S'),
  'soft 20': all('S'),
  'pair A': all('P'),
  'pair 2': ['Ph', 'Ph', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  'pair 3': ['Ph', 'Ph', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  'pair 4': ['H', 'H', 'H', 'Ph', 'Ph', 'H', 'H', 'H', 'H', 'H'],
  'pair 5': H5('Dh', 0, 7),
  'pair 6': ['Ph', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H', 'H'],
  'pair 7': ['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'],
  'pair 8': all('P'),
  'pair 9': ['P', 'P', 'P', 'P', 'P', 'S', 'P', 'P', 'S', 'S'],
  'pair 10': all('S'),
};

const FOUR_TO_EIGHT_H17: Grid = {
  ...FOUR_TO_EIGHT_S17,
  'hard 11': all('Dh'),
  'hard 15': ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'Rh', 'Rh'],
  'hard 17': ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'Rs'],
  'soft 18': ['Ds', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H'],
  'soft 19': ['S', 'S', 'S', 'S', 'Ds', 'S', 'S', 'S', 'S', 'S'],
  'pair 8': ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'Rp'],
};

export const PUBLISHED = {
  1: { S17: ONE_DECK_S17, H17: ONE_DECK_H17 },
  2: { S17: TWO_DECK_S17, H17: TWO_DECK_H17 },
  '4-8': { S17: FOUR_TO_EIGHT_S17, H17: FOUR_TO_EIGHT_H17 },
} as const;

export interface ResolveOptions {
  readonly doubleAfterSplit: boolean;
  readonly lateSurrender: boolean;
}

/**
 * Resolves a published grid into our chart notation for one rule set (see chart.ts).
 * Pair rows record only whether to split: a published non-split play of a pair (H, S, Dh, Rs, Rh)
 * becomes '-', because since spec 2.2 an unsplit pair is played by its total cell. Such cells are
 * listed in docs/validation.md.
 */
export function resolve(grid: Grid, options: ResolveOptions): Record<string, ChartCode[]> {
  const { doubleAfterSplit: das, lateSurrender: surrender } = options;
  const chart: Record<string, ChartCode[]> = {};
  for (const [row, cells] of Object.entries(grid)) {
    const isPair = row.startsWith('pair');
    chart[row] = cells.map((cell): ChartCode => {
      if (isPair) {
        switch (cell) {
          case 'P':
            return 'P';
          case 'Ph':
          case 'Pd':
          case 'Ps':
            return das ? 'P' : '-';
          case 'Rp':
            return surrender ? 'Rp' : 'P';
          case 'Rpn':
            return surrender && !das ? 'Rp' : 'P';
          case 'H':
          case 'S':
          case 'Dh':
          case 'Ds':
          case 'Rh':
          case 'Rs':
            return '-';
        }
      }
      switch (cell) {
        case 'Rh':
          return surrender ? 'Rh' : 'H';
        case 'Rs':
          return surrender ? 'Rs' : 'S';
        case 'H':
        case 'S':
        case 'Dh':
        case 'Ds':
          return cell;
        case 'P':
        case 'Ph':
        case 'Pd':
        case 'Ps':
        case 'Rp':
        case 'Rpn':
          throw new Error(`Unexpected code ${cell} in total row ${row}`);
      }
    });
  }
  return chart;
}

/** Applies a doubling restriction to a resolved chart: a disallowed double falls back (Dh → H, Ds → S). */
export function restrictDoubles(
  chart: Record<string, ChartCode[]>,
  allowed: (row: string) => boolean,
): Record<string, ChartCode[]> {
  const restricted: Record<string, ChartCode[]> = {};
  for (const [row, cells] of Object.entries(chart)) {
    restricted[row] = allowed(row)
      ? cells
      : cells.map((cell) => (cell === 'Dh' ? 'H' : cell === 'Ds' ? 'S' : cell));
  }
  return restricted;
}
