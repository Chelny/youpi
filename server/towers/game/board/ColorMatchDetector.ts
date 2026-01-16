import type { BoardBlock } from "@/server/towers/game/board/Board";
import { BOARD_ROWS, COLOR_MATCH_DIRECTIONS, HIDDEN_ROWS_COUNT, MIN_MATCHING_BLOCKS } from "@/constants/game";
import { PieceBlockPosition } from "@/server/towers/game/PieceBlock";
import { isTowersPieceBlock } from "@/server/towers/utils/piece-type-check";

export class ColorMatchDetector {
  /**
   * Finds all positions that belong to a same-letter chain of length >= MIN_MATCHING_BLOCKS.
   * Scans in 8 directions, but only starts scanning when the current cell is the "head"
   * of the chain in that direction (to avoid duplicate scans).
   *
   * @param grid - Board grid (may be merged for 2-board matching)
   * @param totalCols - Number of columns to consider (BOARD_COLS or BOARD_COLS * 2)
   * @param startRow - First visible row to scan (defaults to HIDDEN_ROWS_COUNT)
   */
  public detect(grid: BoardBlock[][], totalCols: number, startRow: number = HIDDEN_ROWS_COUNT): PieceBlockPosition[] {
    const unique: Map<string, PieceBlockPosition> = new Map<string, PieceBlockPosition>();

    for (let row: number = startRow; row < BOARD_ROWS; row++) {
      for (let col: number = 0; col < totalCols; col++) {
        const startCell: BoardBlock = grid[row][col];
        if (!isTowersPieceBlock(startCell)) continue;

        for (const dir of COLOR_MATCH_DIRECTIONS) {
          // Only start scanning if THIS cell is the "head" of the chain in this direction.
          const prevRow: number = row - dir.row;
          const prevCol: number = col - dir.col;

          if (prevRow >= startRow && prevRow < BOARD_ROWS && prevCol >= 0 && prevCol < totalCols) {
            const prevCell: BoardBlock = grid[prevRow][prevCol];
            if (isTowersPieceBlock(prevCell) && prevCell.letter === startCell.letter) {
              continue; // Not a chain head, skip
            }
          }

          // Scan forward
          const chain: PieceBlockPosition[] = [];
          let r: number = row;
          let c: number = col;

          while (r >= startRow && r < BOARD_ROWS && c >= 0 && c < totalCols) {
            const cell: BoardBlock = grid[r][c];
            if (!isTowersPieceBlock(cell)) break;
            if (cell.letter !== startCell.letter) break;

            chain.push({ row: r, col: c });
            r += dir.row;
            c += dir.col;
          }

          if (chain.length >= MIN_MATCHING_BLOCKS) {
            for (const pos of chain) {
              unique.set(`${pos.row},${pos.col}`, pos);
            }
          }
        }
      }
    }

    return [...unique.values()];
  }
}
