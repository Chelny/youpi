import { createId } from "@paralleldrive/cuid2";
import { GameState } from "db/client";
import { Server as IoServer } from "socket.io";
import type { Table } from "@/server/towers/modules/table/table.entity";
import * as GameCleanup from "@/server/towers/game/game/game-cleanup";
import * as GameLifecycle from "@/server/towers/game/game/game-lifecycle";
import * as GameOver from "@/server/towers/game/game/game-over";
import * as GameRuntime from "@/server/towers/game/game/game-runtime";
import * as GameSetup from "@/server/towers/game/game/game-setup";
import { GameLoop } from "@/server/towers/game/game-loop/game-loop";
import { TowersPieceBlockPlainObject } from "@/server/towers/game/pieces/towers/towers-piece-block";
import { TablePlayer, TablePlayerPlainObject } from "@/server/towers/modules/table-player/table-player.entity";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";

export interface GamePlainObject {
  readonly id: string
  readonly state: GameState
  readonly countdown: number | null
  readonly timer: number | null
  readonly playerIdsThisRound: string[]
  readonly winners: TablePlayerPlainObject[]
}

type RoundPlayer = { playerId: string; teamNumber: number };

export class Game {
  public readonly io: IoServer;
  public readonly id: string;
  public readonly table: Table;
  public playersThisRound: RoundPlayer[] = [];
  public winners: TablePlayer[] = [];
  public playerGameInstances: Map<string, GameLoop> = new Map<string, GameLoop>();
  public playerGamesBySeat: Map<number, GameLoop> = new Map<number, GameLoop>();
  public isGameOver: boolean = false;
  public gameOverCheckQueued: boolean = false;
  public countdownIntervalId: NodeJS.Timeout | null = null;
  public gameTimerIntervalId: NodeJS.Timeout | null = null;
  private _state: GameState = GameState.WAITING;
  private _countdown: number | null = null;
  private _timer: number | null = null;

  constructor(io: IoServer, table: Table) {
    this.io = io;
    this.id = createId();
    this.table = table;
  }

  public get playerIdsThisRound(): string[] {
    return this.playersThisRound.map((rp: RoundPlayer) => rp.playerId);
  }

  public get state(): GameState {
    return this._state;
  }

  public set state(state: GameState) {
    // Clear board before starting a new game
    if (state === GameState.COUNTDOWN && state !== this._state) {
      this.table.seats.forEach((ts: TableSeat) => ts.clearSeatGame());
      GameLifecycle.emitClearedBoardsToAll(this);
    }

    this._state = state;
    GameLifecycle.emitGameStateToAll(this);
  }

  public get countdown(): number | null {
    return this._countdown;
  }

  public set countdown(value: number | null) {
    this._countdown = value;
    GameLifecycle.emitCountdownToAll(this);
  }

  public get timer(): number | null {
    return this._timer;
  }

  public set timer(value: number | null) {
    this._timer = value;
    GameLifecycle.emitTimerToAll(this);
  }

  public startCountdown(): void {
    GameLifecycle.startCountdown(this);
  }

  public async startGame(): Promise<void> {
    return GameSetup.startGame(this);
  }

  public async applyHooBlocksToOpponents(team: number, blocks: TowersPieceBlockPlainObject[]): Promise<void> {
    return GameRuntime.applyHooBlocksToOpponents(this, team, blocks);
  }

  public queueSpeedDropNextPiece(seat: number): void {
    GameRuntime.queueSpeedDropNextPiece(this, seat);
  }

  public requestGameOverCheck(): void {
    GameRuntime.requestGameOverCheck(this);
  }

  public handleUserDepartureMidGame(tp: TablePlayer): void {
    GameRuntime.handleUserDepartureMidGame(this, tp);
  }

  public gameOver(timer?: number | null, winners?: TablePlayer[]): Promise<void> {
    return GameOver.gameOver(this, timer, winners);
  }

  public reset(): void {
    GameCleanup.reset(this);
  }

  public destroy(): void {
    GameCleanup.destroy(this);
  }

  public getPlayerGameBySeat(seatNumber: number): GameLoop | undefined {
    return this.playerGamesBySeat.get(seatNumber);
  }
}
