import type { GameLoop } from "@/server/towers/game/game-loop/game-loop";
import { TickSpeed } from "@/enums/towers-tick-speed";
import { Board } from "@/server/towers/game/board/board";
import { Piece } from "@/server/towers/game/pieces/piece";
import { PieceBlockPosition } from "@/server/towers/game/pieces/piece-block";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";
import { TableSeatManager } from "@/server/towers/modules/table-seat/table-seat.manager";

/**
 * True when this input is allowed to be processed by this GameLoop instance.
 * - Must be for this player's current seat
 * - Player must be playing
 * - Piece must not be locked
 */
export function canProcessInput(gameLoop: GameLoop): boolean {
  if (gameLoop.tablePlayer.seatNumber == null) return false;
  if (!gameLoop.tablePlayer.isPlaying) return false;
  if (gameLoop.isPieceLocked) return false;
  if (gameLoop.isGameStopped) return false;
  if (!gameLoop.currentPiece) return false;
  return true;
}

export function movePieceSide(gameLoop: GameLoop, direction: "left" | "right"): void {
  if (!canProcessInput(gameLoop)) return;
  if (direction === "left") movePieceLeft(gameLoop);
  if (direction === "right") movePieceRight(gameLoop);
}

/**
 * Moves the current piece to the left.
 */
export function movePieceLeft(gameLoop: GameLoop): void {
  const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(
    gameLoop.tableId,
    gameLoop.tablePlayer.playerId,
  );
  const board: Board | null | undefined = tableSeat?.board;
  if (!tableSeat || !board) return;

  if (!gameLoop.currentPiece) return;

  const newPosition: PieceBlockPosition = {
    row: gameLoop.currentPiece.position.row,
    col: gameLoop.currentPiece.position.col - 1,
  };
  const simulatedPiece: Piece = Piece.simulateAtPosition(gameLoop.currentPiece, newPosition);

  if (!board.hasCollision(simulatedPiece)) {
    gameLoop.currentPiece.position = newPosition;
    gameLoop.queueSendGameState();
  }
}

/**
 * Moves the current piece to the right.
 */
export function movePieceRight(gameLoop: GameLoop): void {
  const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(
    gameLoop.tableId,
    gameLoop.tablePlayer.playerId,
  );
  const board: Board | null | undefined = tableSeat?.board;
  if (!tableSeat || !board) return;

  if (!gameLoop.currentPiece) return;

  const newPosition: PieceBlockPosition = {
    row: gameLoop.currentPiece.position.row,
    col: gameLoop.currentPiece.position.col + 1,
  };
  const simulatedPiece: Piece = Piece.simulateAtPosition(gameLoop.currentPiece, newPosition);

  if (!board.hasCollision(simulatedPiece)) {
    gameLoop.currentPiece.position = newPosition;
    gameLoop.queueSendGameState();
  }
}

/**
 * Cycles the piece blocks up.
 */
export function cyclePieceBlocks(gameLoop: GameLoop): void {
  if (!canProcessInput(gameLoop) || !gameLoop.currentPiece) return;
  gameLoop.currentPiece.cycleBlocks();
  gameLoop.queueSendGameState();
}

/**
 * Increases the piece drop speed.
 */
export function movePieceDown(gameLoop: GameLoop): void {
  if (!canProcessInput(gameLoop)) return;
  gameLoop.tickSpeed = gameLoop.isSpecialSpeedDropActivated ? TickSpeed.DROP_SPEED_DROP : TickSpeed.DROP;
  gameLoop.queueSendGameState();
}

/**
 * Stops the piece from moving down fast.
 */
export function stopMovingPieceDown(gameLoop: GameLoop): void {
  if (!canProcessInput(gameLoop)) return;
  if (gameLoop.isSpecialSpeedDropActivated) return;
  gameLoop.tickSpeed = TickSpeed.NORMAL;
  gameLoop.queueSendGameState();
}
