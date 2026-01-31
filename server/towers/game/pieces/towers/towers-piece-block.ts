import {
  BlockLetter,
  PieceBlock,
  PieceBlockPosition,
  RemovedByOrigin,
  TowersBlockLetter,
  TowersBlockPowerLevel,
  TowersBlockPowerType,
} from "@/server/towers/game/pieces/piece-block";
import {
  PowerBlock,
  TowersPieceBlockPowerManager,
} from "@/server/towers/game/pieces/towers/towers-piece-block-power-manager";

export interface TowersPieceBlockPlainObject {
  letter: TowersBlockLetter
  position: PieceBlockPosition
  powerType: TowersBlockPowerType
  powerLevel: TowersBlockPowerLevel
  isToBeRemoved: boolean
  removedByOrigin?: RemovedByOrigin
}

export const TOWERS_LETTERS: TowersBlockLetter[] = ["Y", "O", "U", "P", "I", "!"];

export const isTowersPieceBlockLetter = (letter: BlockLetter): letter is TowersBlockLetter => {
  return TOWERS_LETTERS.includes(letter as TowersBlockLetter);
};

export class TowersPieceBlock extends PieceBlock {
  public isToBeRemoved: boolean = false;
  public removedByOrigin?: RemovedByOrigin = undefined;

  constructor(
    letter?: TowersBlockLetter,
    position: PieceBlockPosition = { row: 0, col: 0 },
    powerType: TowersBlockPowerType = undefined,
    powerLevel: TowersBlockPowerLevel = undefined,
  ) {
    const towersLetter: TowersBlockLetter =
      letter && isTowersPieceBlockLetter(letter)
        ? letter
        : TOWERS_LETTERS[Math.floor(Math.random() * TOWERS_LETTERS.length)];

    super(towersLetter, position, powerType, powerLevel);
  }

  /**
   * Applies power effects to the block based on the `TowersPieceBlockPowerManager`.
   *
   * @param towersPieceBlockPowerManager - The power manager responsible for handling power effects associated with Towers blocks.
   */
  public applyBlockPower(towersPieceBlockPowerManager: TowersPieceBlockPowerManager): void {
    if (isTowersPieceBlockLetter(this.letter)) {
      const powerState: PowerBlock = towersPieceBlockPowerManager.getTowersBlockPower(this.letter);

      if (powerState.isPowerToBeApplied) {
        this.powerType = powerState.powerType;
        this.powerLevel = powerState.powerLevel;
        towersPieceBlockPowerManager.markPowerAsAppliedToBlock(this.letter);
      }
    }
  }

  public static fromPlainObject(obj: TowersPieceBlockPlainObject): TowersPieceBlock {
    const block: TowersPieceBlock = new TowersPieceBlock(obj.letter, obj.position, obj.powerType, obj.powerLevel);
    block.isToBeRemoved = obj.isToBeRemoved;
    block.removedByOrigin = obj.removedByOrigin;
    return block;
  }

  public toPlainObject(): TowersPieceBlockPlainObject {
    if (!isTowersPieceBlockLetter(this.letter)) {
      throw new Error(`Invalid letter for TowersPieceBlock: ${this.letter}`);
    }

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
