import type { StopReason } from '../../shared/stopReasons';

/**
 * Spec 2.2 steps 5-6 (decisions D1-D3). Checks the strategy's required next bet before a round.
 * The table maximum is checked first, so a bet breaking both limits is `blocked_table_max`.
 * A bet equal to the whole bankroll is allowed. A bet is never reduced or capped to fit:
 * the strategy stops instead (CLAUDE.md rule 5).
 */
export function checkRequiredBet(
  bet: number,
  bankroll: number,
  tableMaximum: number | null,
): Extract<StopReason, 'bust' | 'blocked_table_max'> | null {
  if (tableMaximum !== null && bet > tableMaximum) return 'blocked_table_max';
  if (bet > bankroll) return 'bust';
  return null;
}
