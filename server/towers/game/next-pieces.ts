import { NUM_NEXT_PIECES } from "@/constants/game";
import { MedusaPiece } from "@/server/towers/game/pieces/medusa/medusa-piece";
import { MidasPiece } from "@/server/towers/game/pieces/midas/midas-piece";
import { Piece, PiecePlainObject } from "@/server/towers/game/pieces/piece";
import { TowersPiece } from "@/server/towers/game/pieces/towers/towers-piece";
import { TowersPieceBlockPowerManager } from "@/server/towers/game/pieces/towers/towers-piece-block-power-manager";

export interface NextPiecesPlainObject {
  nextPiece: PiecePlainObject
}

/**
 * Manages the queue of upcoming pieces for a single player during the game.
 *
 * This class is responsible for generating and maintaining the upcoming
 * pieces that the player will play with. It interacts with the
 * TowersPieceBlockPowerManager to embed power-related logic into the pieces.
 */
export class NextPieces {
  private queue: Piece[];
  private towersPieceBlockPowerManager: TowersPieceBlockPowerManager;

  /**
   * Constructs a new instance of NextPieces.
   *
   * @param towersPieceBlockPowerManager - The power manager responsible for handling special blocks
   * and powers associated with pieces. This is used to enrich pieces with power-related behavior.
   */
  constructor(towersPieceBlockPowerManager: TowersPieceBlockPowerManager) {
    this.towersPieceBlockPowerManager = towersPieceBlockPowerManager;
    this.queue = this.generateNextPieces();
  }

  /**
   * Generates a list of random pieces.
   * @returns Array of generated pieces.
   */
  private generateNextPieces(): Piece[] {
    return Array.from({ length: NUM_NEXT_PIECES }, () => new TowersPiece());
  }

  /**
   * Gets the next piece from the queue and refills it.
   * @returns The next piece.
   */
  public getNextPiece(): Piece {
    let nextPiece: Piece = this.queue.shift()!;

    if (nextPiece instanceof TowersPiece) {
      nextPiece.applyPowerToBlocks(this.towersPieceBlockPowerManager);
    }

    this.queue.push(new TowersPiece());

    return nextPiece;
  }

  /**
   * Inserts Medusa piece at the front of the queue.
   * The last piece in the queue is removed to maintain the queue size.
   */
  public addMedusaPiece(): void {
    this.queue = [new MedusaPiece(), ...this.queue.slice(0, NUM_NEXT_PIECES - 1)];
  }

  /**
   * Inserts Midas piece at the front of the queue.
   * The last piece in the queue is removed to maintain the queue size.
   */
  public addMidasPiece(): void {
    this.queue = [new MidasPiece(), ...this.queue.slice(0, NUM_NEXT_PIECES - 1)];
  }

  /**
   * Converts the NextPieces instance to a plain object.
   * @returns Plain object representation of NextPieces.
   */
  public toPlainObject(): NextPiecesPlainObject {
    return {
      nextPiece: this.queue?.[0],
    };
  }
}
