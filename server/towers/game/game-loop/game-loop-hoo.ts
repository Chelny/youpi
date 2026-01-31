import { TableChatMessageType } from "db/client";
import type { GameLoop } from "@/server/towers/game/game-loop/game-loop";
import { Board } from "@/server/towers/game/board/board";
import { CipherHeroManager, CipherKey } from "@/server/towers/game/cipher-hero-manager";
import { TowersPieceBlock, TowersPieceBlockPlainObject } from "@/server/towers/game/pieces/towers/towers-piece-block";
import { TableChatMessageManager } from "@/server/towers/modules/table-chat-message/table-chat-message.manager";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";
import { TableSeatManager } from "@/server/towers/modules/table-seat/table-seat.manager";

/**
 * Applies Hoo blocks sent from another team to this player's board.
 *
 * - Ignored if the blocks array is empty, the current piece is locked, or the board/game is over.
 * - Blocks are only applied if the sender is **not** on the same team.
 *
 * @param teamNumber - The team sending the blocks.
 * @param blocks - Blocks to apply, in plain object form.
 */
export function applyHooBlocks(gameLoop: GameLoop, teamNumber: number, blocks: TowersPieceBlockPlainObject[]): void {
  if (!blocks || blocks.length === 0 || gameLoop.isPieceLocked) return;

  const tableSeat: TableSeat | undefined = TableSeatManager.getSeatByPlayerId(
    gameLoop.tableId,
    gameLoop.tablePlayer.playerId,
  );
  const board: Board | null | undefined = tableSeat?.board;
  if (!tableSeat || !board) return;

  const isPartner: boolean = tableSeat.teamNumber === teamNumber;

  if (!isPartner && gameLoop.tablePlayer.isPlaying && !board?.isGameOver) {
    board.placeBlocksFromHoo(blocks.map(TowersPieceBlock.fromPlainObject));
  }
}

/**
 * Generates and sends a cipher key to the current player if one is available.
 *
 * This method attempts to generate a new `CipherKey` for the user via the `CipherHeroManager`.
 * If a key is awarded, it emits a `CIPHER_KEY` chat message visible only to the recipient.
 * This message contains the encrypted and decrypted character pair.
 *
 * Typical use case: reward system after gameplay milestones (e.g., clearing lines, surviving a turn, etc.).
 */
export async function sendCipherKey(gameLoop: GameLoop): Promise<void> {
  const cipherKey: CipherKey | null = CipherHeroManager.getCipherKey(gameLoop.tablePlayer.playerId);

  if (cipherKey) {
    await TableChatMessageManager.create({
      tableId: gameLoop.tableId,
      player: gameLoop.tablePlayer.player,
      text: null,
      type: TableChatMessageType.CIPHER_KEY,
      textVariables: { plainChar: cipherKey.plainChar, cipherChar: cipherKey.cipherChar },
      visibleToUserId: gameLoop.tablePlayer.playerId,
    });
  }
}
