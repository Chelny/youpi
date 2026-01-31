import { ReactNode } from "react";
import clsx from "clsx/lite";
import GridCell from "@/components/towers/GridCell";
import { EMPTY_CELL, HIDDEN_ROWS_COUNT } from "@/constants/game";
import { BoardBlock, BoardRow, PieceBlock } from "@/interfaces/towers";
import { BlockToRemove } from "@/server/towers/game/board/board";
import { PiecePlainObject } from "@/server/towers/game/pieces/piece";

type GridRowProps = {
  rowIndex: number
  row: BoardRow
  isOpponentBoard?: boolean
  currentPiece: PiecePlainObject | null
  blocksToRemove?: BlockToRemove[]
};

export default function GridRow({
  rowIndex,
  row,
  isOpponentBoard = false,
  currentPiece,
  blocksToRemove,
}: GridRowProps): ReactNode {
  return (
    <div
      className={clsx(
        "grid",
        rowIndex < HIDDEN_ROWS_COUNT && "hidden",
        isOpponentBoard ? "grid-cols-(--grid-cols-grid-row-opponent)" : "grid-cols-(--grid-cols-grid-row)",
      )}
      role="row"
    >
      {row.map((boardBlock: BoardBlock, colIndex: number) => {
        const currentPieceBlock: BoardBlock | undefined = currentPiece?.blocks.find(
          (pieceBlock: PieceBlock) => pieceBlock.position.row === rowIndex && pieceBlock.position.col === colIndex,
        );
        const block: BoardBlock = boardBlock === EMPTY_CELL && currentPieceBlock ? currentPieceBlock : boardBlock;
        const blockToRemove: BlockToRemove | undefined = blocksToRemove?.find(
          (block: BlockToRemove) => block.row === rowIndex && block.col === colIndex,
        );
        const enhancedBlock: BoardBlock = blockToRemove
          ? {
              // @ts-ignore
              ...block,
              isToBeRemoved: true,
              removedByOrigin: blockToRemove.removedByOrigin,
            }
          : block;

        return <GridCell key={colIndex} block={enhancedBlock} isOpponentBoard={isOpponentBoard} />;
      })}
    </div>
  );
}
