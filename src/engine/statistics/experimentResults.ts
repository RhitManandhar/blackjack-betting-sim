import { STOP_REASONS, type StopReason } from '../../shared/stopReasons';
import type { StrategyId } from '../../shared/strategies';
import { TARGET_IDS, type TargetId } from '../../shared/targets';
import type { StrategySimulationResult } from '../simulation/runSimulation';
import { CheckpointAggregate, checkpointLayout } from './checkpointAggregate';

// Compact store of every completed simulation (spec 10.1), one typed-array column per field,
// indexed by simulation id. Placing rows by id, and computing statistics from the full table,
// means the order in which simulations or chunks arrive cannot change any result (spec 8.4).
// Never stores per-round data. Curves are display data and are not kept here.

const NOT_REACHED = -1;
const NO_REQUIRED_BET = -1;

export interface ExperimentShape {
  readonly simulations: number;
  readonly strategies: readonly { readonly id: StrategyId; readonly version: string }[];
  readonly startingBankroll: number;
  readonly checkpoints: readonly number[];
}

export class StrategyColumns {
  readonly roundsPlayed: Int32Array;
  readonly netProfit: Float64Array;
  readonly totalWagered: Float64Array;
  readonly sumInitialBets: Float64Array;
  readonly maxWager: Float64Array;
  readonly maxDrawdown: Float64Array;
  /** One column per target in TARGET_IDS order; -1 means not reached. */
  readonly firstCrossing: readonly Int32Array[];
  /** Index into STOP_REASONS. */
  readonly stopReason: Uint8Array;
  /** -1 means none. */
  readonly requiredBetAtStop: Float64Array;
  readonly blackjacks: Int32Array;
  readonly wins: Int32Array;
  readonly pushes: Int32Array;
  readonly losses: Int32Array;
  readonly unavailableActions: Int32Array;
  readonly overshootCount: Int32Array;
  readonly overshootTotal: Float64Array;
  /** One aggregate per configured checkpoint. */
  readonly checkpoints: readonly CheckpointAggregate[];

  constructor(simulations: number, startingBankroll: number, checkpointCount: number) {
    this.roundsPlayed = new Int32Array(simulations);
    this.netProfit = new Float64Array(simulations);
    this.totalWagered = new Float64Array(simulations);
    this.sumInitialBets = new Float64Array(simulations);
    this.maxWager = new Float64Array(simulations);
    this.maxDrawdown = new Float64Array(simulations);
    this.firstCrossing = TARGET_IDS.map(() => new Int32Array(simulations));
    this.stopReason = new Uint8Array(simulations);
    this.requiredBetAtStop = new Float64Array(simulations);
    this.blackjacks = new Int32Array(simulations);
    this.wins = new Int32Array(simulations);
    this.pushes = new Int32Array(simulations);
    this.losses = new Int32Array(simulations);
    this.unavailableActions = new Int32Array(simulations);
    this.overshootCount = new Int32Array(simulations);
    this.overshootTotal = new Float64Array(simulations);
    const layout = checkpointLayout(startingBankroll);
    this.checkpoints = Array.from(
      { length: checkpointCount },
      () => new CheckpointAggregate(layout),
    );
  }

  firstCrossingAt(target: TargetId, simulation: number): number | null {
    const round = this.firstCrossing[TARGET_IDS.indexOf(target)]?.[simulation] ?? NOT_REACHED;
    return round === NOT_REACHED ? null : round;
  }

  stopReasonAt(simulation: number): StopReason {
    const reason = STOP_REASONS[this.stopReason[simulation] ?? 0];
    if (reason === undefined) throw new Error('Corrupt stop reason');
    return reason;
  }

  requiredBetAt(simulation: number): number | null {
    const bet = this.requiredBetAtStop[simulation] ?? NO_REQUIRED_BET;
    return bet === NO_REQUIRED_BET ? null : bet;
  }
}

export class ExperimentResults {
  readonly columns: readonly StrategyColumns[];
  private readonly filled: Uint8Array;
  private completedCount = 0;

  constructor(readonly shape: ExperimentShape) {
    this.filled = new Uint8Array(shape.simulations);
    this.columns = shape.strategies.map(
      () =>
        new StrategyColumns(shape.simulations, shape.startingBankroll, shape.checkpoints.length),
    );
  }

  get completed(): number {
    return this.completedCount;
  }

  isCompleted(simulation: number): boolean {
    return this.filled[simulation] === 1;
  }

  /** Adds one completed simulation. Adding the same simulation twice is an error, never a double count. */
  add(results: readonly StrategySimulationResult[]): void {
    const first = results[0];
    if (first === undefined || results.length !== this.columns.length) {
      throw new Error('A simulation result must contain every configured strategy');
    }
    const simulation = first.simulationId;
    if (simulation < 0 || simulation >= this.shape.simulations) {
      throw new RangeError(`Simulation ${String(simulation)} is outside this experiment`);
    }
    if (this.isCompleted(simulation)) {
      throw new Error(`Simulation ${String(simulation)} was already added`);
    }
    results.forEach((result, strategyIndex) => {
      const expected = this.shape.strategies[strategyIndex];
      if (result.simulationId !== simulation || result.strategyId !== expected?.id) {
        throw new Error('Simulation results are out of order');
      }
      this.store(this.columns[strategyIndex], simulation, result);
    });
    this.filled[simulation] = 1;
    this.completedCount += 1;
  }

  private store(
    columns: StrategyColumns | undefined,
    simulation: number,
    result: StrategySimulationResult,
  ): void {
    if (columns === undefined) throw new Error('Unknown strategy column');
    columns.roundsPlayed[simulation] = result.roundsPlayed;
    columns.netProfit[simulation] = result.netProfit;
    columns.totalWagered[simulation] = result.totalWagered;
    columns.sumInitialBets[simulation] = result.sumInitialBets;
    columns.maxWager[simulation] = result.maxWager;
    columns.maxDrawdown[simulation] = result.maxDrawdown;
    TARGET_IDS.forEach((target, index) => {
      const column = columns.firstCrossing[index];
      if (column !== undefined) column[simulation] = result.firstCrossing[target] ?? NOT_REACHED;
    });
    columns.stopReason[simulation] = STOP_REASONS.indexOf(result.stopReason);
    columns.requiredBetAtStop[simulation] = result.requiredBetAtStop ?? NO_REQUIRED_BET;
    columns.blackjacks[simulation] = result.outcomeCounts.blackjack;
    columns.wins[simulation] = result.outcomeCounts.win;
    columns.pushes[simulation] = result.outcomeCounts.push;
    columns.losses[simulation] = result.outcomeCounts.loss;
    columns.unavailableActions[simulation] = result.unavailableActionCount;
    columns.overshootCount[simulation] = result.minimumOvershootCount;
    columns.overshootTotal[simulation] = result.minimumOvershootTotal;
    result.checkpointProfit.forEach((profit, index) => {
      columns.checkpoints[index]?.add(profit);
    });
  }
}
