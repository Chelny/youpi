import type { GameLoop } from "@/server/towers/game/game-loop/game-loop";
import { TickSpeed } from "@/enums/towers-tick-speed";
import { logger } from "@/lib/logger";
import { Board } from "@/server/towers/game/board/board";
import { NextPieces } from "@/server/towers/game/next-pieces";
import { Piece } from "@/server/towers/game/pieces/piece";
import { PieceBlock, PieceBlockPosition } from "@/server/towers/game/pieces/piece-block";
import { TablePlayerManager } from "@/server/towers/modules/table-player/table-player.manager";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";
import { TableSeatManager } from "@/server/towers/modules/table-seat/table-seat.manager";

export function startGameLoop(gameLoop: GameLoop): void {
  gameLoop.loop.start(
    () => gameLoop.tickFallPiece(),
    () => gameLoop.tickSpeed,
  );
}

export async function stopGameLoop(gameLoop: GameLoop): Promise<void> {
  gameLoop.isGameStopped = true;
  gameLoop.isPieceLocked = false;
  gameLoop.tickSpeed = TickSpeed.NORMAL;
  gameLoop.currentPiece = null;
  gameLoop.loop.stop();
  await gameLoop.sendGameStateToClient();
}

/**
 * Current piece falling on the board
 */
export async function tickFallPiece(gameLoop: GameLoop): Promise<void> {
  if (gameLoop.isTickInProgress) return;
  if (gameLoop.isGameStopped) return;
  if (!gameLoop.tablePlayer.isPlaying) return;

  const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(
    gameLoop.tableId,
    gameLoop.tablePlayer.playerId,
  );
  const nextPieces: NextPieces | null | undefined = tableSeat?.nextPieces;
  const board: Board | null | undefined = tableSeat?.board;
  if (!tableSeat || !nextPieces || !board) return;

  if (board.isGameOver) return;

  const currentPiece: Piece | null = gameLoop.currentPiece;
  if (!currentPiece) return;

  gameLoop.isTickInProgress = true;

  try {
    const newPosition: PieceBlockPosition = {
      row: currentPiece.position.row + 1,
      col: currentPiece.position.col,
    };

    const simulatedPiece: Piece = Piece.simulateAtPosition(currentPiece, newPosition);

    if (board.hasCollision(simulatedPiece)) {
      gameLoop.isPieceLocked = true;
      gameLoop.tickSpeed = TickSpeed.BREAKING_BLOCKS;

      await gameLoop.lockPieceInPlace();
      if (gameLoop.isGameStopped) return;

      if (board.checkIfGameOver(currentPiece)) {
        gameLoop.tablePlayer.isPlaying = false;
        await TablePlayerManager.upsert(gameLoop.tablePlayer);
        gameLoop.deps.requestGameOverCheck?.();
        await gameLoop.stopGameLoop();
        return;
      }

      gameLoop.speedDropTick();

      // Generate next piece
      gameLoop.currentPiece = nextPieces.getNextPiece();

      gameLoop.pendingSpeedDrop();

      logger.debug(
        `[Towers: ${gameLoop.tablePlayer.player.user.username}] New piece generated: ${JSON.stringify(gameLoop.currentPiece.blocks.map((block: PieceBlock) => block.letter))}`,
      );
    } else {
      currentPiece.position = newPosition;
    }

    await gameLoop.sendGameStateToClient();
  } finally {
    gameLoop.isTickInProgress = false;
  }
}
