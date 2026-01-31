import { ReactNode } from "react";
import clsx from "clsx/lite";
import DefenseBlock from "@/components/towers/DefenseBlock";
import RegularBlock from "@/components/towers/RegularBlock";
import { NextPieceBlock } from "@/interfaces/towers";
import { PiecePlainObject } from "@/server/towers/game/pieces/piece";
import { getClassNameForBlock, getClassNameForBlockPowerType } from "@/utils/block-class-names";
import { isTowersPieceBlock } from "@/utils/block-guards";

type NextPieceProps = {
  nextPiece?: PiecePlainObject
};

export default function NextPiece({ nextPiece }: NextPieceProps): ReactNode {
  return (
    <>
      {nextPiece?.blocks?.map((block: NextPieceBlock, blockIndex: number) => (
        <div
          key={blockIndex}
          className={clsx(
            "w-grid-cell-width h-grid-cell-height box-border text-center",
            getClassNameForBlock(block),
            getClassNameForBlockPowerType(block),
          )}
        >
          {isTowersPieceBlock(block) && block.powerType === "defense" ? (
            <DefenseBlock letter={block.letter} />
          ) : (
            <RegularBlock letter={isTowersPieceBlock(block) ? block.letter : undefined} />
          )}
        </div>
      ))}
    </>
  );
}
