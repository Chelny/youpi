import { Server as IoServer } from "socket.io";
import { TickSpeed } from "@/enums/towers-tick-speed";
import { BlockToRemove, Board } from "@/server/towers/game/board/board";
import { PowerManager } from "@/server/towers/game/board/power-manager";
import * as GameLoopHoo from "@/server/towers/game/game-loop/game-loop-hoo";
import * as GameLoopInput from "@/server/towers/game/game-loop/game-loop-input";
import * as GameLoopLock from "@/server/towers/game/game-loop/game-loop-lock";
import * as GameLoopPowers from "@/server/towers/game/game-loop/game-loop-powers";
import * as GameLoopRuntime from "@/server/towers/game/game-loop/game-loop-runtime";
import * as GameLoopSync from "@/server/towers/game/game-loop/game-loop-sync";
import { GameLoopDependencies } from "@/server/towers/game/game-loop/game-loop-types";
import { Piece } from "@/server/towers/game/pieces/piece";
import { TowersPiece } from "@/server/towers/game/pieces/towers/towers-piece";
import { TowersPieceBlockPlainObject } from "@/server/towers/game/pieces/towers/towers-piece-block";
import { TablePlayer } from "@/server/towers/modules/table-player/table-player.entity";
import { LoopRunner } from "@/server/towers/utils/loop-runner";

/**
 * Represents the game logic and state for a single player in a Towers game.
 *
 * Handles player input, active piece movement, power usage, and game loop logic.
 */
export class GameLoop {
  public readonly io: IoServer;
  public readonly tableId: string;
  public readonly players: TablePlayer[];
  public readonly tablePlayer: TablePlayer;
  public currentPiece: Piece | null = null;
  public powerManager: PowerManager;
  public isSpecialSpeedDropActivated: boolean = false;
  public speedDropTicksRemaining: number = 0;
  public pendingSpecialSpeedDrop: boolean = false;
  public loop: LoopRunner = new LoopRunner();
  public isTickInProgress: boolean = false;
  public isPieceLocked: boolean = false;
  public isGameStopped: boolean = false;
  public isGameUpdateInFlight: boolean = false;
  public hasPendingGameUpdate: boolean = false;
  public deps: GameLoopDependencies;
  private _tickSpeed: TickSpeed = TickSpeed.NORMAL;

  constructor(
    io: IoServer,
    tableId: string,
    players: TablePlayer[],
    tablePlayer: TablePlayer,
    deps: GameLoopDependencies,
  ) {
    this.io = io;
    this.tableId = tableId;
    this.players = players;
    this.tablePlayer = tablePlayer;
    this.deps = deps;
    this.currentPiece = new TowersPiece();
    this.powerManager = new PowerManager(tableId, players, tablePlayer, deps);
  }

  public get tickSpeed(): TickSpeed {
    return this._tickSpeed;
  }

  public set tickSpeed(value: TickSpeed) {
    this._tickSpeed = value;
  }

  public startGameLoop(): void {
    GameLoopRuntime.startGameLoop(this);
  }

  public async stopGameLoop(): Promise<void> {
    return await GameLoopRuntime.stopGameLoop(this);
  }

  public async tickFallPiece(): Promise<void> {
    return await GameLoopRuntime.tickFallPiece(this);
  }

  public async lockPieceInPlace(): Promise<void> {
    return await GameLoopLock.lockPieceInPlace(this);
  }

  public async waitForClientToFade(board: Board, blocks: BlockToRemove[]): Promise<void> {
    return await GameLoopLock.waitForClientToFade(this, board, blocks);
  }

  public canProcessInput(): boolean {
    return GameLoopInput.canProcessInput(this);
  }

  public movePieceSide(direction: "left" | "right"): void {
    GameLoopInput.movePieceSide(this, direction);
  }

  public cyclePieceBlocks(): void {
    GameLoopInput.cyclePieceBlocks(this);
  }

  public movePieceDown(): void {
    GameLoopInput.movePieceDown(this);
  }

  public stopMovingPieceDown(): void {
    GameLoopInput.stopMovingPieceDown(this);
  }

  public usePower(targetSeatNumber?: number): void {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    GameLoopPowers.usePower(this, targetSeatNumber);
  }

  public addSpecialDiamondsToPowerBar(): void {
    GameLoopPowers.addSpecialDiamondsToPowerBar(this);
  }

  public queueSpecialSpeedDropNextPiece(): void {
    GameLoopPowers.queueSpecialSpeedDropNextPiece(this);
  }

  public pendingSpeedDrop(): void {
    GameLoopPowers.pendingSpeedDrop(this);
  }

  public speedDropTick(): void {
    GameLoopPowers.speedDropTick(this);
  }

  public activateSpecialSpeedDrop(): void {
    GameLoopPowers.activateSpecialSpeedDrop(this);
  }

  public deactivateSpecialSpeedDrop(): void {
    GameLoopPowers.deactivateSpecialSpeedDrop(this);
  }

  public applyHooBlocks(teamNumber: number, blocks: TowersPieceBlockPlainObject[]): void {
    GameLoopHoo.applyHooBlocks(this, teamNumber, blocks);
  }

  public async sendCipherKey(): Promise<void> {
    await GameLoopHoo.sendCipherKey(this);
  }

  public queueSendGameState(): void {
    GameLoopSync.queueSendGameState(this);
  }

  public async sendGameStateToClient(): Promise<void> {
    await GameLoopSync.sendGameStateToClient(this);
  }
}
