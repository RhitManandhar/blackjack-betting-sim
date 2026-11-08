// Spec 1, "round result for progressions": the one shared function every strategy uses.
// Decided only by the sign of net round profit, so blackjacks, doubles, splits and dealer
// blackjacks all count as a single win, loss or push. A progression moves once per round.

export const RoundResult = {
  Win: 0,
  Loss: 1,
  Push: 2,
} as const;

export type RoundResult = (typeof RoundResult)[keyof typeof RoundResult];

export function roundResultFromNet(netProfit: number): RoundResult {
  if (netProfit > 0) return RoundResult.Win;
  if (netProfit < 0) return RoundResult.Loss;
  return RoundResult.Push;
}
