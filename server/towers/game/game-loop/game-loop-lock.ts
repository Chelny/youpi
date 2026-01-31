import type { GameLoop } from "@/server/towers/game/game-loop/game-loop";
import { BLOCK_BREAK_ANIMATION_DURATION_MS } from "@/constants/game";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { TickSpeed } from "@/enums/towers-tick-speed";
import { logger } from "@/lib/logger";
import { publishRedisEvent } from "@/server/redis/publish";
import { BlockToRemove, Board } from "@/server/towers/game/board/board";
import { TowersBlockLetter } from "@/server/towers/game/pieces/piece-block";
import { TowersPieceBlock } from "@/server/towers/game/pieces/towers/towers-piece-block";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";
import { TableSeatManager } from "@/server/towers/modules/table-seat/table-seat.manager";
import { isMedusaPiece, isMidasPiece } from "@/server/towers/utils/piece-type-check";

/**
 * Lock the piece to the board and gets the next one.
 */
export async function lockPieceInPlace(gameLoop: GameLoop): Promise<void> {
  if (gameLoop.isGameStopped) return;

  const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(
    gameLoop.tableId,
    gameLoop.tablePlayer.playerId,
  );
  const board: Board | null | undefined = tableSeat?.board;
  if (!tableSeat || !board) return;

  if (!gameLoop.currentPiece) return;

  if (!gameLoop.isPieceLocked) {
    gameLoop.isPieceLocked = true;
    gameLoop.tickSpeed = TickSpeed.BREAKING_BLOCKS;
  }

  board.placePiece(gameLoop.currentPiece);
  logger.debug(
    `[Towers: ${gameLoop.tablePlayer.player.user.username}] Piece committed to the board at position X=${gameLoop.currentPiece.position.col}, Y=${gameLoop.currentPiece.position.row}`,
  );

  // Apply piece effects (power blocks)
  if (isMedusaPiece(gameLoop.currentPiece) || isMidasPiece(gameLoop.currentPiece)) {
    await board.convertSurroundingBlocksToPowerBlocks(gameLoop.currentPiece);
    await gameLoop.sendGameStateToClient();
  }

  // Run all recursive block-breaking logic
  const { selfOutgoing, partnerOutgoing, isHooOccurred } = await board.processLandedPiece(
    async (board: Board, blocksToRemove: BlockToRemove[]): Promise<void> => {
      await gameLoop.waitForClientToFade(board, blocksToRemove);
    },
  );

  if (isHooOccurred) {
    await gameLoop.sendCipherKey();
  }

  // Send removed blocks while hoo is detected to opponents
  if (selfOutgoing.length > 0) {
    await publishRedisEvent(ServerInternalEvents.GAME_HOO_SEND_BLOCKS, {
      tableId: gameLoop.tableId,
      teamNumber: tableSeat.teamNumber,
      blocks: selfOutgoing.map((block: TowersPieceBlock) =>
        new TowersPieceBlock(block.letter as TowersBlockLetter, block.position).toPlainObject(),
      ),
    });
  }

  if (partnerOutgoing.length > 0 && board.partnerBoard) {
    const partnerSeat: TableSeat | undefined = TableSeatManager.getSeatByBoard(gameLoop.tableId, board.partnerBoard);
    if (partnerSeat) {
      await publishRedisEvent(ServerInternalEvents.GAME_HOO_SEND_BLOCKS, {
        tableId: gameLoop.tableId,
        teamNumber: partnerSeat.teamNumber,
        blocks: partnerOutgoing.map((block: TowersPieceBlock) =>
          new TowersPieceBlock(block.letter as TowersBlockLetter, block.position).toPlainObject(),
        ),
      });
    }
  }

  gameLoop.addSpecialDiamondsToPowerBar();

  gameLoop.tickSpeed = TickSpeed.NORMAL;
  gameLoop.isPieceLocked = false;

  // Force emit partner grid too when it's game over for them
  if (board.partnerBoard && board.partnerBoard.isGameOver) {
    const partnerSeat: TableSeat | undefined = TableSeatManager.getSeatByBoard(gameLoop.tableId, board.partnerBoard);

    if (partnerSeat) {
      await publishRedisEvent(ServerInternalEvents.GAME_BOARD, {
        tableId: gameLoop.tableId,
        seatNumber: partnerSeat.seatNumber,
        nextPieces: partnerSeat.nextPieces?.toPlainObject(),
        powerBar: partnerSeat.powerBar?.toPlainObject(),
        board: board.partnerBoard.toPlainObject(),
        currentPiece: null,
      });
    }
  }
}

export async function waitForClientToFade(gameLoop: GameLoop, board: Board, blocksToRemove: BlockToRemove[]) {
  if (gameLoop.isGameStopped) return;

  const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByBoard(gameLoop.tableId, board);
  if (!tableSeat) return;

  await publishRedisEvent(ServerInternalEvents.GAME_BLOCKS_MARKED_FOR_REMOVAL, {
    tableId: tableSeat.tableId,
    seatNumber: tableSeat.seatNumber,
    blocks: blocksToRemove,
  });

  // Wait for client animation event, fallback to short timeout
  await new Promise<void>((resolve: (value: void | PromiseLike<void>) => void) => {
    let isSettled: boolean = false;

    const onDone = (data: { tableId: string; seatNumber: number }): void => {
      if (isSettled) return;
      if (data.tableId !== gameLoop.tableId) return;
      if (data.seatNumber !== tableSeat.seatNumber) return;

      isSettled = true;
      clearTimeout(timeoutId);
      gameLoop.io.off(ClientToServerEvents.GAME_CLIENT_BLOCKS_ANIMATION_DONE, onDone);
      resolve();
    };

    gameLoop.io.on(ClientToServerEvents.GAME_CLIENT_BLOCKS_ANIMATION_DONE, onDone);

    const timeoutId: NodeJS.Timeout = setTimeout(() => {
      if (isSettled) return;
      isSettled = true;
      gameLoop.io.off(ClientToServerEvents.GAME_CLIENT_BLOCKS_ANIMATION_DONE, onDone);
      resolve();
    }, BLOCK_BREAK_ANIMATION_DURATION_MS);
  });

  if (gameLoop.isGameStopped) return;
}
