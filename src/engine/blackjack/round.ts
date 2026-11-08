import { floorDivide } from '../../shared/money';
import type { RuleSet } from '../../shared/schema';
import { Action, bestTotalAction, prefersSplit } from '../basic-strategy/decision';
import { getStrategyTable } from '../basic-strategy/solver';
import { type StrategyTable, totalRow } from '../basic-strategy/table';
import { ACE, bestTotal, isNaturalPair } from './cards';
import { dealerPeeks, isDealerBlackjack, playDealerHand } from './dealer';
import { assertSupportedRules, doubleAllowedOnTotal } from './rules';
import { type Shoe, drawCard, reshuffleIfDue } from './shoe';

// One round of blackjack (spec 5.2-5.5), played by basic strategy and settled in integer cents.
// Hot path: no allocation per round. All per-hand state lives in typed arrays owned by the
// RoundContext, and the result is written into a caller-owned object.

/** Spec 1, round outcome category. */
export const Outcome = {
  Blackjack: 0,
  Win: 1,
  Push: 2,
  Loss: 3,
} as const;

export type Outcome = (typeof Outcome)[keyof typeof Outcome];

export interface RoundSettlement {
  netProfit: number;
  totalWagered: number;
  outcome: Outcome;
  unavailableActions: number;
  reshuffled: boolean;
}

export function createRoundSettlement(): RoundSettlement {
  return {
    netProfit: 0,
    totalWagered: 0,
    outcome: Outcome.Push,
    unavailableActions: 0,
    reshuffled: false,
  };
}

const MAX_HANDS = 4;

export interface RoundContext {
  readonly rules: RuleSet;
  readonly table: StrategyTable;
  readonly hitSoft17: boolean;
  readonly naturalNumerator: number;
  readonly naturalDenominator: number;
  // Per-hand workspace, reused every round.
  readonly hardSum: Int32Array;
  readonly hasAce: Uint8Array;
  readonly cardCount: Uint8Array;
  readonly firstCard: Uint8Array;
  readonly secondCard: Uint8Array;
  readonly stake: Float64Array;
  readonly fromSplit: Uint8Array;
  readonly splitAces: Uint8Array;
}

export function createRoundContext(rules: RuleSet): RoundContext {
  assertSupportedRules(rules);
  const isThreeToTwo = rules.blackjackPayout === '3:2';
  return {
    rules,
    table: getStrategyTable(rules),
    hitSoft17: rules.soft17 === 'H17',
    naturalNumerator: isThreeToTwo ? 3 : 6,
    naturalDenominator: isThreeToTwo ? 2 : 5,
    hardSum: new Int32Array(MAX_HANDS),
    hasAce: new Uint8Array(MAX_HANDS),
    cardCount: new Uint8Array(MAX_HANDS),
    firstCard: new Uint8Array(MAX_HANDS),
    secondCard: new Uint8Array(MAX_HANDS),
    stake: new Float64Array(MAX_HANDS),
    fromSplit: new Uint8Array(MAX_HANDS),
    splitAces: new Uint8Array(MAX_HANDS),
  };
}

function startHand(
  context: RoundContext,
  hand: number,
  card: number,
  stake: number,
  fromSplit: boolean,
): void {
  context.hardSum[hand] = card;
  context.hasAce[hand] = card === ACE ? 1 : 0;
  context.cardCount[hand] = 1;
  context.firstCard[hand] = card;
  context.secondCard[hand] = 0;
  context.stake[hand] = stake;
  context.fromSplit[hand] = fromSplit ? 1 : 0;
  context.splitAces[hand] = fromSplit && card === ACE ? 1 : 0;
}

function addCard(context: RoundContext, hand: number, card: number): void {
  context.hardSum[hand] = (context.hardSum[hand] ?? 0) + card;
  if (card === ACE) context.hasAce[hand] = 1;
  const count = (context.cardCount[hand] ?? 0) + 1;
  context.cardCount[hand] = count;
  if (count === 2) context.secondCard[hand] = card;
}

/** Moves hands after `hand` one place right, so a split hand sits next to its origin. */
function insertHandAfter(context: RoundContext, hand: number, handCount: number): void {
  for (let index = handCount; index > hand + 1; index -= 1) {
    context.hardSum[index] = context.hardSum[index - 1] ?? 0;
    context.hasAce[index] = context.hasAce[index - 1] ?? 0;
    context.cardCount[index] = context.cardCount[index - 1] ?? 0;
    context.firstCard[index] = context.firstCard[index - 1] ?? 0;
    context.secondCard[index] = context.secondCard[index - 1] ?? 0;
    context.stake[index] = context.stake[index - 1] ?? 0;
    context.fromSplit[index] = context.fromSplit[index - 1] ?? 0;
    context.splitAces[index] = context.splitAces[index - 1] ?? 0;
  }
}

function handBest(context: RoundContext, hand: number): number {
  return bestTotal(context.hardSum[hand] ?? 0, context.hasAce[hand] === 1);
}

/**
 * Plays and settles one round for the given initial bet. `bankrollBefore` is the bankroll before
 * the bet is placed; it limits doubles and splits (spec 5.4). The caller guarantees
 * 0 < bet <= bankrollBefore; anything else is a programming error and throws.
 */
export function playRound(
  context: RoundContext,
  shoe: Shoe,
  bet: number,
  bankrollBefore: number,
  result: RoundSettlement,
): void {
  if (!Number.isSafeInteger(bet) || bet <= 0 || bet > bankrollBefore) {
    throw new RangeError(`Invalid bet ${bet} for bankroll ${bankrollBefore}`);
  }
  result.reshuffled = reshuffleIfDue(shoe);
  result.unavailableActions = 0;

  const playerFirst = drawCard(shoe);
  const upcard = drawCard(shoe);
  const playerSecond = drawCard(shoe);
  const holeCard = drawCard(shoe);
  const playerNatural = isNaturalPair(playerFirst, playerSecond);

  result.totalWagered = bet;
  if (dealerPeeks(upcard) && isDealerBlackjack(upcard, holeCard)) {
    result.netProfit = playerNatural ? 0 : -bet;
    result.outcome = playerNatural ? Outcome.Push : Outcome.Loss;
    return;
  }
  if (playerNatural) {
    result.netProfit = floorDivide(bet * context.naturalNumerator, context.naturalDenominator);
    result.outcome = Outcome.Blackjack;
    return;
  }

  startHand(context, 0, playerFirst, bet, false);
  addCard(context, 0, playerSecond);
  let handCount = 1;
  let committed = bet;
  const { rules, table } = context;

  for (let hand = 0; hand < handCount; hand += 1) {
    if (context.cardCount[hand] === 1) addCard(context, hand, drawCard(shoe));

    for (;;) {
      const twoCards = context.cardCount[hand] === 2;
      const pairValue = context.firstCard[hand] ?? 0;
      const isPair = twoCards && pairValue === context.secondCard[hand];
      const splitAcesHand = context.splitAces[hand] === 1;
      // Split aces take exactly one card; only a second ace may be re-split, and only with RSA.
      if (splitAcesHand && !(isPair && rules.resplitAces)) break;
      const best = handBest(context, hand);
      if (best >= 21) break;

      const available = bankrollBefore - committed;
      let fundsShortCounted = false;

      if (isPair && handCount < rules.maxSplitHands && prefersSplit(table, pairValue, upcard)) {
        if (available >= bet) {
          insertHandAfter(context, hand, handCount);
          handCount += 1;
          committed += bet;
          startHand(context, hand, pairValue, bet, true);
          startHand(context, hand + 1, pairValue, bet, true);
          addCard(context, hand, drawCard(shoe));
          continue;
        }
        result.unavailableActions += 1;
        fundsShortCounted = true;
      }
      if (splitAcesHand) break; // an ace that was not re-split stands on its one card

      const isInitialHand = context.fromSplit[hand] === 0;
      const row = totalRow(context.hardSum[hand] ?? 0, context.hasAce[hand] === 1);
      const doubleLegal =
        twoCards && (isInitialHand || rules.doubleAfterSplit) && doubleAllowedOnTotal(rules, best);
      // Late surrender: only the initial two-card hand, after the peek (spec 5.3).
      const surrenderLegal = rules.lateSurrender && isInitialHand && twoCards;
      let action = bestTotalAction(table, row, upcard, doubleLegal, surrenderLegal);
      if (action === Action.Double && available < (context.stake[hand] ?? 0)) {
        if (!fundsShortCounted) result.unavailableActions += 1;
        action = bestTotalAction(table, row, upcard, false, surrenderLegal);
      }

      if (action === Action.Surrender) {
        // Spec 5.5: lose b − floor(b / 2); the house keeps an odd cent. The dealer does not play.
        result.netProfit = -(bet - floorDivide(bet, 2));
        result.outcome = Outcome.Loss;
        result.totalWagered = bet;
        return;
      }
      if (action === Action.Stand) break;
      if (action === Action.Double) {
        committed += context.stake[hand] ?? 0;
        context.stake[hand] = 2 * (context.stake[hand] ?? 0);
        addCard(context, hand, drawCard(shoe));
        break;
      }
      addCard(context, hand, drawCard(shoe));
    }
  }

  settle(context, shoe, upcard, holeCard, handCount, result);
  result.totalWagered = committed;
}

function settle(
  context: RoundContext,
  shoe: Shoe,
  upcard: number,
  holeCard: number,
  handCount: number,
  result: RoundSettlement,
): void {
  let anyStanding = false;
  for (let hand = 0; hand < handCount; hand += 1) {
    if (handBest(context, hand) <= 21) anyStanding = true;
  }
  const dealerTotal = anyStanding ? playDealerHand(shoe, upcard, holeCard, context.hitSoft17) : 0;

  let net = 0;
  for (let hand = 0; hand < handCount; hand += 1) {
    const stake = context.stake[hand] ?? 0;
    const total = handBest(context, hand);
    if (total > 21) net -= stake;
    else if (dealerTotal > 21 || total > dealerTotal) net += stake;
    else if (total < dealerTotal) net -= stake;
  }
  result.netProfit = net;
  result.outcome = net > 0 ? Outcome.Win : net < 0 ? Outcome.Loss : Outcome.Push;
}
