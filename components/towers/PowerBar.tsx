import { ReactNode } from "react";
import clsx from "clsx/lite";
import DefenseBlock from "@/components/towers/DefenseBlock";
import RegularBlock from "@/components/towers/RegularBlock";
import SpecialDiamondBlock from "@/components/towers/SpecialDiamondBlock";
import { PowerBarItemPlainObject, PowerBarPlainObject } from "@/server/towers/game/power-bar";
import { getClassNameForBlock, getClassNameForBlockPowerType } from "@/utils/block-class-names";
import { isSpecialDiamond } from "@/utils/block-guards";

type PowerBarProps = {
  powerBar: PowerBarPlainObject | null
};

export default function PowerBar({ powerBar }: PowerBarProps): ReactNode {
  return (
    <>
      {powerBar?.queue?.map((block: PowerBarItemPlainObject, blockIndex: number) => (
        <div
          key={blockIndex}
          className={clsx(
            "w-grid-cell-width h-grid-cell-height box-border text-center",
            getClassNameForBlock(block),
            getClassNameForBlockPowerType(block),
          )}
        >
          {isSpecialDiamond(block) ? (
            <SpecialDiamondBlock block={block} />
          ) : block.powerType === "defense" ? (
            <DefenseBlock letter={block.letter} />
          ) : (
            <RegularBlock letter={block.letter} />
          )}
        </div>
      ))}
    </>
  );
}
