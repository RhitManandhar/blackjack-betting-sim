import { type StrategyTable, cellIndex, pairCellIndex } from './table';

// Decision lookup (spec 6.2): always the highest-EV legal action for the current hand.
// "Legal" includes "affordable"; the caller counts unaffordable actions (spec 5.4).

export const Action = {
  Stand: 0,
  Hit: 1,
  Double: 2,
  Split: 3,
  Surrender: 4,
} as const;

export type Action = (typeof Action)[keyof typeof Action];

/** Late surrender gives up half the bet: EV −0.5 of the initial bet (spec 5.3, 5.5). */
export const SURRENDER_EV = -0.5;

/** Best of stand, hit, and (when allowed) double and surrender for a total cell. */
export function bestTotalAction(
  table: StrategyTable,
  row: number,
  upcard: number,
  doubleAllowed: boolean,
  surrenderAllowed = false,
): Action {
  const index = cellIndex(row, upcard);
  const stand = table.stand[index] ?? 0;
  const hit = table.hit[index] ?? 0;
  let best: Action = hit > stand ? Action.Hit : Action.Stand;
  let bestEv = Math.max(hit, stand);
  const double = table.double[index] ?? 0;
  if (doubleAllowed && double > bestEv) {
    best = Action.Double;
    bestEv = double;
  }
  if (surrenderAllowed && SURRENDER_EV > bestEv) best = Action.Surrender;
  return best;
}

/** Whether splitting beats the best way of playing the pair unsplit. */
export function prefersSplit(table: StrategyTable, pairValue: number, upcard: number): boolean {
  const index = pairCellIndex(pairValue, upcard);
  return (table.split[index] ?? 0) > (table.noSplit[index] ?? 0);
}
