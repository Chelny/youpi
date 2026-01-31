import { EMPTY_CELL } from "@/constants/game";

export type BlockLetter = "Y" | "O" | "U" | "P" | "I" | "!" | "ME" | "MI" | "SD" | typeof EMPTY_CELL;
export type PieceBlockLetter = Exclude<BlockLetter, "SD" | typeof EMPTY_CELL>;
export type TowersBlockLetter = Exclude<PieceBlockLetter, "MI" | "ME">;
export type PowerBlockLetter = Extract<PieceBlockLetter, "MI" | "ME">;
export type TowersBlockPowerType = "attack" | "defense" | undefined;
export type TowersBlockPowerLevel = "minor" | "normal" | "mega" | "berserk" | undefined;

export interface PieceBlockPosition {
  row: number
  col: number
}

export interface RemovedByOrigin {
  row: number
  col: number
}

export interface PieceBlockPlainObject {
  letter: PieceBlockLetter
  position: PieceBlockPosition
  powerType?: TowersBlockPowerType
  powerLevel?: TowersBlockPowerLevel
  isToBeRemoved?: boolean
  removedByOrigin?: RemovedByOrigin
}

export interface PowerPieceBlockPlainObject {
  // Medusa and Midas
  letter: PieceBlockLetter
  position: PieceBlockPosition
}

/**
 * Represents an individual block in a piece.
 */
export class PieceBlock {
  public letter: PieceBlockLetter;
  public position: PieceBlockPosition;
  public powerType?: TowersBlockPowerType;
  public powerLevel?: TowersBlockPowerLevel;
  public isToBeRemoved?: boolean = false;
  public removedByOrigin?: RemovedByOrigin;

  /**
   * Creates a new block for a piece.
   *
   * @param letter - The letter representing the block (from "YOUPI!", "MI" or "ME").
   * @param position - The position of the block (default: { row: 0, col: 0 }).
   * @param powerType - The power type of the block (default: null).
   * @param powerLevel - The power level of the block (default: null).
   */
  constructor(
    letter: PieceBlockLetter,
    position: PieceBlockPosition = { row: 0, col: 0 },
    powerType: TowersBlockPowerType = undefined,
    powerLevel: TowersBlockPowerLevel = undefined,
  ) {
    this.letter = letter;
    this.position = position;
    this.powerType = powerType;
    this.powerLevel = powerLevel;
  }

  public clone(): PieceBlock {
    return new PieceBlock(this.letter, { ...this.position }, this.powerType, this.powerLevel);
  }

  public toPlainObject(): PieceBlockPlainObject {
    return {
      letter: this.letter,
      position: this.position,
      powerType: this.powerType,
      powerLevel: this.powerLevel,
      isToBeRemoved: this.isToBeRemoved,
      removedByOrigin: this.removedByOrigin,
    };
  }
}
