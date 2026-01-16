import type { BoardGrid } from "@/server/towers/game/board/Board";
import { BOARD_COLS, BOARD_ROWS, HOO_SEQUENCE } from "@/constants/game";
import { PieceBlockPosition } from "@/server/towers/game/PieceBlock";
import { Block, isTowersPieceBlock } from "@/server/towers/utils/piece-type-check";

export enum HooDirection {
  Right = "Right",
  DownRight = "DownRight",
  UpRight = "UpRight",
  Down = "Down",
}

export const HOO_DIRECTION_VECTORS: Record<HooDirection, PieceBlockPosition> = {
  [HooDirection.Right]: { row: 0, col: 1 },
  [HooDirection.DownRight]: { row: 1, col: 1 },
  [HooDirection.UpRight]: { row: -1, col: 1 },
  [HooDirection.Down]: { row: 1, col: 0 },
};

export const HOO_FALLS: Record<HooDirection, number> = {
  [HooDirection.Right]: 1,
  [HooDirection.DownRight]: 2,
  [HooDirection.UpRight]: 2,
  [HooDirection.Down]: 3,
};

export interface DetectedHoo {
  positions: PieceBlockPosition[]
  hoosFallsCount: number
}

export class HooDetector {
  /**
   * Checks the board for the word "YOUPI!" in all four possible directions (horizontal, vertical, and both diagonals).
   * When a hoo is detected, it sets `isHooDetected` to `true` and calculates the number of falls based on the hoo type.
   * Multiple hoos can be detected at the same time, and the number of falls is accumulated.
   */
  public detect(grid: BoardGrid, isWithin: (r: number, c: number) => boolean): DetectedHoo[] {
    const result: DetectedHoo[] = [];

    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const block: Block = grid[row][col];
        if (!isTowersPieceBlock(block)) continue;
        if (block.letter !== HOO_SEQUENCE[0]) continue;

        for (const direction of Object.values(HooDirection)) {
          const positions: PieceBlockPosition[] = this.scanSequence(
            grid,
            row,
            col,
            HOO_DIRECTION_VECTORS[direction],
            isWithin,
          );

          if (positions.length > 0) {
            result.push({ positions, hoosFallsCount: HOO_FALLS[direction] });
          }
        }
      }
    }

    return result;
  }

  private scanSequence(
    grid: BoardGrid,
    startRow: number,
    startCol: number,
    direction: PieceBlockPosition,
    isWithin: (r: number, c: number) => boolean,
  ): PieceBlockPosition[] {
    const matched: PieceBlockPosition[] = [];

    for (let i = 0; i < HOO_SEQUENCE.length; i++) {
      const row: number = startRow + direction.row * i;
      const col: number = startCol + direction.col * i;

      if (!isWithin(row, col)) return [];
      const block: Block = grid[row][col];

      if (!isTowersPieceBlock(block)) return [];
      if (block.letter !== HOO_SEQUENCE[i]) return [];

      matched.push({ row, col });
    }

    return matched;
  }
}
