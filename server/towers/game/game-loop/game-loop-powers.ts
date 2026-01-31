import type { GameLoop } from "@/server/towers/game/game-loop/game-loop";
import {
  REMOVED_BLOCKS_COUNT_FOR_REMOVE_POWERS,
  REMOVED_BLOCKS_COUNT_FOR_REMOVE_STONES,
  REMOVED_BLOCKS_COUNT_FOR_SPEED_DROP,
  SPEED_DROP_TICK_COUNT,
} from "@/constants/game";
import { TickSpeed } from "@/enums/towers-tick-speed";
import { Board } from "@/server/towers/game/board/board";
import { SpecialDiamond } from "@/server/towers/game/pieces/special-diamond/special-diamond";
import { PowerBar } from "@/server/towers/game/power-bar";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";
import { TableSeatManager } from "@/server/towers/modules/table-seat/table-seat.manager";

/**
 * Use a power from the power bar.
 * @param targetSeatNumber - Optional. The seat number to target.
 */
export function usePower(gameLoop: GameLoop, targetSeatNumber?: number): void {
  if (!gameLoop.canProcessInput()) return;
  gameLoop.powerManager.usePower(targetSeatNumber);
  gameLoop.queueSendGameState();
}

/**
 * Add special diamonds to the power block based on the total number of broken blocks.
 */
export function addSpecialDiamondsToPowerBar(gameLoop: GameLoop): void {
  const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(
    gameLoop.tableId,
    gameLoop.tablePlayer.playerId,
  );
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

export function queueSpecialSpeedDropNextPiece(gameLoop: GameLoop): void {
  gameLoop.pendingSpecialSpeedDrop = true;
  gameLoop.speedDropTicksRemaining = SPEED_DROP_TICK_COUNT;
}

export function pendingSpeedDrop(gameLoop: GameLoop): void {
  if (!gameLoop.pendingSpecialSpeedDrop) return;
  gameLoop.pendingSpecialSpeedDrop = false;
  activateSpecialSpeedDrop(gameLoop);
}

export function speedDropTick(gameLoop: GameLoop): void {
  if (!gameLoop.isSpecialSpeedDropActivated) return;

  gameLoop.speedDropTicksRemaining--;

  if (gameLoop.speedDropTicksRemaining > 0) {
    activateSpecialSpeedDrop(gameLoop);
  } else {
    deactivateSpecialSpeedDrop(gameLoop);
  }
}

export function activateSpecialSpeedDrop(gameLoop: GameLoop): void {
  gameLoop.isSpecialSpeedDropActivated = true;
  gameLoop.tickSpeed = TickSpeed.SPEED_DROP;
}

export function deactivateSpecialSpeedDrop(gameLoop: GameLoop): void {
  gameLoop.isSpecialSpeedDropActivated = false;
  gameLoop.tickSpeed = TickSpeed.NORMAL;
}
