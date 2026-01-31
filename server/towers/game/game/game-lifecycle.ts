import { GameState } from "db/client";
import type { Game } from "@/server/towers/game/game/game";
import { COUNTDOWN_START_NUMBER, COUNTDOWN_START_NUMBER_TEST, MIN_GRACE_PERIOD_SECONDS } from "@/constants/game";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { logger } from "@/lib/logger";
import { publishRedisEvent } from "@/server/redis/publish";
import { GamePlayingTeam, GameTeams } from "@/server/towers/game/game/game-teams";
import { TablePlayer } from "@/server/towers/modules/table-player/table-player.entity";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";
import { TEST_MODE } from "@/server/towers/utils/test";

export function startCountdown(game: Game): void {
  game.countdown = TEST_MODE ? COUNTDOWN_START_NUMBER_TEST : COUNTDOWN_START_NUMBER;

  clearGameTimer(game, true);

  game.state = GameState.COUNTDOWN;

  game.countdownIntervalId = setInterval(() => {
    if (game.countdown === null) return;

    logger.debug(`[Towers] Countdown: ${game.countdown}`);

    if (game.countdown > 1) {
      game.countdown -= 1;

      if (!GameTeams.checkMinimumReadyTeams(game.table.id, game.table.players)) {
        clearCountdown(game);
        logger.debug("[Towers] Game Over: Not enough ready users or teams");
        game.gameOver();
      }
    } else if (game.countdown === 1) {
      clearCountdown(game);
      void game.startGame();
    }
  }, 1000);
}

export function startGameTimer(game: Game): void {
  game.state = GameState.PLAYING;
  game.timer = 0;

  game.gameTimerIntervalId = setInterval(() => {
    if (game.state !== GameState.PLAYING || game.timer === null || game.isGameOver) {
      return;
    }

    if (GameTeams.checkIfGameOver(game.table.id, game.table.players)) {
      const finalTimer: number | null = game.timer;

      clearGameTimer(game);

      const aliveTeams: GamePlayingTeam[] = GameTeams.getActiveTeams(game.table.id, game.table.players);
      if (aliveTeams.length === 0) {
        logger.debug("[Towers] Game Over: No alive teams.");
        void game.gameOver(finalTimer);
        return;
      }

      const winningTeam: GamePlayingTeam = aliveTeams[0];
      logger.debug(
        `[Towers] Game Over: Winning team: ${winningTeam.players
          .map((tp: TablePlayer) => tp.player.user.username)
          .join(", ")}`,
      );

      void game.gameOver(finalTimer, winningTeam.players);
      return;
    }

    if (
      game.timer <= MIN_GRACE_PERIOD_SECONDS &&
      !GameTeams.checkMinimumPlayingTeams(game.table.id, game.table.players)
    ) {
      // Early abort
      const finalTimer: number | null = game.timer;

      clearGameTimer(game);

      logger.debug(
        `[Towers] Game Over: Not enough users or teams playing within the first ${MIN_GRACE_PERIOD_SECONDS} seconds.`,
      );

      void game.gameOver(finalTimer);
    }

    game.timer += 1;
  }, 1000);
}

export function clearCountdown(game: Game): void {
  if (game.countdownIntervalId) {
    clearInterval(game.countdownIntervalId);
    game.countdownIntervalId = null;
  }

  game.countdown = null;
}

export function clearGameTimer(game: Game, shouldResetTimer: boolean = false): void {
  if (game.gameTimerIntervalId) {
    clearInterval(game.gameTimerIntervalId);
    game.gameTimerIntervalId = null;
  }

  if (shouldResetTimer) {
    game.timer = null;
  }
}

export async function emitGameStateToAll(game: Game): Promise<void> {
  await publishRedisEvent(ServerInternalEvents.GAME_STATE, {
    tableId: game.table.id,
    gameState: game.state,
  });
}

export async function emitCountdownToAll(game: Game): Promise<void> {
  await publishRedisEvent(ServerInternalEvents.GAME_COUNTDOWN, {
    tableId: game.table.id,
    countdown: game.countdown,
  });
}

export async function emitTimerToAll(game: Game): Promise<void> {
  await publishRedisEvent(ServerInternalEvents.GAME_TIMER, {
    tableId: game.table.id,
    timer: game.timer,
  });
}

export async function emitClearedBoardsToAll(game: Game): Promise<void> {
  await publishRedisEvent(ServerInternalEvents.GAME_CLEAR_BOARDS, {
    tableId: game.table.id,
    tableSeats: game.table.seats.map((ts: TableSeat) => ts.toGamePlainObject()),
  });
}
