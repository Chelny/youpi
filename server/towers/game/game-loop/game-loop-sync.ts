import type { GameLoop } from "@/server/towers/game/game-loop/game-loop";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { logger } from "@/lib/logger";
import { publishRedisEvent } from "@/server/redis/publish";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";
import { TableSeatManager } from "@/server/towers/modules/table-seat/table-seat.manager";

/**
 * Queues a game state update to the client.
 *
 * Ensures only one update is sent at a time. If an update is already in progress,
 * subsequent calls mark that another update is needed. Rapid changes are
 * batched, and errors are logged without blocking future updates.
 */
export function queueSendGameState(gameLoop: GameLoop): void {
  gameLoop.hasPendingGameUpdate = true;

  if (gameLoop.isGameUpdateInFlight) return;

  gameLoop.isGameUpdateInFlight = true;

  void (async () => {
    try {
      while (gameLoop.hasPendingGameUpdate) {
        gameLoop.hasPendingGameUpdate = false;
        await gameLoop.sendGameStateToClient();
      }
    } catch (err) {
      logger.error(`[Towers: ${gameLoop.tablePlayer.player.user.username}] GAME_BOARD update failed`, err);
    } finally {
      gameLoop.isGameUpdateInFlight = false;
    }
  })();
}

export async function sendGameStateToClient(gameLoop: GameLoop): Promise<void> {
  const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(
    gameLoop.tableId,
    gameLoop.tablePlayer.playerId,
  );

  await publishRedisEvent(ServerInternalEvents.GAME_BOARD, {
    tableId: gameLoop.tableId,
    seatNumber: tableSeat?.seatNumber,
    nextPieces: tableSeat?.nextPieces?.toPlainObject(),
    powerBar: tableSeat?.powerBar?.toPlainObject(),
    board: tableSeat?.board?.toPlainObject(),
    currentPiece: gameLoop.currentPiece ? gameLoop.currentPiece.toPlainObject() : null,
  });
}
