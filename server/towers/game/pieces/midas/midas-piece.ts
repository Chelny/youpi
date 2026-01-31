import { PIECE_LENGTH, PIECE_STARTING_COL, PIECE_STARTING_ROW } from "@/constants/game";
import { MidasPieceBlock } from "@/server/towers/game/pieces/midas/midas-piece-block";
import { Piece } from "@/server/towers/game/pieces/piece";
import { PieceBlockPosition } from "@/server/towers/game/pieces/piece-block";

export class MidasPiece extends Piece {
  constructor(
    blocks: MidasPieceBlock[] = Array.from({ length: PIECE_LENGTH }, () => new MidasPieceBlock()),
    position: PieceBlockPosition = { row: PIECE_STARTING_ROW, col: PIECE_STARTING_COL },
  ) {
    super(blocks, position);
  }
}
