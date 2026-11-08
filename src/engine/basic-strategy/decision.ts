import { type StrategyTable, cellIndex, pairCellIndex } from './table';

// Decision lookup (spec 6.2): always the highest-EV legal action for the current hand.
// "Legal" includes "affordable"; the caller counts unaffordable actions (spec 5.4).

export const Action = {
  Stand: 0,
  Hit: 1,
  Double: 2,
  Split: 3,
} as const;

export type Action = (typeof Action)[keyof typeof Action];

/** Best of stand, hit and (when allowed) double for a total cell. */
export function bestTotalAction(
  table: StrategyTable,
  row: number,
  upcard: number,
  doubleAllowed: boolean,
): Action {
  const index = cellIndex(row, upcard);
  const stand = table.stand[index] ?? 0;
  const hit = table.hit[index] ?? 0;
  if (doubleAllowed && (table.double[index] ?? 0) > Math.max(stand, hit)) return Action.Double;
  return hit > stand ? Action.Hit : Action.Stand;
}

/** Whether splitting beats the best way of playing the pair unsplit. */
export function prefersSplit(table: StrategyTable, pairValue: number, upcard: number): boolean {
  const index = pairCellIndex(pairValue, upcard);
  return (table.split[index] ?? 0) > (table.noSplit[index] ?? 0);
}
