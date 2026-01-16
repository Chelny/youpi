import { BOARD_COLS, BOARD_ROWS, EMPTY_CELL, HIDDEN_ROWS_COUNT } from "@/constants/game";
import { logger } from "@/lib/logger";
import { TablePlayer } from "@/server/towers/classes/TablePlayer";
import { TableSeat } from "@/server/towers/classes/TableSeat";
import { Board, BoardBlock, BoardGrid, BoardGridRow } from "@/server/towers/game/board/Board";
import { PowerGridOps } from "@/server/towers/game/board/PowerGridOps";
import { PowerShuffleLogic } from "@/server/towers/game/board/PowerShuffleLogic";
import { MedusaPieceBlock } from "@/server/towers/game/MedusaPieceBlock";
import {
  PieceBlockPosition,
  TowersBlockLetter,
  TowersBlockPowerLevel,
  TowersBlockPowerType,
} from "@/server/towers/game/PieceBlock";
import { PowerBar, PowerBarItem } from "@/server/towers/game/PowerBar";
import { SpecialDiamond, SpecialDiamondPowerType } from "@/server/towers/game/SpecialDiamond";
import { TowersPieceBlock } from "@/server/towers/game/TowersPieceBlock";
import {
  isEmptyCell,
  isMedusaPieceBlock,
  isSpecialDiamond,
  isTowersPieceBlock,
} from "@/server/towers/utils/piece-type-check";

type TowersEffectKey = `${TowersBlockLetter}:${TowersBlockPowerType}`;
type DiamondEffectKey = `SD:${SpecialDiamondPowerType}`;

export interface PowerEffectContext {
  tableId: string
  seat?: TableSeat
  board?: Board | null
  game?: {
    queueSpeedDropNextPiece: (seatNumber: number) => void
  }
  readonly grid?: BoardGrid
  setGrid?: (grid: BoardGrid) => void
  powerBar?: PowerBar | null
  source: TablePlayer
  target?: TablePlayer
}

export interface PowerEffect<TItem> {
  apply(ctx: PowerEffectContext, item: TItem): Promise<void> | void
}

export class PowerEffectRegistry {
  private towersEffects: Map<TowersEffectKey, PowerEffect<TowersPieceBlock>> = new Map<
    TowersEffectKey,
    PowerEffect<TowersPieceBlock>
  >();
  private diamondEffects: Map<DiamondEffectKey, PowerEffect<SpecialDiamond>> = new Map<
    DiamondEffectKey,
    PowerEffect<SpecialDiamond>
  >();

  public registerTowers(
    letter: TowersBlockLetter,
    powerType: TowersBlockPowerType,
    effect: PowerEffect<TowersPieceBlock>,
  ): void {
    this.towersEffects.set(`${letter}:${powerType}`, effect);
  }

  public getTowers(
    letter: TowersBlockLetter,
    powerType: TowersBlockPowerType,
  ): PowerEffect<TowersPieceBlock> | undefined {
    return this.towersEffects.get(`${letter}:${powerType}`);
  }

  public registerDiamond(type: SpecialDiamondPowerType, effect: PowerEffect<SpecialDiamond>): void {
    this.diamondEffects.set(`SD:${type}`, effect);
  }

  public getDiamond(type: SpecialDiamondPowerType): PowerEffect<SpecialDiamond> | undefined {
    return this.diamondEffects.get(`SD:${type}`);
  }
}

/**
 * Adds an additional row to the bottom of an opponent’s screen.
 */
export class AddRowEffect implements PowerEffect<TowersPieceBlock> {
  apply(ctx: PowerEffectContext): void {
    if (!ctx.grid || !ctx.setGrid) return;

    const grid: BoardGrid = PowerGridOps.cloneGrid(ctx.grid);
    grid.shift();
    grid.push(Array.from({ length: BOARD_COLS }, () => new TowersPieceBlock()));
    PowerGridOps.commit(ctx, grid);

    logger.debug(`[Towers] Attack - Add row: ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}`);
  }
}

/**
 * Removes the bottom row from the board.
 */
export class RemoveRowEffect implements PowerEffect<TowersPieceBlock> {
  apply(ctx: PowerEffectContext): void {
    if (!ctx.grid || !ctx.setGrid) return;

    const grid: BoardGrid = PowerGridOps.cloneGrid(ctx.grid);
    grid.pop();
    grid.unshift(new Array(BOARD_COLS).fill(EMPTY_CELL));
    PowerGridOps.commit(ctx, grid);

    logger.debug(
      `[Towers] Defense - Remove row: ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}`,
    );
  }
}

/**
 * Changes the position of a certain number of blocks so that there is never a break or setup of breaks after the
 * dither is used. Dither does not move stones. Minor, normal, and mega versions exist.
 */
export class DitherEffect implements PowerEffect<TowersPieceBlock> {
  apply(ctx: PowerEffectContext, item: TowersPieceBlock): void {
    if (!ctx.grid || !ctx.setGrid || !item.powerLevel) return;

    const grid: BoardGrid = PowerGridOps.cloneGrid(ctx.grid);
    const logic: PowerShuffleLogic = new PowerShuffleLogic(grid);

    const swapCount: number = logic.getNumBlocksToRearrange(item.powerLevel);

    // Prevents infinite loops when the board is constrained
    const MAX_ATTEMPTS_PER_SWAP = 50;

    for (let i = 0; i < swapCount; i++) {
      let attempts: number = 0;
      let r1 = 0,
        c1 = 0,
        r2 = 0,
        c2 = 0;

      while (attempts < MAX_ATTEMPTS_PER_SWAP) {
        attempts++;

        // Avoid hidden rows
        r1 = HIDDEN_ROWS_COUNT + Math.floor(Math.random() * (BOARD_ROWS - HIDDEN_ROWS_COUNT));
        c1 = Math.floor(Math.random() * BOARD_COLS);
        r2 = HIDDEN_ROWS_COUNT + Math.floor(Math.random() * (BOARD_ROWS - HIDDEN_ROWS_COUNT));
        c2 = Math.floor(Math.random() * BOARD_COLS);

        if (r1 === r2 && c1 === c2) continue;

        const a: BoardBlock = grid[r1][c1];
        const b: BoardBlock = grid[r2][c2];

        // Don’t move empties / stones
        if (isEmptyCell(a) || isEmptyCell(b)) continue;
        if (isMedusaPieceBlock(a) || isMedusaPieceBlock(b)) continue;

        // Don’t create 3-in-row setups
        if (logic.isSettingUpThreeInRow(r1, c1, r2, c2)) continue;

        // Don’t create adjacent same-color pairs (your extra rule)
        if (logic.areAdjacentBlocksSame(r1, c1, r2, c2)) continue;

        // We found a valid swap
        logic.swap(r1, c1, r2, c2);
        break;
      }

      // If we fail too often, stop early (board too constrained)
      if (attempts >= MAX_ATTEMPTS_PER_SWAP) break;
    }

    PowerGridOps.commit(ctx, grid);

    logger.debug(`[Towers] Attack - Dither: ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}`);
  }
}

/**
 * Opposite of dither. Clump rearranges a certain number of blocks on the board to setup breaks. It will not however set
 * up a break directly (in other words, it never sets up three in a row). Clump comes in three flavours - minor, normal,
 * and mega and does not move stones.
 */
export class ClumpEffect implements PowerEffect<TowersPieceBlock> {
  apply(ctx: PowerEffectContext, item: TowersPieceBlock): void {
    if (!ctx.grid || !ctx.setGrid || !item.powerLevel) return;

    const grid: BoardGrid = PowerGridOps.cloneGrid(ctx.grid);
    const logic: PowerShuffleLogic = new PowerShuffleLogic(grid);

    const clumpCount: number = logic.getNumBlocksToRearrange(item.powerLevel);
    const MAX_ATTEMPTS_PER_SWAP = 50;

    for (let i = 0; i < clumpCount; i++) {
      let attempts: number = 0;

      while (attempts < MAX_ATTEMPTS_PER_SWAP) {
        attempts++;

        const r1: number = HIDDEN_ROWS_COUNT + Math.floor(Math.random() * (BOARD_ROWS - HIDDEN_ROWS_COUNT));
        const c1: number = Math.floor(Math.random() * BOARD_COLS);
        const r2: number = HIDDEN_ROWS_COUNT + Math.floor(Math.random() * (BOARD_ROWS - HIDDEN_ROWS_COUNT));
        const c2: number = Math.floor(Math.random() * BOARD_COLS);

        if (r1 === r2 && c1 === c2) continue;

        const a: BoardBlock = grid[r1][c1];
        const b: BoardBlock = grid[r2][c2];

        if (isEmptyCell(a) || isEmptyCell(b)) continue;
        if (isMedusaPieceBlock(a) || isMedusaPieceBlock(b)) continue;

        // Clump should NOT create an immediate 3-in-row
        if (logic.isSettingUpThreeInRow(r1, c1, r2, c2)) continue;

        logic.swap(r1, c1, r2, c2);

        // Your logic already guarantees this should be false, but keeping this is fine as a safety net:
        if (logic.isSettingUpThreeInRow(r1, c1, r2, c2)) {
          logic.swap(r1, c1, r2, c2);
          continue;
        }

        break;
      }

      if (attempts >= MAX_ATTEMPTS_PER_SWAP) break;
    }

    PowerGridOps.commit(ctx, grid);

    logger.debug(`[Towers] Defense - Clump: ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}`);
  }
}

/**
 * Minor adds one stone, normal adds two stones, and mega adds three to an opponent to the top of the board of one
 * opponent.
 */
export class AddStonesEffect implements PowerEffect<TowersPieceBlock> {
  apply(ctx: PowerEffectContext, item: TowersPieceBlock): void {
    if (!ctx.grid || !ctx.setGrid || !item.powerLevel) return;

    const grid: BoardGrid = PowerGridOps.cloneGrid(ctx.grid);
    const numStones: number = getPowerMagnitude(item.powerLevel);

    for (let i = 0; i < numStones; i++) {
      // Find columns with at least one empty cell (visible area only)
      const validCols: number[] = [];

      for (let col = 0; col < BOARD_COLS; col++) {
        for (let row = BOARD_ROWS - 1; row >= HIDDEN_ROWS_COUNT; row--) {
          if (isEmptyCell(grid[row][col])) {
            validCols.push(col);
            break;
          }
        }
      }

      if (validCols.length === 0) break;

      const col: number = validCols[Math.floor(Math.random() * validCols.length)];

      // Place at the lowest empty row in that column
      for (let row = BOARD_ROWS - 1; row >= HIDDEN_ROWS_COUNT; row--) {
        if (isEmptyCell(grid[row][col])) {
          grid[row][col] = new MedusaPieceBlock({ row, col });
          break;
        }
      }
    }

    PowerGridOps.commit(ctx, grid);

    logger.debug(
      `[Towers] Attack - Add stones: ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}`,
    );
  }
}

/**
 * Takes one to three stones depending on minor, normal or mega and places them on the bottom row of the same column;
 * the rest of the blocks are moved up. If a stone already exists on the bottom row, the stone is dropped to the next
 * highest row without a stone.
 */
export class DropStonesEffect implements PowerEffect<TowersPieceBlock> {
  apply(ctx: PowerEffectContext, item: TowersPieceBlock): void {
    if (!ctx.grid || !ctx.setGrid || !item.powerLevel) return;

    const grid: BoardGrid = PowerGridOps.cloneGrid(ctx.grid);
    const numStones: number = getPowerMagnitude(item.powerLevel);

    // Collect all stones (visible area only)
    const stones: PieceBlockPosition[] = [];
    for (let row = HIDDEN_ROWS_COUNT; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        if (isMedusaPieceBlock(grid[row][col])) stones.push({ row, col });
      }
    }

    if (stones.length === 0) return;

    const selected: PieceBlockPosition[] = stones
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(numStones, stones.length));

    for (const { row: fromRow, col } of selected) {
      const cell: BoardBlock = grid[fromRow][col];
      if (!isMedusaPieceBlock(cell)) continue;

      const stone: MedusaPieceBlock = cell;

      // Find target row:
      // bottom-most row in this column that is NOT a stone.
      // (So if bottom is a stone, target becomes next highest non-stone row.)
      let targetRow: number = BOARD_ROWS - 1;
      while (targetRow >= HIDDEN_ROWS_COUNT && isMedusaPieceBlock(grid[targetRow][col])) {
        targetRow--;
      }

      // If the entire visible column is stones, nothing to do.
      if (targetRow < HIDDEN_ROWS_COUNT) continue;

      // If already at target, skip
      if (fromRow === targetRow) continue;

      // Remove stone from its current location
      grid[fromRow][col] = EMPTY_CELL;

      // If stone is above targetRow, we "insert" lower -> shift UP between fromRow..targetRow
      // Example: move stone to bottom, everything between moves up 1.
      if (fromRow < targetRow) {
        for (let r = fromRow; r < targetRow; r++) {
          grid[r][col] = grid[r + 1][col];
        }
      } else {
        // fromRow > targetRow: rare (because targetRow tends to be low),
        // but if it happens, we shift DOWN between targetRow..fromRow
        for (let r = fromRow; r > targetRow; r--) {
          grid[r][col] = grid[r - 1][col];
        }
      }

      // Place stone at targetRow
      grid[targetRow][col] = stone;
      stone.position = { row: targetRow, col };
    }

    PowerGridOps.commit(ctx, grid);

    logger.debug(
      `[Towers] Defense - Drop stones: ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}`,
    );
  }
}

/**
 * A black stone replaces a purple power (P block) lodged in the board of an opponent. Minor, normal, and mega versions exist.
 */
export class DefuseEffect implements PowerEffect<TowersPieceBlock> {
  apply(ctx: PowerEffectContext, item: TowersPieceBlock): void {
    if (!ctx.grid || !ctx.setGrid || !item.powerLevel) return;

    const grid: BoardGrid = PowerGridOps.cloneGrid(ctx.grid);

    // Collect all purple blocks ("P") in visible area
    const purples: PieceBlockPosition[] = [];
    for (let row = HIDDEN_ROWS_COUNT; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const block: BoardBlock = grid[row][col];
        if (isTowersPieceBlock(block) && block.letter === "P") purples.push({ row, col });
      }
    }

    if (purples.length === 0) return;

    const logic: PowerShuffleLogic = new PowerShuffleLogic(grid);
    const toReplace: number = Math.min(logic.getNumBlocksToRearrange(item.powerLevel, purples.length), purples.length);

    const selected: PieceBlockPosition[] = purples.sort(() => Math.random() - 0.5).slice(0, toReplace);

    for (const { row, col } of selected) {
      grid[row][col] = new MedusaPieceBlock({ row, col });
    }

    PowerGridOps.commit(ctx, grid);

    logger.debug(`[Towers] Attack - Defuse: ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}`);
  }
}

/**
 * Any purple power within the board suddenly becomes the center of a 3x3 purple square (E blocks). In other words, all
 * surrounding pieces of either a defuse or color blast already in the board become purple blocks. No different
 * versions.
 */
export class ColorBlastEffect implements PowerEffect<TowersPieceBlock> {
  apply(ctx: PowerEffectContext): void {
    if (!ctx.grid || !ctx.setGrid) return;

    const grid: BoardGrid = PowerGridOps.cloneGrid(ctx.grid);
    const centers: PieceBlockPosition[] = [];

    for (let row = HIDDEN_ROWS_COUNT; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const block: BoardBlock = grid[row][col];
        if (isTowersPieceBlock(block) && block.letter === "P") centers.push({ row, col });
      }
    }

    for (const { row, col } of centers) {
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const rr: number = row + i;
          const cc: number = col + j;

          if (
            rr >= 0 &&
            rr < BOARD_ROWS &&
            cc >= 0 &&
            cc < BOARD_COLS &&
            !isEmptyCell(grid[rr][cc]) &&
            !isMedusaPieceBlock(grid[rr][cc])
          ) {
            grid[rr][cc] = new TowersPieceBlock("P", { row: rr, col: cc });
          }
        }
      }
    }

    PowerGridOps.commit(ctx, grid);

    logger.debug(
      `[Towers] Defense - Color blast: ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}`,
    );
  }
}

/**
 * Adds a Medusa piece to the front of the current player's next pieces queue.
 * This replaces the oldest piece while maintaining the queue size.
 */
export class MedusaPieceEffect implements PowerEffect<TowersPieceBlock> {
  apply(ctx: PowerEffectContext): void {
    ctx.seat?.nextPieces?.addMedusaPiece();
    logger.debug(
      `[Towers] Attack - Medusa piece: ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}`,
    );
  }
}

/**
 * Adds a Midas piece to the front of the current player's next pieces queue.
 * This replaces the oldest piece while maintaining the queue size.
 */
export class MidasPieceEffect implements PowerEffect<TowersPieceBlock> {
  apply(ctx: PowerEffectContext): void {
    ctx.seat?.nextPieces?.addMidasPiece();
    logger.debug(
      `[Towers] Defense - Midas piece: ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}`,
    );
  }
}

/**
 * Takes either one, two or three powers depending on minor/normal/mega from opponent’s power bar and
 * places them on the bottom row of their board.
 */
export class RemovePowersEffect implements PowerEffect<TowersPieceBlock> {
  apply(ctx: PowerEffectContext, item: TowersPieceBlock): void {
    if (!ctx.grid || !ctx.setGrid || !ctx.powerBar || !item.powerLevel) return;

    if (!ctx.powerBar.queue || ctx.powerBar.queue.length === 0) {
      logger.warn("[Towers] Couldn’t remove items from power bar because power bar is empty.");
      return;
    }

    const grid: BoardGrid = PowerGridOps.cloneGrid(ctx.grid);
    const num: number = getPowerMagnitude(item.powerLevel);
    const removed: PowerBarItem[] = [];

    for (let i = 0; i < num && ctx.powerBar.queue.length > 0; i++) {
      const block: TowersPieceBlock | null = ctx.powerBar.removePieceBlockItem();
      if (block !== null && !isSpecialDiamond(block)) removed.push(block);
    }

    if (removed.length === 0) return;

    const bottom: BoardGridRow = grid[BOARD_ROWS - 1];

    // Only columns where bottom cell is a TowersPieceBlock are valid placement targets
    const validCols: number[] = bottom
      .map((cell: BoardBlock, index: number) => (isTowersPieceBlock(cell) ? index : -1))
      .filter((index: number) => index !== -1);

    if (validCols.length === 0) return;

    // Place blocks without repeatedly overwriting the same column
    for (const block of removed) {
      if (validCols.length === 0) break;

      const pickIndex: number = Math.floor(Math.random() * validCols.length);
      const col: number = validCols.splice(pickIndex, 1)[0];

      grid[BOARD_ROWS - 1][col] = block as BoardBlock;
    }

    PowerGridOps.commit(ctx, grid);

    logger.debug(
      `[Towers] Attack - Remove powers: ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}`,
    );
  }
}

/**
 * Removes the least abundant color on the board. No different versions. Does not affect stones (Medusa blocks).
 */
export class ColorPlagueEffect implements PowerEffect<TowersPieceBlock> {
  apply(ctx: PowerEffectContext): void {
    if (!ctx.board || !ctx.grid || !ctx.setGrid) return;

    const grid: BoardGrid = PowerGridOps.cloneGrid(ctx.grid);

    const counts: Record<string, number> = {};
    for (let row = HIDDEN_ROWS_COUNT; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        const block: BoardBlock = grid[row][col];
        if (isTowersPieceBlock(block)) counts[block.letter] = (counts[block.letter] ?? 0) + 1;
      }
    }

    let least: string | null = null;
    let leastCount: number = Infinity;

    for (const [letter, count] of Object.entries(counts)) {
      if (count < leastCount) {
        leastCount = count;
        least = letter;
      }
    }

    if (least) {
      for (let row = HIDDEN_ROWS_COUNT; row < BOARD_ROWS; row++) {
        for (let col = 0; col < BOARD_COLS; col++) {
          const block: BoardBlock = grid[row][col];
          if (isTowersPieceBlock(block) && block.letter === least) grid[row][col] = EMPTY_CELL;
        }
      }
    }

    PowerGridOps.commit(ctx, grid);
    ctx.board.shiftDownBlocks();

    logger.debug(
      `[Towers] Defense - Color plague: ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}`,
    );
  }
}

/**
 * Increases the speed of one opponent’s fall rate.
 */
export class SpecialSpeedDropEffect implements PowerEffect<SpecialDiamond> {
  async apply(ctx: PowerEffectContext): Promise<void> {
    const seatNumber: number | undefined = ctx.seat?.seatNumber;
    if (seatNumber == null) return;

    ctx.game?.queueSpeedDropNextPiece(seatNumber);

    logger.debug(
      `[Towers] Special Attack - Speed drop: ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}`,
    );
  }
}

/**
 * Removes all powers from an opponent’s board and power bar.
 */
export class SpecialRemovePowersEffect implements PowerEffect<SpecialDiamond> {
  apply(ctx: PowerEffectContext): void {
    if (!ctx.grid || !ctx.setGrid || !ctx.powerBar) return;

    const grid: BoardGrid = ctx.grid.map((row: BoardGridRow) =>
      row.map((block: BoardBlock) =>
        isTowersPieceBlock(block) ? new TowersPieceBlock(block.letter as TowersBlockLetter, block.position) : block,
      ),
    );

    PowerGridOps.commit(ctx, grid);
    ctx.powerBar.clear();

    logger.debug(
      `[Towers] Special Attack - Remove power: ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}`,
    );
  }
}

/**
 * Removes all stones from your board.
 */
export class SpecialRemoveStonesEffect implements PowerEffect<SpecialDiamond> {
  apply(ctx: PowerEffectContext): void {
    if (!ctx.board || !ctx.grid || !ctx.setGrid) return;

    const grid: BoardGrid = ctx.grid.map((row: BoardGridRow) =>
      row.map((block: BoardBlock) => (isMedusaPieceBlock(block) ? EMPTY_CELL : block)),
    );

    PowerGridOps.commit(ctx, grid);
    ctx.board.shiftDownBlocks();

    logger.debug(
      `[Towers] Special Defense - Remove stones: ${ctx.source.player.user.username} -> ${ctx.target?.player.user.username}`,
    );
  }
}

/**
 * Returns the numeric strength based on power level.
 * Used to scale intensity of effects (stone drops, power bar removal, etc.).
 *
 * @param powerLevel - The effect's strength ('minor', 'normal', 'mega', 'berserk').
 * @returns A number representing how strong the effect should be.
 */
function getPowerMagnitude(powerLevel: TowersBlockPowerLevel): number {
  switch (powerLevel) {
    case "minor":
      return 1;
    case "normal":
      return 2;
    default:
      return 3;
  }
}

export function buildDefaultRegistry(): PowerEffectRegistry {
  const registry: PowerEffectRegistry = new PowerEffectRegistry();

  // Y
  registry.registerTowers("Y", "attack", new AddRowEffect());
  registry.registerTowers("Y", "defense", new RemoveRowEffect());

  // O
  registry.registerTowers("O", "attack", new DitherEffect());
  registry.registerTowers("O", "defense", new ClumpEffect());

  // U
  registry.registerTowers("U", "attack", new AddStonesEffect());
  registry.registerTowers("U", "defense", new DropStonesEffect());

  // P
  registry.registerTowers("P", "attack", new DefuseEffect());
  registry.registerTowers("P", "defense", new ColorBlastEffect());

  // I
  registry.registerTowers("I", "attack", new MedusaPieceEffect());
  registry.registerTowers("I", "defense", new MidasPieceEffect());

  // !
  registry.registerTowers("!", "attack", new RemovePowersEffect());
  registry.registerTowers("!", "defense", new ColorPlagueEffect());

  // Special Diamonds
  registry.registerDiamond("speed drop", new SpecialSpeedDropEffect());
  registry.registerDiamond("remove powers", new SpecialRemovePowersEffect());
  registry.registerDiamond("remove stones", new SpecialRemoveStonesEffect());

  return registry;
}
