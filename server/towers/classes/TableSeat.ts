import { Player, PlayerPlainObject } from "@/server/towers/classes/Player";
import { Board, BoardPlainObject } from "@/server/towers/game/board/Board";
import { NextPieces, NextPiecesPlainObject } from "@/server/towers/game/NextPieces";
import { PieceBlock } from "@/server/towers/game/PieceBlock";
import { PowerBar, PowerBarPlainObject } from "@/server/towers/game/PowerBar";
import { TowersPieceBlockPowerManager } from "@/server/towers/game/TowersPieceBlockPowerManager";
import { isPowerBarItem } from "@/server/towers/utils/piece-type-check";

export interface TableSeatProps {
  id: string
  tableId: string
  seatNumber: number
  occupiedByPlayer: Player | null
}

export interface TableSeatPlainObject {
  readonly id: string
  readonly tableId: string
  readonly seatNumber: number
  readonly targetNumber: number
  readonly teamNumber: number
  readonly occupiedByPlayerId: string | null
  readonly occupiedByPlayer: PlayerPlainObject | null
  readonly board: BoardPlainObject | null
  readonly nextPieces: NextPiecesPlainObject | null
  readonly powerBar: PowerBarPlainObject | null
}

export class TableSeat {
  public readonly id: string;
  public readonly tableId: string;
  public readonly seatNumber: number;
  public readonly targetNumber: number;
  public readonly teamNumber: number;
  public occupiedByPlayerId: string | null = null;
  private _occupiedByPlayer: Player | null = null;
  public towersPieceBlockPowerManager: TowersPieceBlockPowerManager | null = null;
  public nextPieces: NextPieces | null = null;
  public powerBar: PowerBar | null = null;
  public board: Board | null = null;

  constructor(props: TableSeatProps) {
    this.id = props.id;
    this.tableId = props.tableId;
    this.seatNumber = props.seatNumber;
    this.targetNumber = props.seatNumber;
    this.teamNumber = Math.ceil(props.seatNumber / 2);

    if ("occupiedByPlayer" in props && props.occupiedByPlayer) {
      this.occupiedByPlayerId = props.occupiedByPlayer.id;
      this._occupiedByPlayer = props.occupiedByPlayer;
    }
  }

  public get occupiedByPlayer(): Player | null {
    return this._occupiedByPlayer;
  }

  public set occupiedByPlayer(player: Player | null) {
    this._occupiedByPlayer = player;
    this.occupiedByPlayerId = player?.id ?? null;
  }

  public sit(player: Player): void {
    this.occupiedByPlayer = player;
  }

  public stand(): void {
    this.occupiedByPlayer = null;
  }

  public initialize(): void {
    this.towersPieceBlockPowerManager = new TowersPieceBlockPowerManager();
    this.nextPieces = new NextPieces(this.towersPieceBlockPowerManager);
    this.powerBar = new PowerBar();
    this.board = new Board(this.towersPieceBlockPowerManager, (block: PieceBlock) => {
      if (this.powerBar && isPowerBarItem(block)) {
        this.powerBar.addItem(block);
      }
    });
  }

  public clearSeatGame(): void {
    this.towersPieceBlockPowerManager = null;
    this.nextPieces = null;
    this.powerBar = null;
    this.board = null;
  }

  public toPlainObject(): TableSeatPlainObject {
    return {
      id: this.id,
      tableId: this.tableId,
      seatNumber: this.seatNumber,
      targetNumber: this.targetNumber,
      teamNumber: this.teamNumber,
      occupiedByPlayerId: this.occupiedByPlayerId ?? null,
      occupiedByPlayer: this.occupiedByPlayer ? this.occupiedByPlayer.toPlainObject() : null,
      board: this.board ? this.board.toPlainObject() : null,
      nextPieces: this.nextPieces ? this.nextPieces.toPlainObject() : null,
      powerBar: this.powerBar ? this.powerBar.toPlainObject() : null,
    };
  }
}
