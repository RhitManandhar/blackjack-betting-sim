import type { StopReason } from '../../shared/stopReasons';
import type { StrategyId } from '../../shared/strategies';
import { TARGET_IDS, type TargetId } from '../../shared/targets';
import { Outcome } from '../blackjack/round';
import { checkRequiredBet } from '../betting/betCheck';
import { roundResultFromNet } from '../betting/roundResult';
import type { PlannedStrategy, SimulationPlan } from './plan';
import { simulationSeed } from './rng';
import type { RoundSource } from './roundSource';

// One simulation (spec 1, 2): every selected strategy plays from the same starting bankroll on
// its own shoe built from the same simulation seed, and stops independently. Strategies never
// interact, so they are played one after another; the results are the same as interleaving.

/** Display-only bankroll curve for the comparison grid (spec 10.9). Statistics never read it. */
export interface CurvePoints {
  readonly rounds: number[];
  readonly bankrolls: number[];
  /** Initial bet placed in that round; 0 for round 0, before any bet. */
  readonly bets: number[];
}

export interface OutcomeCounts {
  blackjack: number;
  win: number;
  push: number;
  loss: number;
}

/** Spec 10.1, plus the display-only curve. */
export interface StrategySimulationResult {
  readonly simulationId: number;
  readonly simulationSeed: number;
  readonly strategyId: StrategyId;
  readonly strategyVersion: string;
  readonly roundsPlayed: number;
  readonly startingBankroll: number;
  readonly finalBankroll: number;
  readonly netProfit: number;
  readonly totalWagered: number;
  readonly sumInitialBets: number;
  readonly maxWager: number;
  readonly maxDrawdown: number;
  readonly firstCrossing: Readonly<Record<TargetId, number | null>>;
  readonly stopReason: StopReason;
  readonly requiredBetAtStop: number | null;
  readonly outcomeCounts: Readonly<OutcomeCounts>;
  readonly unavailableActionCount: number;
  readonly minimumOvershootCount: number;
  readonly minimumOvershootTotal: number;
  readonly checkpointProfit: readonly number[];
  /** Initial bet placed in each checkpoint round; null once the strategy has stopped (spec 2.7). */
  readonly checkpointBet: readonly (number | null)[];
  readonly curve: CurvePoints | null;
}

export function runSimulation(
  plan: SimulationPlan,
  simulationIndex: number,
): StrategySimulationResult[] {
  const seed = simulationSeed(plan.experimentSeed, simulationIndex);
  const recordCurve = simulationIndex < plan.displayedSimulations;
  return plan.strategies.map((planned, strategyIndex) =>
    runStrategy(
      plan,
      planned,
      simulationIndex,
      seed,
      plan.createRoundSource(seed, strategyIndex),
      recordCurve,
    ),
  );
}

function runStrategy(
  plan: SimulationPlan,
  planned: PlannedStrategy,
  simulationIndex: number,
  seed: number,
  source: RoundSource,
  recordCurve: boolean,
): StrategySimulationResult {
  const { strategy } = planned;
  const { params, settlement, startingBankroll, roundLimit, stopTarget, checkpoints } = plan;
  const state = strategy.createState(params);
  const targetCount = TARGET_IDS.length;
  const firstCrossing: (number | null)[] = new Array<number | null>(targetCount).fill(null);
  const checkpointProfit: number[] = new Array<number>(checkpoints.length).fill(0);
  const checkpointBet: (number | null)[] = new Array<number | null>(checkpoints.length).fill(null);
  const outcomeCounts: OutcomeCounts = { blackjack: 0, win: 0, push: 0, loss: 0 };
  const curve: CurvePoints | null = recordCurve
    ? { rounds: [0], bankrolls: [startingBankroll], bets: [0] }
    : null;

  let bankroll = startingBankroll;
  let rounds = 0;
  let totalWagered = 0;
  let sumInitialBets = 0;
  let maxWager = 0;
  let peak = startingBankroll;
  let maxDrawdown = 0;
  let unavailable = 0;
  let nextCheckpoint = 0;
  let lastBet = 0;
  let stopReason: StopReason;
  let requiredBetAtStop: number | null = null;

  for (;;) {
    // Spec 2.2 steps 4-7: the bet check before every round, round 1 included.
    const bet = strategy.nextBet(state, params);
    const refused = checkRequiredBet(bet, bankroll, plan.tableMaximum);
    if (refused !== null) {
      stopReason = refused;
      requiredBetAtStop = bet;
      break;
    }

    source.play(bet, bankroll, settlement);
    const net = settlement.netProfit;
    rounds += 1;
    bankroll += net;
    totalWagered += settlement.totalWagered;
    sumInitialBets += bet;
    if (bet > maxWager) maxWager = bet;
    unavailable += settlement.unavailableActions;
    countOutcome(outcomeCounts, settlement.outcome);
    strategy.update(state, roundResultFromNet(net), net, params);
    lastBet = bet;

    if (bankroll > peak) peak = bankroll;
    else if (peak - bankroll > maxDrawdown) maxDrawdown = peak - bankroll;

    const profit = bankroll - startingBankroll;
    if (nextCheckpoint < checkpoints.length && rounds === checkpoints[nextCheckpoint]) {
      checkpointProfit[nextCheckpoint] = profit;
      checkpointBet[nextCheckpoint] = bet;
      nextCheckpoint += 1;
    }
    if (curve !== null && rounds % plan.curveStride === 0) {
      curve.rounds.push(rounds);
      curve.bankrolls.push(bankroll);
      curve.bets.push(bet);
    }

    // Spec 2.2 steps 1-3, in this order: first crossings, stop target, round limit.
    for (let target = 0; target < targetCount; target += 1) {
      if (firstCrossing[target] === null && profit >= (plan.targetAmounts[target] ?? Infinity)) {
        firstCrossing[target] = rounds;
      }
    }
    if (stopTarget !== null && profit >= stopTarget) {
      stopReason = 'target_reached';
      break;
    }
    if (rounds === roundLimit) {
      stopReason = 'round_limit';
      break;
    }
  }

  const netProfit = bankroll - startingBankroll;
  // Spec 10.1: checkpoints after the stop carry the frozen final profit forward.
  for (let index = nextCheckpoint; index < checkpoints.length; index += 1) {
    checkpointProfit[index] = netProfit;
  }
  if (curve !== null && curve.rounds.at(-1) !== rounds) {
    curve.rounds.push(rounds);
    curve.bankrolls.push(bankroll);
    curve.bets.push(lastBet);
  }

  return {
    simulationId: simulationIndex,
    simulationSeed: seed,
    strategyId: planned.id,
    strategyVersion: planned.version,
    roundsPlayed: rounds,
    startingBankroll,
    finalBankroll: bankroll,
    netProfit,
    totalWagered,
    sumInitialBets,
    maxWager,
    maxDrawdown,
    firstCrossing: {
      '0_5x': firstCrossing[0] ?? null,
      '1x': firstCrossing[1] ?? null,
      '2x': firstCrossing[2] ?? null,
      '2_5x': firstCrossing[3] ?? null,
    },
    stopReason,
    requiredBetAtStop,
    outcomeCounts,
    unavailableActionCount: unavailable,
    minimumOvershootCount: state.minimumOvershootCount,
    minimumOvershootTotal: state.minimumOvershootTotal,
    checkpointProfit,
    checkpointBet,
    curve,
  };
}

function countOutcome(counts: OutcomeCounts, outcome: Outcome): void {
  switch (outcome) {
    case Outcome.Blackjack:
      counts.blackjack += 1;
      return;
    case Outcome.Win:
      counts.win += 1;
      return;
    case Outcome.Push:
      counts.push += 1;
      return;
    case Outcome.Loss:
      counts.loss += 1;
      return;
  }
}
