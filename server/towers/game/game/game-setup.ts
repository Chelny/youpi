import type { Game } from "@/server/towers/game/game/game";
import * as GameLifecycle from "@/server/towers/game/game/game-lifecycle";
import { GameLoop } from "@/server/towers/game/game-loop/game-loop";
import { GameLoopDependencies } from "@/server/towers/game/game-loop/game-loop-types";
import { TablePlayer } from "@/server/towers/modules/table-player/table-player.entity";
import { TablePlayerManager } from "@/server/towers/modules/table-player/table-player.manager";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";

export async function startGame(game: Game): Promise<void> {
  // Initialize seats that are occupied
  const occupiedSeats: TableSeat[] = game.table.seats.filter((ts: TableSeat) => ts.occupiedByPlayer);
  occupiedSeats.forEach((ts: TableSeat) => ts.initialize());

  const seatByNumber: Map<number, TableSeat> = new Map<number, TableSeat>();

  for (const tableSeat of occupiedSeats) {
    if (tableSeat.seatNumber != null) {
      seatByNumber.set(tableSeat.seatNumber, tableSeat);
    }

    if (!tableSeat.board || tableSeat.seatNumber == null) continue;

    // Link partner boards (partner = adjacent seat by seatNumber)
    const partnerSeatNumber: number =
      tableSeat.seatNumber % 2 === 0 ? tableSeat.seatNumber + 1 : tableSeat.seatNumber - 1;
    const partnerSeat: TableSeat | undefined = seatByNumber.get(partnerSeatNumber);

    // Partner must exist, be occupied, and have a board
    if (partnerSeat?.occupiedByPlayer && partnerSeat.board && partnerSeat.teamNumber === tableSeat.teamNumber) {
      tableSeat.board.partnerBoard = partnerSeat.board;
      tableSeat.board.partnerSide = partnerSeat.seatNumber > tableSeat.seatNumber ? "right" : "left";
    } else {
      tableSeat.board.partnerBoard = null;
      tableSeat.board.partnerSide = null;
    }

    // Start GameLoop instances for seated and ready players
    const tablePlayer: TablePlayer | undefined = tableSeat.occupiedByPlayerId
      ? await TablePlayerManager.findByTableId(game.table, tableSeat.occupiedByPlayerId)
      : undefined;

    if (!tablePlayer || !tablePlayer.isReady) continue;

    game.playersThisRound.push({ playerId: tablePlayer.playerId, teamNumber: tableSeat.teamNumber });

    const dependencies: GameLoopDependencies = {
      queueSpeedDropNextPiece: (seatNumber: number) => game.queueSpeedDropNextPiece(seatNumber),
      requestGameOverCheck: () => game.requestGameOverCheck(),
    };

    const instance: GameLoop = new GameLoop(game.io, game.table.id, game.table.players, tablePlayer, dependencies);

    game.playerGameInstances.set(tablePlayer.playerId, instance);

    if (tablePlayer.seatNumber != null) {
      game.playerGamesBySeat.set(tablePlayer.seatNumber, instance);
    }

    tablePlayer.isPlaying = true;
    await TablePlayerManager.upsert(tablePlayer);

    instance.startGameLoop();
  }

  GameLifecycle.startGameTimer(game);
}
