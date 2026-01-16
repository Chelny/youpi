import { TableChatMessageType } from "db/client";
import { Server as IoServer } from "socket.io";
import {
  BLOCK_BREAK_ANIMATION_DURATION_MS,
  REMOVED_BLOCKS_COUNT_FOR_REMOVE_POWERS,
  REMOVED_BLOCKS_COUNT_FOR_REMOVE_STONES,
  REMOVED_BLOCKS_COUNT_FOR_SPEED_DROP,
  SPEED_DROP_TICK_COUNT,
} from "@/constants/game";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { logger } from "@/lib/logger";
import { publishRedisEvent } from "@/server/redis/publish";
import { TablePlayer } from "@/server/towers/classes/TablePlayer";
import { TableSeat } from "@/server/towers/classes/TableSeat";
import { BlockToRemove, Board } from "@/server/towers/game/board/Board";
import { PowerManager } from "@/server/towers/game/board/PowerManager";
import { CipherHeroManager, CipherKey } from "@/server/towers/game/CipherHeroManager";
import { NextPieces } from "@/server/towers/game/NextPieces";
import { Piece } from "@/server/towers/game/Piece";
import { PieceBlock, PieceBlockPosition, TowersBlockLetter } from "@/server/towers/game/PieceBlock";
import { PowerBar } from "@/server/towers/game/PowerBar";
import { SpecialDiamond } from "@/server/towers/game/SpecialDiamond";
import { TowersPiece } from "@/server/towers/game/TowersPiece";
import { TowersPieceBlock, TowersPieceBlockPlainObject } from "@/server/towers/game/TowersPieceBlock";
import { TableChatMessageManager } from "@/server/towers/managers/TableChatMessageManager";
import { TablePlayerManager } from "@/server/towers/managers/TablePlayerManager";
import { TableSeatManager } from "@/server/towers/managers/TableSeatManager";
import { LoopRunner } from "@/server/towers/utils/LoopRunner";
import { isMedusaPiece, isMidasPiece } from "@/server/towers/utils/piece-type-check";

enum TickSpeed {
  NORMAL = 385,
  DROP = TickSpeed.NORMAL / 6,
  SPEED_DROP = TickSpeed.NORMAL / 5,
  DROP_SPEED_DROP = TickSpeed.SPEED_DROP / 2,
  BREAKING_BLOCKS = 100,
}

/**
 * Represents the game logic and state for a single player in a Towers game.
 *
 * Handles player input, active piece movement, power usage, and game loop logic.
 */
export class PlayerTowersGame {
  private io: IoServer;
  public tableId: string;
  public players: TablePlayer[];
  public tablePlayer: TablePlayer;
  private username: string;
  private currentPiece: Piece | null = null;
  public powerManager: PowerManager;
  private isSpecialSpeedDropActivated: boolean = false;
  private speedDropTicksRemaining: number = 0;
  private pendingSpecialSpeedDrop: boolean = false;
  private loop: LoopRunner = new LoopRunner();
  private tickSpeed: TickSpeed = TickSpeed.NORMAL;
  private isTickInProgress: boolean = false;
  private isPieceLocked: boolean = false;
  private isGameStopped: boolean = false;
  private isGameUpdateInFlight: boolean = false;
  private hasPendingGameUpdate: boolean = false;
  private deps: {
    queueSpeedDropNextPiece: (seatNumber: number) => void
    requestGameOverCheck: () => void
  };

  constructor(
    io: IoServer,
    tableId: string,
    players: TablePlayer[],
    tablePlayer: TablePlayer,
    deps: {
      queueSpeedDropNextPiece: (seatNumber: number) => void
      requestGameOverCheck: () => void
    },
  ) {
    this.io = io;
    this.tableId = tableId;
    this.players = players;
    this.tablePlayer = tablePlayer;
    this.username = tablePlayer.player.user.username;
    this.currentPiece = new TowersPiece();
    this.powerManager = new PowerManager(tableId, players, tablePlayer, deps);
    this.deps = deps;
  }

  public startGameLoop(): void {
    this.loop.start(
      () => this.tickFallPiece(),
      () => this.tickSpeed,
    );
  }

  public async stopGameLoop(): Promise<void> {
    this.isGameStopped = true;
    this.isPieceLocked = false;
    this.updateTickSpeed(TickSpeed.NORMAL);
    this.currentPiece = null;
    this.loop.stop();
    await this.sendGameStateToClient();
  }

  private updateTickSpeed(speed: TickSpeed): void {
    this.tickSpeed = speed;
  }

  /**
   * Current piece falling on the board
   */
  private async tickFallPiece(): Promise<void> {
    if (this.isTickInProgress) return;
    if (this.isGameStopped) return;
    if (!this.tablePlayer.isPlaying) return;

    const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(this.tableId, this.tablePlayer.playerId);
    const nextPieces: NextPieces | null | undefined = tableSeat?.nextPieces;
    const board: Board | null | undefined = tableSeat?.board;
    if (!tableSeat || !nextPieces || !board) return;

    if (board.isGameOver) return;

    const currentPiece: Piece | null = this.currentPiece;
    if (!currentPiece) return;

    this.isTickInProgress = true;

    try {
      const newPosition: PieceBlockPosition = {
        row: currentPiece.position.row + 1,
        col: currentPiece.position.col,
      };

      const simulatedPiece: Piece = Piece.simulateAtPosition(currentPiece, newPosition);

      if (board.hasCollision(simulatedPiece)) {
        this.isPieceLocked = true;
        this.updateTickSpeed(TickSpeed.BREAKING_BLOCKS);

        await this.lockPieceInPlace();
        if (this.isGameStopped) return;

        if (board.checkIfGameOver(currentPiece)) {
          this.tablePlayer.isPlaying = false;
          await TablePlayerManager.upsert(this.tablePlayer);
          this.deps.requestGameOverCheck();
          await this.stopGameLoop();
          return;
        }

        this.speedDropTick();

        // Generate next piece
        this.currentPiece = nextPieces.getNextPiece();

        this.pendingSpeedDrop();

        logger.debug(
          `[Towers: ${this.username}] New piece generated: ${JSON.stringify(this.currentPiece.blocks.map((block: PieceBlock) => block.letter))}`,
        );
      } else {
        currentPiece.position = newPosition;
      }

      await this.sendGameStateToClient();
    } finally {
      this.isTickInProgress = false;
    }
  }

  /**
   * Lock the piece to the board and gets the next one.
   */
  private async lockPieceInPlace(): Promise<void> {
    if (this.isGameStopped) return;

    const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(this.tableId, this.tablePlayer.playerId);
    const board: Board | null | undefined = tableSeat?.board;
    if (!tableSeat || !board) return;

    if (!this.currentPiece) return;

    if (!this.isPieceLocked) {
      this.isPieceLocked = true;
      this.updateTickSpeed(TickSpeed.BREAKING_BLOCKS);
    }

    board.placePiece(this.currentPiece);
    logger.debug(
      `[Towers: ${this.username}] Piece committed to the board at position X=${this.currentPiece.position.col}, Y=${this.currentPiece.position.row}`,
    );

    // Apply piece effects (power blocks)
    if (isMedusaPiece(this.currentPiece) || isMidasPiece(this.currentPiece)) {
      await board.convertSurroundingBlocksToPowerBlocks(this.currentPiece);
      await this.sendGameStateToClient();
    }

    // Run all recursive block-breaking logic
    const { selfOutgoing, partnerOutgoing, isHooOccurred } = await board.processLandedPiece(
      async (board: Board, blocksToRemove: BlockToRemove[]): Promise<void> => {
        await this.waitForClientToFade(board, blocksToRemove);
      },
    );

    if (isHooOccurred) {
      await this.sendCipherKey();
    }

    // Send removed blocks while hoo is detected to opponents
    if (selfOutgoing.length > 0) {
      await publishRedisEvent(ServerInternalEvents.GAME_HOO_SEND_BLOCKS, {
        tableId: this.tableId,
        teamNumber: tableSeat.teamNumber,
        blocks: selfOutgoing.map((block: TowersPieceBlock) =>
          new TowersPieceBlock(block.letter as TowersBlockLetter, block.position).toPlainObject(),
        ),
      });
    }

    if (partnerOutgoing.length > 0 && board.partnerBoard) {
      const partnerSeat: TableSeat | undefined = TableSeatManager.getSeatByBoard(this.tableId, board.partnerBoard);
      if (partnerSeat) {
        await publishRedisEvent(ServerInternalEvents.GAME_HOO_SEND_BLOCKS, {
          tableId: this.tableId,
          teamNumber: partnerSeat.teamNumber,
          blocks: partnerOutgoing.map((block: TowersPieceBlock) =>
            new TowersPieceBlock(block.letter as TowersBlockLetter, block.position).toPlainObject(),
          ),
        });
      }
    }

    this.addSpecialDiamondsToPowerBar();

    this.updateTickSpeed(TickSpeed.NORMAL);
    this.isPieceLocked = false;

    // Force emit partner grid too when it's game over for them
    if (board.partnerBoard && board.partnerBoard.isGameOver) {
      const partnerSeat: TableSeat | undefined = TableSeatManager.getSeatByBoard(this.tableId, board.partnerBoard);

      if (partnerSeat) {
        await publishRedisEvent(ServerInternalEvents.GAME_UPDATE, {
          tableId: this.tableId,
          seatNumber: partnerSeat.seatNumber,
          nextPieces: partnerSeat.nextPieces?.toPlainObject(),
          powerBar: partnerSeat.powerBar?.toPlainObject(),
          board: board.partnerBoard.toPlainObject(),
          currentPiece: null,
        });
      }
    }
  }

  private async waitForClientToFade(board: Board, blocksToRemove: BlockToRemove[]) {
    if (this.isGameStopped) return;

    const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByBoard(this.tableId, board);
    if (!tableSeat) return;

    await publishRedisEvent(ServerInternalEvents.GAME_BLOCKS_MARKED_FOR_REMOVAL, {
      tableId: tableSeat.tableId,
      seatNumber: tableSeat.seatNumber,
      blocks: blocksToRemove,
    });

    // Wait for client animation event, fallback to short timeout
    await new Promise<void>((resolve) => {
      let isSettled: boolean = false;

      const onDone = (data: { tableId: string; seatNumber: number }) => {
        if (isSettled) return;
        if (data.tableId !== this.tableId) return;
        if (data.seatNumber !== tableSeat.seatNumber) return;

        isSettled = true;
        clearTimeout(timeoutId);
        this.io.off(ClientToServerEvents.GAME_CLIENT_BLOCKS_ANIMATION_DONE, onDone);
        resolve();
      };

      this.io.on(ClientToServerEvents.GAME_CLIENT_BLOCKS_ANIMATION_DONE, onDone);

      const timeoutId: NodeJS.Timeout = setTimeout(() => {
        if (isSettled) return;
        isSettled = true;
        this.io.off(ClientToServerEvents.GAME_CLIENT_BLOCKS_ANIMATION_DONE, onDone);
        resolve();
      }, BLOCK_BREAK_ANIMATION_DURATION_MS);
    });

    if (this.isGameStopped) return;
  }

  /**
   * Add special diamonds to the power block based on the total number of broken blocks.
   */
  private addSpecialDiamondsToPowerBar(): void {
    const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(this.tableId, this.tablePlayer.playerId);
    const powerBar: PowerBar | null | undefined = tableSeat?.powerBar;
    const board: Board | null | undefined = tableSeat?.board;

    if (!tableSeat || !powerBar || !board) return;

    if (board.removedBlocksCount >= REMOVED_BLOCKS_COUNT_FOR_SPEED_DROP && !board.isSpeedDropUnlocked) {
      powerBar.addItem(new SpecialDiamond("speed drop"));
      board.isSpeedDropUnlocked = true;
    }

    if (board.removedBlocksCount >= REMOVED_BLOCKS_COUNT_FOR_REMOVE_POWERS && !board.isRemovePowersUnlocked) {
      powerBar.addItem(new SpecialDiamond("remove powers"));
      board.isRemovePowersUnlocked = true;
    }

    if (board.removedBlocksCount >= REMOVED_BLOCKS_COUNT_FOR_REMOVE_STONES && !board.isRemoveStonesUnlocked) {
      powerBar.addItem(new SpecialDiamond("remove stones"));
      board.isRemoveStonesUnlocked = true;
    }
  }

  public inputMovePiece(direction: "left" | "right"): void {
    if (!this.canProcessInput()) return;
    if (direction === "left") this.movePieceLeft();
    if (direction === "right") this.movePieceRight();
  }

  /**
   * Moves the current piece to the left.
   */
  private movePieceLeft(): void {
    const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(this.tableId, this.tablePlayer.playerId);
    const board: Board | null | undefined = tableSeat?.board;
    if (!tableSeat || !board) return;

    if (!this.currentPiece) return;

    const newPosition: PieceBlockPosition = {
      row: this.currentPiece.position.row,
      col: this.currentPiece.position.col - 1,
    };
    const simulatedPiece: Piece = Piece.simulateAtPosition(this.currentPiece, newPosition);

    if (!board.hasCollision(simulatedPiece)) {
      this.currentPiece.position = newPosition;
      this.queueSendGameState();
    }
  }

  /**
   * Moves the current piece to the right.
   */
  private movePieceRight(): void {
    const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(this.tableId, this.tablePlayer.playerId);
    const board: Board | null | undefined = tableSeat?.board;
    if (!tableSeat || !board) return;

    if (!this.currentPiece) return;

    const newPosition: PieceBlockPosition = {
      row: this.currentPiece.position.row,
      col: this.currentPiece.position.col + 1,
    };
    const simulatedPiece: Piece = Piece.simulateAtPosition(this.currentPiece, newPosition);

    if (!board.hasCollision(simulatedPiece)) {
      this.currentPiece.position = newPosition;
      this.queueSendGameState();
    }
  }

  /**
   * Cycles the piece blocks up.
   */
  public cyclePieceBlocks(): void {
    if (!this.canProcessInput() || !this.currentPiece) return;
    this.currentPiece.cycleBlocks();
    this.queueSendGameState();
  }

  /**
   * Increases the piece drop speed.
   */
  public movePieceDown(): void {
    if (!this.canProcessInput()) return;
    this.updateTickSpeed(this.isSpecialSpeedDropActivated ? TickSpeed.DROP_SPEED_DROP : TickSpeed.DROP);
    this.queueSendGameState();
  }

  /**
   * Stops the piece from moving down fast.
   */
  public stopMovingPieceDown(): void {
    if (!this.canProcessInput()) return;
    if (this.isSpecialSpeedDropActivated) return;
    this.updateTickSpeed(TickSpeed.NORMAL);
    this.queueSendGameState();
  }

  /**
   * Use a power from the power bar.
   * @param targetSeatNumber - Optional. The seat number to target.
   */
  public usePower(targetSeatNumber?: number): void {
    if (!this.canProcessInput()) return;
    this.powerManager.usePower(targetSeatNumber);
    this.queueSendGameState();
  }

  public applyHooBlocks({ teamNumber, blocks }: { teamNumber: number; blocks: TowersPieceBlockPlainObject[] }): void {
    if (!blocks || blocks.length === 0 || this.isPieceLocked) return;

    const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(this.tableId, this.tablePlayer.playerId);
    const board: Board | null | undefined = tableSeat?.board;
    if (!tableSeat || !board) return;

    const isPartner: boolean = tableSeat.teamNumber === teamNumber;

    if (!isPartner && this.tablePlayer.isPlaying && !board?.isGameOver) {
      board.placeBlocksFromHoo(blocks.map(TowersPieceBlock.fromPlainObject));
    }
  }

  public queueSpecialSpeedDropNextPiece(): void {
    this.pendingSpecialSpeedDrop = true;
    this.speedDropTicksRemaining = SPEED_DROP_TICK_COUNT;
  }

  private pendingSpeedDrop(): void {
    if (!this.pendingSpecialSpeedDrop) return;
    this.pendingSpecialSpeedDrop = false;
    this.activateSpecialSpeedDrop();
  }

  private speedDropTick(): void {
    if (!this.isSpecialSpeedDropActivated) return;

    this.speedDropTicksRemaining--;

    if (this.speedDropTicksRemaining > 0) {
      this.activateSpecialSpeedDrop();
    } else {
      this.deactivateSpecialSpeedDrop();
    }
  }

  public activateSpecialSpeedDrop(): void {
    this.isSpecialSpeedDropActivated = true;
    this.updateTickSpeed(TickSpeed.SPEED_DROP);
  }

  public deactivateSpecialSpeedDrop(): void {
    this.isSpecialSpeedDropActivated = false;
    this.updateTickSpeed(TickSpeed.NORMAL);
  }

  /**
   * True when this input is allowed to be processed by this PlayerTowersGame instance.
   * - Must be for this player's current seat
   * - Player must be playing
   * - Piece must not be locked
   */
  private canProcessInput(): boolean {
    if (this.tablePlayer.seatNumber == null) return false;
    if (!this.tablePlayer.isPlaying) return false;
    if (this.isPieceLocked) return false;
    if (this.isGameStopped) return false;
    if (!this.currentPiece) return false;
    return true;
  }

  /**
   * Generates and sends a cipher key to the current player if one is available.
   *
   * This method attempts to generate a new `CipherKey` for the user via the `CipherHeroManager`.
   * If a key is awarded, it emits a `CIPHER_KEY` chat message visible only to the recipient.
   * This message contains the encrypted and decrypted character pair.
   *
   * Typical use case: reward system after gameplay milestones (e.g., clearing lines, surviving a turn, etc.).
   */
  private async sendCipherKey(): Promise<void> {
    const cipherKey: CipherKey | null = CipherHeroManager.getCipherKey(this.tablePlayer.playerId);

    if (cipherKey) {
      await TableChatMessageManager.create({
        tableId: this.tableId,
        player: this.tablePlayer.player,
        text: null,
        type: TableChatMessageType.CIPHER_KEY,
        textVariables: { plainChar: cipherKey.plainChar, cipherChar: cipherKey.cipherChar },
        visibleToUserId: this.tablePlayer.playerId,
      });
    }
  }

  public queueSendGameState(): void {
    this.hasPendingGameUpdate = true;

    if (this.isGameUpdateInFlight) return;

    this.isGameUpdateInFlight = true;

    void (async () => {
      try {
        while (this.hasPendingGameUpdate) {
          this.hasPendingGameUpdate = false;
          await this.sendGameStateToClient();
        }
      } catch (err) {
        logger.error(`[Towers: ${this.username}] GAME_UPDATE failed`, err);
      } finally {
        this.isGameUpdateInFlight = false;
      }
    })();
  }

  public async sendGameStateToClient(): Promise<void> {
    const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(this.tableId, this.tablePlayer.playerId);

    await publishRedisEvent(ServerInternalEvents.GAME_UPDATE, {
      tableId: this.tableId,
      seatNumber: tableSeat?.seatNumber,
      nextPieces: tableSeat?.nextPieces?.toPlainObject(),
      powerBar: tableSeat?.powerBar?.toPlainObject(),
      board: tableSeat?.board?.toPlainObject(),
      currentPiece: this.currentPiece ? this.currentPiece.toPlainObject() : null,
    });
  }
}
