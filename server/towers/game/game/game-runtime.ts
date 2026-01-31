import { GameState } from "db/client";
import type { Game } from "@/server/towers/game/game/game";
import { MIN_GRACE_PERIOD_SECONDS } from "@/constants/game";
import * as GameLifecycle from "@/server/towers/game/game/game-lifecycle";
import { GamePlayingTeam, GameTeams } from "@/server/towers/game/game/game-teams";
import { GameLoop } from "@/server/towers/game/game-loop/game-loop";
import { TowersPieceBlockPlainObject } from "@/server/towers/game/pieces/towers/towers-piece-block";
import { TablePlayer } from "@/server/towers/modules/table-player/table-player.entity";

type RoundPlayer = { playerId: string; teamNumber: number };

export async function applyHooBlocksToOpponents(
  game: Game,
  teamNumber: number,
  blocks: TowersPieceBlockPlainObject[],
): Promise<void> {
  for (const playerGame of game.playerGameInstances.values()) {
    playerGame.applyHooBlocks(teamNumber, blocks);
    await playerGame.sendGameStateToClient();
  }
}

export function queueSpeedDropNextPiece(game: Game, seatNumber: number): void {
  const gameInstance: GameLoop | undefined = game.playerGamesBySeat.get(seatNumber);
  if (!gameInstance) return;

  gameInstance.queueSpecialSpeedDropNextPiece();
}

export function requestGameOverCheck(game: Game): void {
  if (game.gameOverCheckQueued) return;
  game.gameOverCheckQueued = true;

  queueMicrotask(() => {
    game.gameOverCheckQueued = false;

    // Only proceed if the game is live
    if (game.isGameOver) return;
    if (game.state !== GameState.PLAYING) return;

    // Check if there are enough teams to continue
    const isGameOver: boolean = GameTeams.checkIfGameOver(game.table.id, game.table.players);
    if (!isGameOver) return;

    // Timer and active teams
    const finalTimer: number = game.timer ?? 0;
    GameLifecycle.clearGameTimer(game);

    const playingTeams: GamePlayingTeam[] = GameTeams.getActiveTeams(game.table.id, game.table.players);
    if (playingTeams.length === 0) {
      void game.gameOver(finalTimer);
      return;
    }

    void game.gameOver(finalTimer, playingTeams[0].players);
  });
}

/**
 * Handles logic when a user leaves the table during a game round.
 * - If the game is in countdown or early game phase (<= 15s), and valid teams are not present, game ends.
 * - If the game is playing (any time), and valid teams are NOT present after departure, game ends and last valid players become winners.
 * - Also removes the user from the current `playerIdsThisRound` list if necessary.
 * - Emits the updated GAME_OVER state to all users.
 */
export function handleUserDepartureMidGame(game: Game, tablePlayer: TablePlayer): void {
  const isEarlyExitDuringCountdown: boolean = game.state === GameState.COUNTDOWN;

  const isEarlyExitDuringPlay: boolean =
    game.state === GameState.PLAYING && game.timer !== null && game.timer <= MIN_GRACE_PERIOD_SECONDS;

  const isMidGame: boolean =
    game.state === GameState.PLAYING && game.timer !== null && game.timer > MIN_GRACE_PERIOD_SECONDS;

  // Handle departure during countdown or early game
  if (isEarlyExitDuringCountdown || isEarlyExitDuringPlay) {
    game.playersThisRound = GameTeams.checkMinimumPlayingTeams(game.table.id, game.table.players)
      ? game.playersThisRound.filter((rp: RoundPlayer) => rp.playerId !== tablePlayer.playerId)
      : [];
    return;
  }

  // Handle mid-game user exit — check if game is still valid
  if (isMidGame && !GameTeams.checkMinimumPlayingTeams(game.table.id, game.table.players)) {
    // Determine remaining players as winners
    game.winners = game.table.players.filter((tp: TablePlayer) => tp.isPlaying && tp.playerId !== tablePlayer.playerId);
    game.requestGameOverCheck();
  }
}
