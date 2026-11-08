import { floorDivide } from '../../../shared/money';
import type { StopReason } from '../../../shared/stopReasons';
import { checkRequiredBet } from '../betCheck';
import { roundResultFromNet } from '../roundResult';
import type { BettingStrategy, StrategyParams, StrategyStateBase } from '../strategy';

// Test-only replay of the spec 7.1 outcome codes against a strategy, with the spec 2.2 bet
// checks before every round. The real simulation runner arrives in Phase 5.

/** Spec 7.1 outcome codes, defined relative to the round's initial bet b. */
export const OUTCOMES = {
  W: { net: (b: number) => b, stake: (b: number) => b },
  L: { net: (b: number) => -b, stake: (b: number) => b },
  P: { net: () => 0, stake: (b: number) => b },
  BJ: { net: (b: number) => floorDivide(3 * b, 2), stake: (b: number) => b },
  DW: { net: (b: number) => 2 * b, stake: (b: number) => 2 * b },
  DL: { net: (b: number) => -2 * b, stake: (b: number) => 2 * b },
  S0: { net: () => 0, stake: (b: number) => 2 * b },
  'S+': { net: (b: number) => b, stake: (b: number) => 3 * b },
  'S-': { net: (b: number) => -b, stake: (b: number) => 3 * b },
} as const;

export type OutcomeCode = keyof typeof OUTCOMES;

/** Spec 7.1 shared sequence. */
export const SHARED_SEQUENCE: readonly OutcomeCode[] = [
  'W',
  'BJ',
  'W',
  'P',
  'DW',
  'L',
  'S0',
  'DL',
  'L',
  'W',
  'S+',
  'S-',
  'W',
  'BJ',
];

export interface ReplayRow {
  bet: number;
  net: number;
  profit: number;
  bankroll: number;
  next: number;
}

export interface ReplayResult<State> {
  rows: ReplayRow[];
  states: State[];
  stop: { reason: Extract<StopReason, 'bust' | 'blocked_table_max'>; requiredBet: number } | null;
  finalBankroll: number;
  netProfit: number;
  totalWagered: number;
  maxWager: number;
  finalState: State;
}

export interface ReplaySetup {
  params: StrategyParams;
  startingBankroll: number;
  tableMaximum: number | null;
}

export function replay<State extends StrategyStateBase>(
  strategy: BettingStrategy<State>,
  setup: ReplaySetup,
  outcomes: readonly OutcomeCode[],
): ReplayResult<State> {
  const { params, startingBankroll, tableMaximum } = setup;
  const state = strategy.createState(params);
  const rows: ReplayRow[] = [];
  const states: State[] = [];
  let bankroll = startingBankroll;
  let totalWagered = 0;
  let maxWager = 0;
  let stop: ReplayResult<State>['stop'] = null;

  // Spec 2.2: the bet check runs before every round, including the one after the last outcome.
  for (let index = 0; index <= outcomes.length; index += 1) {
    const bet = strategy.nextBet(state, params);
    const reason = checkRequiredBet(bet, bankroll, tableMaximum);
    if (reason !== null) {
      stop = { reason, requiredBet: bet };
      break;
    }
    const code = outcomes[index];
    if (code === undefined) break;
    const outcome = OUTCOMES[code];
    const net = outcome.net(bet);
    bankroll += net;
    totalWagered += outcome.stake(bet);
    maxWager = Math.max(maxWager, bet);
    strategy.update(state, roundResultFromNet(net), net, params);
    states.push({ ...state });
    rows.push({
      bet,
      net,
      profit: bankroll - startingBankroll,
      bankroll,
      next: strategy.nextBet(state, params),
    });
  }

  return {
    rows,
    states,
    stop,
    finalBankroll: bankroll,
    netProfit: bankroll - startingBankroll,
    totalWagered,
    maxWager,
    finalState: state,
  };
}

/** Spec 7.1 defaults in cents: bankroll 500.00, minimum and unit 20.00, Paroli N = 3. */
export const DEFAULT_SETUP: ReplaySetup = {
  params: { unit: 2000, tableMinimum: 2000, paroliStreakLength: 3 },
  startingBankroll: 50_000,
  tableMaximum: null,
};

/** Converts the whole currency units used in spec tables to cents, without floating point. */
export function cents(units: number): number {
  if (!Number.isSafeInteger(units)) throw new RangeError(`Expected whole units, got ${units}`);
  return units * 100;
}
