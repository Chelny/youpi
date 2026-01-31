import { GameState } from "db/client";
import type { Game } from "@/server/towers/game/game/game";
import * as GameLifecycle from "@/server/towers/game/game/game-lifecycle";
import { GameLoop } from "@/server/towers/game/game-loop/game-loop";
import { TablePlayer } from "@/server/towers/modules/table-player/table-player.entity";
import { TablePlayerManager } from "@/server/towers/modules/table-player/table-player.manager";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";

function cleanup(game: Game, { emitState = true, fullDestroy = false } = {}): void {
  GameLifecycle.clearCountdown(game);
  GameLifecycle.clearGameTimer(game);

  game.table.players
    .filter((tp: TablePlayer) => tp.isPlaying)
    .forEach(async (tp: TablePlayer) => {
      tp.isPlaying = false;
      await TablePlayerManager.upsert(tp);
    });

  game.isGameOver = false;
  game.playersThisRound = [];
  game.winners = [];
  game.state = GameState.WAITING;

  if (fullDestroy) {
    game.table.seats.forEach((ts: TableSeat) => ts.clearSeatGame());
  }

  if (emitState) {
    GameLifecycle.emitGameStateToAll(game);
  }
}

export function reset(game: Game): void {
  cleanup(game, { emitState: true, fullDestroy: false });
}

export function destroy(game: Game): void {
  game.playerGameInstances.forEach((ptg: GameLoop) => ptg.stopGameLoop());
  game.playerGameInstances.clear();
  game.playerGamesBySeat.clear();

  cleanup(game, { emitState: false, fullDestroy: true });
}
