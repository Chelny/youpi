import { PIECE_LENGTH, PIECE_STARTING_COL, PIECE_STARTING_ROW } from "@/constants/game";
import { Piece } from "@/server/towers/game/pieces/piece";
import { PieceBlock, PieceBlockPosition } from "@/server/towers/game/pieces/piece-block";
import { TowersPieceBlock } from "@/server/towers/game/pieces/towers/towers-piece-block";
import { TowersPieceBlockPowerManager } from "@/server/towers/game/pieces/towers/towers-piece-block-power-manager";

export class TowersPiece extends Piece {
  constructor(
    blocks: TowersPieceBlock[] = Array.from({ length: PIECE_LENGTH }, () => new TowersPieceBlock()),
    position: PieceBlockPosition = { row: PIECE_STARTING_ROW, col: PIECE_STARTING_COL },
  ) {
    super(blocks, position);
  }

  /**
   * Applies power effects to each block in the current piece using the provided `TowersPieceBlockPowerManager`.
   *
   * @param towersPieceBlockPowerManager - The power manager responsible for handling block power effects.
   */
  public applyPowerToBlocks(towersPieceBlockPowerManager: TowersPieceBlockPowerManager): void {
    this.blocks.forEach((block: PieceBlock) => {
      if (block instanceof TowersPieceBlock) {
        block.applyBlockPower(towersPieceBlockPowerManager);
      }
    });
  }
}
