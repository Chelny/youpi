import { GameState } from "db/client";
import type { Game } from "@/server/towers/game/game/game";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { logger } from "@/lib/logger";
import { publishRedisEvent } from "@/server/redis/publish";
import * as GameRewards from "@/server/towers/game/game/game-rewards";
import { GameLoop } from "@/server/towers/game/game-loop/game-loop";
import { TablePlayer } from "@/server/towers/modules/table-player/table-player.entity";
import { delay } from "@/server/towers/utils/timers";

/**
 * Finalizes the game state and stops all active game loops.
 *
 * - Marks the game as over.
 * - Stops all `GameLoop` loops.
 * - Clears player game instances.
 * - Determines if the game ended too early (under `MIN_GRACE_PERIOD_SECONDS`).
 * - Emits the game-over state to all clients.
 * - Waits 10 seconds before resetting the game.
 *
 * @param finalTimer - The number of seconds the game lasted (used to check early exit).
 * @param winners - The winning players.
 */
export async function gameOver(
  game: Game,
  finalTimer: number | null = null,
  winners: TablePlayer[] = [],
): Promise<void> {
  if (game.isGameOver) return;

  game.isGameOver = true;
  logger.debug("[Towers] Game stopped.");

  game.state = GameState.GAME_OVER;
  game.winners = winners;

  game.playerGameInstances.forEach((ptg: GameLoop) => ptg.stopGameLoop());
  game.playerGameInstances.clear();
  game.playerGamesBySeat.clear();

  await GameRewards.handleRewards(game, finalTimer, winners);

  await publishRedisEvent(ServerInternalEvents.GAME_OVER, {
    tableId: game.table.id,
    winners: winners.map((tp: TablePlayer) => tp.toPlainObject()),
    playerResults: game.table.players
      .filter((tp: TablePlayer) => game.playerIdsThisRound.includes(tp.playerId))
      .map((tp: TablePlayer) => ({
        playerId: tp.playerId,
        isPlayedThisRound: game.playerIdsThisRound.includes(tp.playerId),
        isWinner: game.winners.some((winner: TablePlayer) => winner.playerId === tp.playerId),
        rating: tp.player.stats.rating,
      })),
  });

  await delay(10_000);
  game.reset();
}
