import { BOARD_COLS, BOARD_ROWS, HIDDEN_ROWS_COUNT } from "@/constants/game";
import { BoardBlock, BoardGrid, BoardGridRow } from "@/server/towers/game/board/board";
import { TowersBlockPowerLevel } from "@/server/towers/game/pieces/piece-block";
import { isEmptyCell, isMedusaPieceBlock, isTowersPieceBlock } from "@/server/towers/utils/piece-type-check";

export class GridPowerHelper {
  constructor(private readonly grid: BoardGrid) {}

  /**
   * Returns the number of blocks to rearrange given a power level.
   *
   * @param powerLevel - The power level indicating the intensity of the operation ("minor", "normal", or "mega").
   * @param totalBlocks - Optional. The total number of blocks on the board.
   * @returns The number of blocks to rearrange based on the power level.
   */
  public getNumBlocksToRearrange(powerLevel: TowersBlockPowerLevel, totalBlocks?: number): number {
    if (typeof totalBlocks === "undefined") {
      totalBlocks = this.grid.reduce(
        (count: number, row: BoardGridRow) =>
          count + row.filter((cell) => !isEmptyCell(cell) && !isMedusaPieceBlock(cell)).length,
        0,
      );
    }

    const percentage: number = powerLevel === "minor" ? 0.15 : powerLevel === "normal" ? 0.3 : 0.5;
    return Math.ceil(totalBlocks * percentage);
  }

  /**
   * Determines if swapping two blocks sets up 3-in-a-row.
   *
   * @param row1 - The row index of the first block to swap.
   * @param col1 - The column index of the first block to swap.
   * @param row2 - The row index of the second block to swap.
   * @param col2 - The column index of the second block to swap.
   * @returns True if the swap sets up three blocks in a row; otherwise, false.
   */
  public isSettingUpThreeInRow(row1: number, col1: number, row2: number, col2: number): boolean {
    const board: BoardGrid = this.grid;

    const checkHorizontal = (row: number, col: number): boolean => {
      const block: BoardBlock = board[row][col];
      if (!isTowersPieceBlock(block)) return false;

      let count: number = 1;

      // Check left
      for (let i = col - 1; i >= 0; i--) {
        const leftBlock: BoardBlock = board[row][i];
        if (!isTowersPieceBlock(leftBlock) || leftBlock.letter !== block.letter) break;
        count++;
      }

      // Check right
      for (let i = col + 1; i < BOARD_COLS; i++) {
        const rightBlock: BoardBlock = board[row][i];
        if (!isTowersPieceBlock(rightBlock) || rightBlock.letter !== block.letter) break;
        count++;
      }

      return count >= 3;
    };

    const checkVertical = (row: number, col: number): boolean => {
      const block: BoardBlock = board[row][col];
      if (!isTowersPieceBlock(block)) return false;

      let count: number = 1;

      // Check up
      for (let i = row - 1; i >= HIDDEN_ROWS_COUNT; i--) {
        const aboveBlock: BoardBlock = board[i][col];
        if (!isTowersPieceBlock(aboveBlock) || aboveBlock.letter !== block.letter) break;
        count++;
      }

      // Check down
      for (let i = row + 1; i < BOARD_ROWS; i++) {
        const belowBlock: BoardBlock = board[i][col];
        if (!isTowersPieceBlock(belowBlock) || belowBlock.letter !== block.letter) break;
        count++;
      }

      return count >= 3;
    };

    const checkDiagonal = (row: number, col: number): boolean => {
      const block: BoardBlock = board[row][col];
      if (!isTowersPieceBlock(block)) return false;

      let count1: number = 1;
      let count2: number = 1;

      // Top-left to bottom-right
      for (let i = 1; row - i >= HIDDEN_ROWS_COUNT && col - i >= 0; i++) {
        const checkBlock: BoardBlock = board[row - i][col - i];
        if (!isTowersPieceBlock(checkBlock) || checkBlock.letter !== block.letter) break;
        count1++;
      }

      for (let i = 1; row + i < BOARD_ROWS && col + i < BOARD_COLS; i++) {
        const checkBlock: BoardBlock = board[row + i][col + i];
        if (!isTowersPieceBlock(checkBlock) || checkBlock.letter !== block.letter) break;
        count1++;
      }

      // Bottom-left to top-right
      for (let i = 1; row - i >= HIDDEN_ROWS_COUNT && col + i < BOARD_COLS; i++) {
        const checkBlock: BoardBlock = board[row - i][col + i];
        if (!isTowersPieceBlock(checkBlock) || checkBlock.letter !== block.letter) break;
        count2++;
      }

      for (let i = 1; row + i < BOARD_ROWS && col - i >= 0; i++) {
        const checkBlock: BoardBlock = board[row + i][col - i];
        if (!isTowersPieceBlock(checkBlock) || checkBlock.letter !== block.letter) break;
        count2++;
      }

      return count1 >= 3 || count2 >= 3;
    };

    // Ensure indices are within bounds before swapping
    if (
      row1 < HIDDEN_ROWS_COUNT ||
      row1 >= BOARD_ROWS ||
      col1 < 0 ||
      col1 >= BOARD_COLS ||
      row2 < HIDDEN_ROWS_COUNT ||
      row2 >= BOARD_ROWS ||
      col2 < 0 ||
      col2 >= BOARD_COLS
    ) {
      return false;
    }

    // Temporarily swap the blocks to test if it sets up three in a row
    this.swapBlocks(row1, col1, row2, col2);

    // Check if the swap creates three in a row
    const isCreatesThreeInRow: boolean =
      checkHorizontal(row1, col1) ||
      checkHorizontal(row2, col2) ||
      checkVertical(row1, col1) ||
      checkVertical(row2, col2) ||
      checkDiagonal(row1, col1) ||
      checkDiagonal(row2, col2);

    // Swap the blocks back to their original positions
    this.swapBlocks(row1, col1, row2, col2);

    return isCreatesThreeInRow;
  }

  /**
   * Determines if swapping two blocks results in adjacent blocks of same letter.
   *
   * @param row1 - The row index of the first block to swap.
   * @param col1 - The column index of the first block to swap.
   * @param row2 - The row index of the second block to swap.
   * @param col2 - The column index of the second block to swap.
   * @returns True if the swap would result in adjacent blocks of the same color and letter; otherwise, false.
   */
  public areAdjacentBlocksSame(row1: number, col1: number, row2: number, col2: number): boolean {
    const board: BoardGrid = this.grid;

    // Temporarily swap the blocks
    this.swapBlocks(row1, col1, row2, col2);

    // Function to check if two blocks are the same type
    const blocksAreSame = (r1: number, c1: number, r2: number, c2: number): boolean => {
      const block1: BoardBlock = board[r1][c1];
      const block2: BoardBlock = board[r2][c2];

      if (!isTowersPieceBlock(block1) || !isTowersPieceBlock(block2)) return false;

      if (
        r1 >= 0 &&
        r1 < BOARD_ROWS &&
        c1 >= 0 &&
        c1 < BOARD_COLS &&
        r2 >= 0 &&
        r2 < BOARD_ROWS &&
        c2 >= 0 &&
        c2 < BOARD_COLS
      ) {
        return block1.letter === block2.letter;
      }

      return false; // Return false if any block is out of bounds
    };

    // Function to check horizontal adjacency for a block
    const checkHorizontal = (r: number, c: number): boolean => {
      // Check left and right blocks horizontally
      return (
        (c > 0 && blocksAreSame(r, c, r, c - 1)) || // Left of (r, c)
        (c < BOARD_COLS - 1 && blocksAreSame(r, c, r, c + 1)) // Right of (r, c)
      );
    };

    // Function to check vertical adjacency for a block
    const checkVertical = (r: number, c: number): boolean => {
      // Check directly below and above the current block (r, c)
      const below: boolean = r < BOARD_ROWS - 1 && blocksAreSame(r, c, r + 1, c);
      const above: boolean = r > 0 && blocksAreSame(r, c, r - 1, c);

      return below || above;
    };

    // Function to check all relevant adjacencies for a block
    const checkAllAdjacent = (r: number, c: number): boolean => {
      return checkHorizontal(r, c) || checkVertical(r, c);
    };

    // Check if either of the swapped blocks create adjacent blocks with the same letter
    const result: boolean = checkAllAdjacent(row1, col1) || checkAllAdjacent(row2, col2);

    // Swap the blocks back to their original positions
    this.swapBlocks(row1, col1, row2, col2);

    return result;
  }

  /**
   * Swaps two blocks in the grid.
   *
   * @param r1
   * @param c1
   * @param r2
   * @param c2
   */
  public swapBlocks(r1: number, c1: number, r2: number, c2: number): void {
    const temp: BoardBlock = this.grid[r1][c1];
    this.grid[r1][c1] = this.grid[r2][c2];
    this.grid[r2][c2] = temp;
  }
}
