import { ReactNode } from "react";
import GridRow from "@/components/towers/GridRow";
import { BlockToRemove, BoardGridRowPlainObject, BoardPlainObject } from "@/server/towers/game/board/board";
import { PiecePlainObject } from "@/server/towers/game/pieces/piece";

type GridProps = {
  isOpponentBoard?: boolean
  board: BoardPlainObject | null
  currentPiece: PiecePlainObject | null
  blocksToRemove?: BlockToRemove[]
};

export default function Grid({ board, isOpponentBoard = false, currentPiece, blocksToRemove }: GridProps): ReactNode {
  return (
    <div className="static z-sticky" role="grid" tabIndex={0}>
      {board?.grid?.map((row: BoardGridRowPlainObject, rowIndex: number) => (
        <GridRow
          key={rowIndex}
          rowIndex={rowIndex}
          row={row}
          isOpponentBoard={isOpponentBoard}
          currentPiece={currentPiece}
          blocksToRemove={blocksToRemove}
        />
      ))}
    </div>
  );
}
