import { BOARD_COLS, BOARD_ROWS, COLOR_MATCH_DIRECTIONS, EMPTY_CELL, HIDDEN_ROWS_COUNT } from "@/constants/game";
import { logger } from "@/lib/logger";
import { ColorMatchDetector } from "@/server/towers/game/board/ColorMatchDetector";
import { HooDetector } from "@/server/towers/game/board/HooDetector";
import { MedusaPieceBlock } from "@/server/towers/game/MedusaPieceBlock";
import { MidasPieceBlock } from "@/server/towers/game/MidasPieceBlock";
import { Piece } from "@/server/towers/game/Piece";
import {
  PieceBlock,
  PieceBlockLetter,
  PieceBlockPosition,
  PowerPieceBlockPlainObject,
  TowersBlockLetter,
} from "@/server/towers/game/PieceBlock";
import {
  isTowersPieceBlockLetter,
  TowersPieceBlock,
  TowersPieceBlockPlainObject,
} from "@/server/towers/game/TowersPieceBlock";
import { PowerBlock, TowersPieceBlockPowerManager } from "@/server/towers/game/TowersPieceBlockPowerManager";
import {
  Block,
  isEmptyCell,
  isMedusaPiece,
  isMidasPiece,
  isPowerBarItem,
  isTowersPieceBlock,
} from "@/server/towers/utils/piece-type-check";

export type BoardBlock = TowersPieceBlock | MedusaPieceBlock | MidasPieceBlock | typeof EMPTY_CELL;
export type BoardGridRow = BoardBlock[];
export type BoardGridCol = BoardBlock[];
export type BoardGridCell = BoardBlock;
export type BoardGrid = BoardBlock[][];

export type BoardBlockPlainObject = TowersPieceBlockPlainObject | PowerPieceBlockPlainObject | typeof EMPTY_CELL;
export type BoardGridRowPlainObject = BoardBlockPlainObject[];
export type BoardGridColPlainObject = BoardBlockPlainObject[];
export type BoardGridCellPlainObject = BoardBlockPlainObject;
export type BoardGridPlainObject = BoardBlockPlainObject[][];

interface Hoo {
  positions: PieceBlockPosition[]
  hoosFallsCount: number
}

export interface BlockToRemove {
  row: number
  col: number
  removedByOrigin?: PieceBlockPosition
}

type BoardSide = "self" | "partner";

interface BlockToRemoveWithBoard extends BlockToRemove {
  board: BoardSide
}

export interface BoardPlainObject {
  grid: BoardGridPlainObject
  isHooDetected: boolean
  isGameOver: boolean
}

/**
 * Represents the game board for a single player.
 *
 * Handles block placement, power interactions, and game-over detection.
 * Each board is linked to a power manager  and a callback to forward
 * special blocks to the player's power bar.
 */
export class Board {
  public grid: BoardGrid;
  public towersPieceBlockPowerManager: TowersPieceBlockPowerManager;
  private readonly hooDetector: HooDetector = new HooDetector();
  public isHooDetected: boolean = false;
  public hoos: Hoo[] = [];
  public hoosFallsCount: number = 0;
  private readonly colorMatchDetector: ColorMatchDetector = new ColorMatchDetector();
  public matchingBlockColors: PieceBlockPosition[] = [];
  public removedBlocksCount: number = 0;
  public isSpeedDropUnlocked: boolean = false;
  public isRemovePowersUnlocked: boolean = false;
  public isRemoveStonesUnlocked: boolean = false;
  public isGameOver: boolean = false;
  public partnerBoard: Board | null = null;
  public partnerSide: "left" | "right" | null = null;
  private addBlockToPowerBar: (block: PieceBlock) => void;

  constructor(
    towersPieceBlockPowerManager: TowersPieceBlockPowerManager,
    onAddBlockToPowerBar: (block: PieceBlock) => void,
  ) {
    this.grid = Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => EMPTY_CELL));
    this.towersPieceBlockPowerManager = towersPieceBlockPowerManager;
    this.addBlockToPowerBar = onAddBlockToPowerBar;
  }

  /**
   * Function to check if a position is within board bounds
   *
   * @param row - The row index to check.
   * @param col - The column index to check.
   * @returns A boolean indicating whether the specified row and column are within the visible board bounds.
   */
  private isWithinBoardBounds(row: number, col: number): boolean {
    return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
  }

  /**
   * Checks if moving the piece to the given offset causes a collision.
   *
   * @param piece - The piece to check.
   * @returns `true` if collision occurs, otherwise `false`.
   */
  public hasCollision(piece: Piece): boolean {
    return piece.blocks.some((block: PieceBlock) => {
      const { row, col }: PieceBlockPosition = block.position;
      return !this.isWithinBoardBounds(row, col) || !isEmptyCell(this.grid[row][col]);
    });
  }

  /**
   * Places a piece on the board.
   *
   * @param piece - The piece to place.
   */
  public placePiece(piece: Piece): void {
    for (const block of piece.blocks) {
      const { row, col }: PieceBlockPosition = block.position;

      if (this.isWithinBoardBounds(row, col)) {
        this.grid[row][col] = block;
      }
    }

    // this.printGrid();
  }

  private printGrid(): void {
    logger.debug("[Towers] Board:");

    for (let row = 0; row < BOARD_ROWS; row++) {
      const rowString: string = this.grid[row]
        .map((cell: BoardBlock) => (cell instanceof PieceBlock ? cell.letter : "▪"))
        .join(EMPTY_CELL);

      logger.debug(rowString);
    }
  }

  /**
   * Applies the effect of a special piece to the game board. Converts adjacent blocks based on Medusa and Midas effects
   * while ensuring the committed piece itself turns into an empty cell.
   *
   * @param powerPiece - The block type to convert surrounding blocks into.
   */
  public async convertSurroundingBlocksToPowerBlocks(powerPiece: Piece): Promise<void> {
    const blocksToRemove: BlockToRemove[] = [];

    for (const block of powerPiece.blocks) {
      const { row: pieceBlockRow, col: pieceBlockCol }: PieceBlockPosition = block.position;

      for (const direction of COLOR_MATCH_DIRECTIONS) {
        const adjRow: number = pieceBlockRow + direction.row;
        const adjCol: number = pieceBlockCol + direction.col;

        if (this.isWithinBoardBounds(adjRow, adjCol)) {
          const currentBlock: BoardBlock = this.grid[adjRow][adjCol];

          if (isTowersPieceBlock(currentBlock)) {
            if (isMedusaPiece(powerPiece)) {
              this.grid[adjRow][adjCol] = new MedusaPieceBlock({ row: adjRow, col: adjCol });
            } else if (isMidasPiece(powerPiece)) {
              this.grid[adjRow][adjCol] = new TowersPieceBlock("I", { row: adjRow, col: adjCol });
            }
          }
        }
      }

      blocksToRemove.push({ row: pieceBlockRow, col: pieceBlockCol });
    }

    this.breakBlocks(blocksToRemove, false);
  }

  /**
   * Resolves all effects caused by a landed piece:
   * - Detects hoos (local board only)
   * - Detects color matches (may span partner board)
   * - Removes the UNION of hoo + match blocks per iteration
   * - Applies gravity and repeats until stable
   *
   * IMPORTANT RULES:
   * - The landing that CREATES a hoo does NOT send blocks
   * - Only subsequent landings while hoosFallsCount > 0 send blocks
   * - Hoo never spans partner board
   *
   * @param waitForClientToFade - async hook allowing the client to animate block removal
   */
  public async processLandedPiece(
    waitForClientToFade: (board: Board, blocks: BlockToRemove[]) => Promise<void>,
  ): Promise<{ selfOutgoing: TowersPieceBlock[]; partnerOutgoing: TowersPieceBlock[]; isHooOccurred: boolean }> {
    const selfOutgoing: TowersPieceBlock[] = [];
    const partnerOutgoing: TowersPieceBlock[] = [];

    const hooActiveThisLanding: boolean = this.hoosFallsCount > 0;
    if (hooActiveThisLanding) this.isHooDetected = true;

    let isHooOccurred: boolean = false;
    let hoosThisIteration: Hoo[] = [];

    let shouldContinue: boolean = true;

    while (shouldContinue) {
      shouldContinue = false;

      this.clearRemovalFlags(this.grid);
      if (this.partnerBoard) this.clearRemovalFlags(this.partnerBoard.grid);

      const shouldSendBlocks: boolean = hooActiveThisLanding;

      this.checkForHoos(hoosThisIteration);

      if (this.hoos.length > 0) {
        isHooOccurred = true;
      }

      this.checkForMatchingBlockColors();

      const hooSelf: BlockToRemoveWithBoard[] =
        this.hoos.length > 0
          ? this.getHoosBlocksToRemove(shouldSendBlocks).map(
              (block: BlockToRemove): BlockToRemoveWithBoard => ({ ...block, board: "self" }),
            )
          : [];

      const matchSelf: BlockToRemoveWithBoard[] =
        this.matchingBlockColors.length > 0
          ? this.getMatchingBlocksToRemove(this.grid, this.matchingBlockColors, shouldSendBlocks).map(
              (block: BlockToRemove): BlockToRemoveWithBoard => ({ ...block, board: "self" }),
            )
          : [];

      const matchPartner: BlockToRemoveWithBoard[] =
        this.partnerBoard && this.partnerBoard.matchingBlockColors.length > 0
          ? this.getMatchingBlocksToRemove(
              this.partnerBoard.grid,
              this.partnerBoard.matchingBlockColors,
              shouldSendBlocks,
            ).map((block: BlockToRemove): BlockToRemoveWithBoard => ({ ...block, board: "partner" }))
          : [];

      const merged: BlockToRemoveWithBoard[] = this.unionRemovalsWithBoard(hooSelf, matchSelf, matchPartner);
      const { self: selfBlocks, partner: partnerBlocks } = this.splitByBoard(merged);

      if (selfBlocks.length === 0 && partnerBlocks.length === 0) break;

      // Current user's blocks to send to opponents
      if (selfBlocks.length > 0) {
        if (shouldSendBlocks) {
          const sent: TowersPieceBlock[] = this.setBlocksToBeSentToOpponents(this.grid, selfBlocks);
          selfOutgoing.push(...sent);
        }

        this.markToBeRemoved(this.grid, selfBlocks);
        await waitForClientToFade(this, selfBlocks);
        this.breakBlocks(selfBlocks);
      }

      // Partner's blocks to send to opponents
      if (this.partnerBoard && partnerBlocks.length > 0) {
        if (shouldSendBlocks) {
          const sent: TowersPieceBlock[] = this.setBlocksToBeSentToOpponents(this.partnerBoard.grid, partnerBlocks);
          partnerOutgoing.push(...sent);
        }

        this.markToBeRemoved(this.partnerBoard.grid, partnerBlocks);
        await waitForClientToFade(this.partnerBoard, partnerBlocks);
        this.partnerBoard.breakBlocks(partnerBlocks);
      }

      this.matchingBlockColors = [];
      if (this.partnerBoard) {
        this.partnerBoard.matchingBlockColors = [];
      }

      shouldContinue = true;
    }

    if (hooActiveThisLanding && this.hoosFallsCount > 0) {
      this.hoosFallsCount--;
    }

    this.isHooDetected = this.hoosFallsCount > 0;

    return { selfOutgoing, partnerOutgoing, isHooOccurred };
  }

  /**
   * Computes the list of blocks to remove for all detected hoos (special sequences).
   *
   * Each hoo contains a set of positions. If `shouldTagRemovedByOrigin` is true,
   * each block will carry its own position as `removedByOrigin` for directional animation.
   *
   * @param shouldTagRemovedByOrigin - Whether to tag each block with its origin position.
   * @returns An array of blocks with row/col and optional removedByOrigin.
   */
  private getHoosBlocksToRemove(shouldTagRemovedByOrigin: boolean): BlockToRemove[] {
    return this.hoos.flatMap((hoo: Hoo) =>
      hoo.positions
        .filter((position: PieceBlockPosition) => {
          const block: BoardBlock = this.grid[position.row][position.col];
          return isTowersPieceBlock(block);
        })
        .map((position: PieceBlockPosition) => ({
          ...position,
          ...(shouldTagRemovedByOrigin ? { removedByOrigin: position } : {}),
        })),
    );
  }

  /**
   * Computes the list of blocks to remove for standard color matches.
   *
   * The first matching position is used as the `removedByOrigin` for all blocks
   * if `shouldTagRemovedByOrigin` is true. This supports directional animations.
   *
   * @param grid
   * @param matchingBlockColors - Positions of matched blocks.
   * @param shouldTagRemovedByOrigin - Whether to tag blocks with a common origin.
   * @returns An array of blocks with row/col and optional removedByOrigin.
   */
  private getMatchingBlocksToRemove(
    grid: BoardGrid,
    matchingBlockColors: PieceBlockPosition[],
    shouldTagRemovedByOrigin: boolean,
  ): BlockToRemove[] {
    if (matchingBlockColors.length === 0) return [];
    const origin: PieceBlockPosition = matchingBlockColors[0];

    return matchingBlockColors
      .map((position: PieceBlockPosition) => {
        const block: BoardBlock = grid[position.row][position.col];
        if (!isTowersPieceBlock(block)) return null;

        return {
          ...position,
          ...(shouldTagRemovedByOrigin ? { removedByOrigin: origin } : {}),
        };
      })
      .filter((b: BlockToRemove | null): b is BlockToRemove => b !== null);
  }

  /**
   * Merges multiple removal lists into a single de-duplicated list.
   *
   * De-duplication key is **board + row + col**, so the same coordinate on "self"
   * and "partner" are treated as distinct removals.
   *
   * If the same block appears multiple times, this keeps the first entry unless a later
   * entry provides `removedByOrigin` while the existing one doesn't. In that case,
   * it upgrades the stored entry to preserve animation metadata.
   *
   * Typical usage:
   * - Combine hoo removals + match removals (and partner match removals) into one list
   * - Ensure a block is only removed once per iteration, even if multiple systems detected it
   *
   * @param lists - Any number of removal lists to union together.
   * @returns A new array containing the union of all removals with no duplicates.
   */
  private unionRemovalsWithBoard(...lists: BlockToRemoveWithBoard[][]): BlockToRemoveWithBoard[] {
    const map: Map<string, BlockToRemoveWithBoard> = new Map<string, BlockToRemoveWithBoard>();

    for (const list of lists) {
      for (const b of list) {
        const key: string = `${b.board}:${b.row}:${b.col}`; // board included!
        const existing: BlockToRemoveWithBoard | undefined = map.get(key);

        if (!existing) map.set(key, b);
        else if (!existing.removedByOrigin && b.removedByOrigin) map.set(key, b);
      }
    }

    return [...map.values()];
  }

  /**
   * Splits a merged removal list back into two lists: one for the local board and
   * one for the partner board.
   *
   * This strips the `board` discriminator and returns plain `BlockToRemove[]`
   * arrays that can be passed to board-specific APIs like:
   * - `markToBeRemoved(grid, blocks)`
   * - `waitForClientToFade(board, blocks)`
   * - `breakBlocks(blocks)`
   *
   * @param blocks - A list of removals tagged with which board they belong to.
   * @returns `{ self, partner }` where each list contains row/col (+ optional origin) removals.
   */
  private splitByBoard(blocks: BlockToRemoveWithBoard[]) {
    const self: BlockToRemove[] = [];
    const partner: BlockToRemove[] = [];

    for (const b of blocks) {
      const plain: BlockToRemove = { row: b.row, col: b.col, removedByOrigin: b.removedByOrigin }
      ;(b.board === "self" ? self : partner).push(plain);
    }

    return { self, partner };
  }

  /**
   * Marks blocks in the provided grid as "to be removed".
   *
   * This does not remove blocks yet — it only sets a flag (`isToBeRemoved`) on
   * `TowersPieceBlock` cells so the client can render removal previews/animations.
   *
   * Safe behavior:
   * - Ignores out-of-bounds coordinates via optional chaining
   * - Only marks `TowersPieceBlock` instances (stones / empties are ignored)
   *
   * @param grid - The board grid to apply flags to.
   * @param blocks - List of `{row, col}` coordinates to mark.
   */
  private markToBeRemoved(grid: BoardGrid, blocks: BlockToRemove[]): void {
    for (const { row, col } of blocks) {
      const block: BoardBlock = grid[row]?.[col];
      if (isTowersPieceBlock(block)) block.isToBeRemoved = true;
    }
  }

  /**
   * Clears all `isToBeRemoved` flags from a grid.
   *
   * This should be called at the start of each processing iteration to ensure:
   * - No stale removal flags persist across iterations
   * - Only blocks detected in the current iteration are visually marked/removed
   *
   * Note: only `TowersPieceBlock` has `isToBeRemoved`; stones/empties are ignored.
   *
   * @param grid - The board grid to reset.
   */
  private clearRemovalFlags(grid: BoardGrid): void {
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const b: BoardBlock = grid[r][c];
        if (isTowersPieceBlock(b)) b.isToBeRemoved = false;
      }
    }
  }

  /**
   * Converts a list of removed blocks into TowersPieceBlock instances
   * to be sent to the opponent. This is only done if `shouldTagRemovedByOrigin` is true,
   * which indicates that blocks are part of a special removal event (like hoos).
   *
   * @param grid - The blocks that will be removed.
   * @param blocksToRemove - The blocks that will be removed.
   * @returns An array of TowersPieceBlock to send, or an empty array.
   */
  private setBlocksToBeSentToOpponents(grid: BoardGrid, blocksToRemove: BlockToRemove[]): TowersPieceBlock[] {
    return blocksToRemove
      .map(({ row, col }: BlockToRemove) => {
        const block: BoardBlock = grid[row][col];
        if (!isTowersPieceBlock(block)) return null;
        return new TowersPieceBlock(block.letter as TowersBlockLetter, { row, col });
      })
      .filter((block: TowersPieceBlock | null): block is TowersPieceBlock => !!block);
  }

  /**
   * Detects "hoo" patterns on the local board for the current gravity iteration
   * and updates the cumulative hoo state for the *current landing*.
   *
   * IMPORTANT RULES ENFORCED:
   * - Hoos are detected ONLY on the local board
   * - Hoos are accumulated per landing (across gravity iterations)
   * - The FIRST hoo in a landing gives NO combo bonus
   * - Each additional hoo in the same landing gives +1 combo bonus (once)
   * - Combo bonus does NOT stack repeatedly across iterations
   *
   * @param hoosThisLanding - Mutable accumulator of all hoos detected so far
   *                          during the current landed piece resolution
   */
  private checkForHoos(hoosThisLanding: Hoo[]): void {
    const detectedHoos: Hoo[] = this.hooDetector.detect(this.grid, (row: number, col: number): boolean =>
      this.isWithinBoardBounds(row, col),
    );

    if (detectedHoos.length === 0) {
      this.hoos = [];
      return;
    }

    this.isHooDetected = true;
    this.hoos = detectedHoos;

    const hoosBeforeIteration: number = hoosThisLanding.length;

    hoosThisLanding.push(...detectedHoos);

    const sumOfFalls: number = detectedHoos.reduce((sum: number, hoo: Hoo) => sum + hoo.hoosFallsCount, 0);
    const extraFalls: number = hoosBeforeIteration === 0 ? 0 : detectedHoos.length;
    this.hoosFallsCount += sumOfFalls + extraFalls;
  }

  /**
   * Checks for any clusters of matching TowersBlocks on this board (and partner board, if present)
   * and marks them for removal if they meet the match condition.
   *
   * If a partner board is present, this method treats both boards as one merged grid.
   * This allows matches to span the center line and break blocks on both boards.
   *
   * The scan checks in 8 directions: horizontal, vertical, and diagonals.
   * Detected matching blocks are added to `matchingBlockColors` on the respective board.
   */
  private checkForMatchingBlockColors(): void {
    this.matchingBlockColors = [];
    if (this.partnerBoard) this.partnerBoard.matchingBlockColors = [];

    let mergedGrid: BoardBlock[][] = [];
    let totalCols: number;

    if (this.partnerBoard) {
      const leftBoard: Board = this.partnerSide === "right" ? this : this.partnerBoard;
      const rightBoard: Board = this.partnerSide === "right" ? this.partnerBoard : this;

      totalCols = BOARD_COLS * 2;

      for (let row = 0; row < BOARD_ROWS; row++) {
        mergedGrid[row] = [...leftBoard.grid[row], ...rightBoard.grid[row]];
      }
    } else {
      mergedGrid = this.grid;
      totalCols = BOARD_COLS;
    }

    const matches: PieceBlockPosition[] = this.colorMatchDetector.detect(mergedGrid, totalCols);

    for (const position of matches) {
      if (this.partnerBoard) {
        if (position.col < BOARD_COLS) {
          const leftBoard: Board = this.partnerSide === "right" ? this : this.partnerBoard!;
          leftBoard.matchingBlockColors.push({ row: position.row, col: position.col });
        } else {
          const rightBoard: Board = this.partnerSide === "right" ? this.partnerBoard! : this;
          rightBoard.matchingBlockColors.push({ row: position.row, col: position.col - BOARD_COLS });
        }
      } else {
        this.matchingBlockColors.push(position);
      }
    }
  }

  /**
   * Removes specified blocks from the grid, and optionally shifts blocks downward.
   *
   * @param blocksToRemove - An array of blocks to be removed, each with row/col and optional origin metadata.
   * @param isShiftDownBlocks - Whether to shift blocks down after removal (default: true).
   */
  private breakBlocks(blocksToRemove: BlockToRemove[], isShiftDownBlocks: boolean = true): void {
    for (const { row, col } of blocksToRemove) {
      if (this.isWithinBoardBounds(row, col)) {
        const block: Block = this.grid[row][col];

        // Add power block to power bar
        if (isPowerBarItem(block)) {
          this.addBlockToPowerBar(block);
        }

        // Update block's power type and power level
        if (isTowersPieceBlock(block)) {
          block.isToBeRemoved = false;

          const blockLetter: PieceBlockLetter = block.letter;

          if (isTowersPieceBlockLetter(blockLetter)) {
            const powerState: PowerBlock = this.towersPieceBlockPowerManager.getTowersBlockPower(blockLetter);
            this.towersPieceBlockPowerManager.updatePowerBlock(blockLetter, {
              brokenBlocksCount: powerState?.brokenBlocksCount + 1,
            });
          }

          this.towersPieceBlockPowerManager.updatePowerBlockPower();
          this.removedBlocksCount++;
        }

        this.grid[row][col] = EMPTY_CELL;
      }
    }

    if (isShiftDownBlocks) {
      this.shiftDownBlocks();
    }
  }

  /**
   * Shifts down blocks in a board grid after removing certain elements.
   * Empty spaces (EMPTY_CELL) will be filled from above, maintaining column structure.
   */
  public shiftDownBlocks(): void {
    for (let col = 0; col < BOARD_COLS; col++) {
      const beforeCount: number = Array.from({ length: BOARD_ROWS }, (_, r: number) => this.grid[r][col]).filter(
        (cell: BoardBlock) => !isEmptyCell(cell),
      ).length;

      const newColumn: BoardGridCol = [];

      for (let row = BOARD_ROWS - 1; row >= 0; row--) {
        const cell: BoardBlock = this.grid[row][col];
        if (!isEmptyCell(cell)) newColumn.push(cell);
      }

      while (newColumn.length < BOARD_ROWS) {
        newColumn.push(EMPTY_CELL);
      }
      newColumn.reverse();

      const afterCount: number = newColumn.filter((cell: BoardBlock) => !isEmptyCell(cell)).length;

      if (afterCount !== beforeCount) {
        logger.warn(`[Towers] shiftDownBlocks LOST blocks in col=${col}: before=${beforeCount}, after=${afterCount}`);
        // Optional: dump the column types
        for (let r = 0; r < BOARD_ROWS; r++) {
          const cell: BoardBlock = this.grid[r][col];
          logger.warn(`  before r=${r} type=${cell?.constructor?.name ?? typeof cell} empty=${isEmptyCell(cell)}`);
        }
      }

      for (let row = 0; row < BOARD_ROWS; row++) {
        const cell: BoardBlock = newColumn[row];
        this.grid[row][col] = cell;
        if (cell instanceof PieceBlock) {
          cell.position = { row, col };
        }
      }
    }
  }

  /**
   * Randomly distributes blocks onto the board by selecting random columns
   * and placing each block at the appropriate height in that column.
   * Blocks are only placed if a valid position is found (not off the board).
   *
   * @param blocksToRemove - Array of incoming blocks to place (e.g. hoos blocks).
   */
  public placeBlocksFromHoo(blocksToRemove: TowersPieceBlock[]): void {
    // Shuffle blocks to distribute more randomly
    const shuffledBlocks: TowersPieceBlock[] = [...blocksToRemove].sort(() => Math.random() - 0.5);

    for (const block of shuffledBlocks) {
      if (!isTowersPieceBlock(block)) continue;

      let attempts: number = 0;
      let isPlaced: boolean = false;

      while (attempts < 5 && !isPlaced) {
        const col: number = Math.floor(Math.random() * BOARD_COLS);
        const row: number | null = this.getPlacementRowInColumn(col);

        if (row !== null) {
          this.grid[row][col] = new TowersPieceBlock(block.letter as TowersBlockLetter, { row, col });
          isPlaced = true;
        }

        attempts++;
      }
    }
  }

  /**
   * Finds the row index where a block can be placed in a given column.
   * This ensures the block rests directly above the highest non-empty cell
   * or at the bottom if the column is empty.
   *
   * @param col - The column index (0-based).
   * @returns The row index where the block should be placed, or `null` if the block
   *          cannot be placed (e.g. if the column is full and there's no space above).
   */
  private getPlacementRowInColumn(col: number): number | null {
    for (let row = 0; row < BOARD_ROWS; row++) {
      if (!isEmptyCell(this.grid[row][col])) {
        // Found a non-empty cell → place block just above it
        return row > 0 ? row - 1 : null; // can't place above top row
      }
    }

    // Entire column is empty → place block at the bottom
    return BOARD_ROWS - 1;
  }

  /**
   * Checks if the game is over based on the position of the current piece and the state of the board.
   * A player loses if:
   * - Any part of the placed piece reaches row 0 or 1.
   * - Any existing blocks are pushed into row 0 or 1.
   *
   * @param piece - The last committed piece.
   * @returns `true` if the player has lost, otherwise `false`.
   */
  public checkIfGameOver(piece: Piece): boolean {
    const isOverlappingHiddenRows: boolean = piece.blocks.some((block: PieceBlock) => {
      const blockRow: number = block.position.row;
      return blockRow >= 0 && blockRow < HIDDEN_ROWS_COUNT;
    });

    if (isOverlappingHiddenRows) {
      this.isGameOver = true;
      logger.debug("[Towers] Game Over for user: Placed piece is overlapping board bounds.");
      return true;
    }

    // Check if any existing block has reached row 2, 1 or 0
    for (let col = 0; col < BOARD_COLS; col++) {
      for (let row = 0; row < HIDDEN_ROWS_COUNT; row++) {
        if (!isEmptyCell(this.grid[row][col])) {
          this.isGameOver = true;
          logger.debug("[Towers] Game Over for user: No more space to place pieces.");
          return true;
        }
      }
    }

    return false;
  }

  public toPlainObject(): BoardPlainObject {
    return {
      grid: this.grid.map((row: BoardGridRow) =>
        row.map((block: BoardGridCell) => (isEmptyCell(block) ? EMPTY_CELL : block.toPlainObject())),
      ),
      isHooDetected: this.isHooDetected,
      isGameOver: this.isGameOver,
    };
  }
}
