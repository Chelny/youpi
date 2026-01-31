import { logger } from "@/lib/logger";
import { TowersBlockLetter, TowersBlockPowerLevel, TowersBlockPowerType } from "@/server/towers/game/pieces/piece-block";

export type TowersBlockPowerState = { [key in TowersBlockLetter]: PowerBlock };

export interface PowerBlock {
  powerType: TowersBlockPowerType
  powerLevel: TowersBlockPowerLevel
  isPowerToBeApplied: boolean
  brokenBlocksCount: number
}

export const INITIAL_TOWERS_LETTER_POWER_STATE: TowersBlockPowerState = {
  Y: { powerType: undefined, powerLevel: undefined, isPowerToBeApplied: false, brokenBlocksCount: 0 },
  O: { powerType: undefined, powerLevel: undefined, isPowerToBeApplied: false, brokenBlocksCount: 0 },
  U: { powerType: undefined, powerLevel: undefined, isPowerToBeApplied: false, brokenBlocksCount: 0 },
  P: { powerType: undefined, powerLevel: undefined, isPowerToBeApplied: false, brokenBlocksCount: 0 },
  I: { powerType: undefined, powerLevel: undefined, isPowerToBeApplied: false, brokenBlocksCount: 0 },
  "!": { powerType: undefined, powerLevel: undefined, isPowerToBeApplied: false, brokenBlocksCount: 0 },
};

/**
 * Manages the state of powers associated with letter blocks.
 */
export class TowersPieceBlockPowerManager {
  private towersBlockPowers: TowersBlockPowerState;
  private removedBlocksCountForPowers: number = 4;

  constructor() {
    this.towersBlockPowers = { ...INITIAL_TOWERS_LETTER_POWER_STATE };
  }

  /**
   * Retrieves the power state of a specific Towers letter block.
   *
   * @param letter - The Towers block letter (T, O, W, E, R, S).
   * @returns The current power state of the specified letter.
   */
  public getTowersBlockPower(letter: TowersBlockLetter): TowersBlockPowerState[TowersBlockLetter] {
    return this.towersBlockPowers[letter];
  }

  /**
   * Updates the power state of a specific Towers letter block.
   * This method merges the existing power state with the new power block values.
   *
   * @param letter - The Towers block letter (T, O, W, E, R, S) whose power state is to be updated.
   * @param powerBlock - The new power block properties to be merged with the existing power state.
   *
   * This method allows you to modify the power type, power level, broken block count, or other properties of a specific Towers letter.
   */
  public updatePowerBlock(letter: TowersBlockLetter, powerBlock: Partial<PowerBlock>): void {
    this.towersBlockPowers[letter] = {
      ...this.towersBlockPowers[letter],
      ...powerBlock,
    };
  }

  /**
   * Updates the power type and level for each Towers block letter
   * when the number of broken blocks meets the threshold.
   *
   * **Progression Logic:**
   * - Players gain a power every N broken blocks (`removedBlocksCountForPowers`).
   * - Power types alternate: attack → defense → attack → ...
   * - Power levels progress by cycle:
   *   - 1st: attack (minor)
   *   - 2nd: defense (minor)
   *   - 3rd: attack (normal)
   *   - 4th: defense (normal)
   *   - 5th: attack (mega)
   *   - 6th: defense (mega)
   *   - 7th+: attack (berserk) forever
   *
   * Once berserk is activated (all letters at 7+ powers), the block
   * requirement for powers drops (e.g. from 4 to 3).
   */
  public updatePowerBlockPower(): void {
    for (const key in this.towersBlockPowers) {
      const blockLetter = key as TowersBlockLetter;
      const powerBlock = this.towersBlockPowers[blockLetter];

      if (powerBlock.brokenBlocksCount >= this.removedBlocksCountForPowers) {
        let nextPowerType: TowersBlockPowerType;
        let nextPowerLevel: TowersBlockPowerLevel;

        const count: number = this.getPowerCountForLetter(blockLetter);

        switch (count) {
          case 0:
            nextPowerType = "attack";
            nextPowerLevel = "minor";
            break;
          case 1:
            nextPowerType = "defense";
            nextPowerLevel = "minor";
            break;
          case 2:
            nextPowerType = "attack";
            nextPowerLevel = "normal";
            break;
          case 3:
            nextPowerType = "defense";
            nextPowerLevel = "normal";
            break;
          case 4:
            nextPowerType = "attack";
            nextPowerLevel = "mega";
            break;
          case 5:
            nextPowerType = "defense";
            nextPowerLevel = "mega";
            break;
          default:
            nextPowerType = "attack";
            nextPowerLevel = "berserk";
            break;
        }

        // If all letters are at berserk, reduce the threshold for power gain
        if (this.checkIfBerserkActivated()) {
          this.removedBlocksCountForPowers = 3;
        }

        this.towersBlockPowers[blockLetter] = {
          ...powerBlock,
          powerType: nextPowerType,
          powerLevel: nextPowerLevel,
          isPowerToBeApplied: true,
          brokenBlocksCount: 0, // Reset after granting power
        };

        logger.debug(
          `[Towers] "${blockLetter}" power updated → ${nextPowerType.toUpperCase()} ${nextPowerLevel.toUpperCase()}`,
        );
      }
    }
  }

  /**
   * Returns how many powers (attack or defense) have been granted to a specific letter.
   *
   * This is used to track how many times a power has been granted for the block letter,
   * which is important for determining progression (minor → normal → mega → berserk).
   *
   * @param letter - The Towers block letter to check.
   * @returns The number of powers granted for this block letter.
   */
  private getPowerCountForLetter(letter: TowersBlockLetter): number {
    const powerBlock: PowerBlock = this.towersBlockPowers[letter];
    let count: number = 0;

    if (powerBlock.powerLevel === "minor") count = 1;
    else if (powerBlock.powerLevel === "normal") count = 3;
    else if (powerBlock.powerLevel === "mega") count = 5;
    else if (powerBlock.powerLevel === "berserk") count = 6;

    // +1 if latest was a defense in each tier
    if (powerBlock.powerType === "defense" && powerBlock.powerLevel !== "berserk") {
      count += 1;
    }

    return count;
  }

  /**
   * Returns true if all letters have reached the berserk stage,
   * meaning they have been granted at least 7 powers (ending in attack berserk).
   *
   * This indicates the player has reached the berserk period, where all
   * future powers are attack-only and the block threshold is reduced.
   *
   * @returns True if berserk is activated, otherwise false.
   */
  private checkIfBerserkActivated(): boolean {
    return Object.values(this.towersBlockPowers).every((pb: PowerBlock) => {
      return (pb.powerLevel === "mega" && pb.powerType === "defense") || pb.powerLevel === "berserk";
    });
  }

  /**
   * Marks a power as applied for a given Towers letter.
   * This prevents the power from being reapplied multiple times.
   *
   * @param letter - The Towers block letter whose power should be marked as applied.
   */
  public markPowerAsAppliedToBlock(letter: TowersBlockLetter): void {
    this.towersBlockPowers[letter] = {
      ...this.towersBlockPowers[letter],
      isPowerToBeApplied: false,
    };
  }

  /**
   * Resets all Towers letter powers to their initial state.
   * This is useful for game restarts or when clearing power effects.
   */
  public resetPowers(): void {
    this.towersBlockPowers = { ...INITIAL_TOWERS_LETTER_POWER_STATE };
  }
}
