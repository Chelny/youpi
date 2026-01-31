import { POWER_BAR_LENGTH } from "@/constants/game";
import { PieceBlockPlainObject } from "@/server/towers/game/pieces/piece-block";
import { SpecialDiamond, SpecialDiamondPlainObject } from "@/server/towers/game/pieces/special-diamond/special-diamond";
import { TowersPieceBlock } from "@/server/towers/game/pieces/towers/towers-piece-block";

export type PowerBarItem = TowersPieceBlock | SpecialDiamond;
export type PowerBarItemPlainObject = PieceBlockPlainObject | SpecialDiamondPlainObject;

export interface PowerBarPlainObject {
  queue: PowerBarItemPlainObject[]
  nextItem?: PowerBarItemPlainObject
}

/**
 * Manages the player's power bar during the game.
 *
 * The power bar accumulates power queue (special blocks or effects)
 * that the player can use strategically during gameplay.
 */
export class PowerBar {
  public queue: PowerBarItem[] = [];
  public nextItem?: PowerBarItem = undefined;

  /**
   * Add a piece block or special diamond to the power bar.
   *
   * @param item - TowersPieceBlock or SpecialDiamond to add.
   */
  public addItem(item: PowerBarItem): void {
    this.queue.push(item);

    if (this.queue.length > POWER_BAR_LENGTH) {
      this.queue.splice(0, this.queue.length - POWER_BAR_LENGTH);
    }
  }

  /**
   * Use a piece block or special diamond to the power bar.
   *
   * @returns TowersPieceBlock or SpecialDiamond to be used.
   */
  public useItem(): PowerBarItem | null {
    if (this.queue.length > 0) {
      const item: PowerBarItem | undefined = this.queue.pop();

      if (item instanceof TowersPieceBlock || item instanceof SpecialDiamond) {
        return item;
      }
    }

    return null;
  }

  /**
   * Removes and returns the last item from the power bar.
   * This function ensures that SpecialDiamond queue are not removed.
   *
   * @returns TowersPieceBlock to be used.
   */
  public removePieceBlockItem(): TowersPieceBlock | null {
    while (this.queue.length > 0) {
      const item: PowerBarItem | undefined = this.queue.pop();

      if (item instanceof TowersPieceBlock) {
        return item;
      }
    }

    return null;
  }

  /**
   * Clears the power bar.
   */
  public clear(): void {
    this.queue = [];
  }

  /**
   * Converts the PowerBar instance to a plain object.
   *
   * @returns Plain object representation of the PowerBar.
   */
  public toPlainObject(): PowerBarPlainObject {
    return {
      queue: this.queue.map((item: PowerBarItem) => {
        if (item instanceof TowersPieceBlock || item instanceof SpecialDiamond) {
          return item.toPlainObject();
        }

        throw new Error("Unsupported PowerBarItem type");
      }),
      nextItem: this.queue[this.queue.length - 1]?.toPlainObject(),
    };
  }
}
