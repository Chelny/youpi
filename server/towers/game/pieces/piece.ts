import { PIECE_STARTING_COL, PIECE_STARTING_ROW } from "@/constants/game";
import { PieceBlock, PieceBlockPlainObject, PieceBlockPosition } from "@/server/towers/game/pieces/piece-block";

export interface PiecePlainObject {
  blocks: PieceBlockPlainObject[]
  position: PieceBlockPosition
}

/**
 * Represents a game piece composed of multiple blocks.
 */
export class Piece {
  public blocks: PieceBlock[];
  private _position: PieceBlockPosition;

  /**
   * Creates a new piece.
   *
   * @param blocks - The blocks that make up the piece.
   * @param position - The starting position of the piece.
   */
  constructor(
    blocks: PieceBlock[],
    position: PieceBlockPosition = { row: PIECE_STARTING_ROW, col: PIECE_STARTING_COL },
  ) {
    this.blocks = blocks;
    this._position = position;
  }

  public get position(): PieceBlockPosition {
    return this._position;
  }

  public set position(position: PieceBlockPosition) {
    this._position = position;
    this.syncBlockPositions();
  }

  /**
   * Creates a new simulated Piece instance positioned at a specified location,
   * without modifying the original piece. Useful for collision detection or
   * previewing moves before applying them.
   *
   * @param piece - The original piece to simulate.
   * @param newPosition - The new position to simulate the piece at.
   * @returns A new Piece instance with blocks positioned according to the new position.
   */
  public static simulateAtPosition(piece: Piece, newPosition: PieceBlockPosition): Piece {
    const simulatedBlocks: PieceBlock[] = piece.blocks.map((block: PieceBlock, index: number) => {
      const clonedBlock: PieceBlock = block.clone();
      clonedBlock.position.row = newPosition.row + index;
      clonedBlock.position.col = newPosition.col;
      return clonedBlock;
    });

    return new Piece(simulatedBlocks, newPosition);
  }

  /**
   * Cycles the blocks in a given piece configuration.
   * This function reorders the blocks in the piece such that the block in the first position
   * moves to the last position, and all other blocks shift one position forward.
   */
  public cycleBlocks(): void {
    this.blocks = [this.blocks[1], this.blocks[2], this.blocks[0]];
    this.syncBlockPositions();
  }

  /**
   * Syncs each block's position with the piece's position.
   */
  private syncBlockPositions(): void {
    this.blocks.forEach((block: PieceBlock, index: number) => {
      const newRow: number = this._position.row + index;
      const newCol: number = this._position.col;

      if (block.position.row !== newRow || block.position.col !== newCol) {
        block.position.row = newRow;
        block.position.col = newCol;
      }
    });
  }

  /**
   * Converts the Piece instance to a plain object.
   *
   * @returns A plain object representation of the Piece.
   */
  public toPlainObject(): PiecePlainObject {
    return {
      blocks: this.blocks.map((block: PieceBlock) => block.toPlainObject()),
      position: this.position,
    };
  }
}
