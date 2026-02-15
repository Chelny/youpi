import type { Table, TableLitePlainObject } from "@/server/towers/modules/table/table.entity";
import { Player, PlayerPlainObject } from "@/server/towers/modules/player/player.entity";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";

export interface TablePlayerProps {
  id: string
  table: Table
  player: Player
}

export interface TablePlayerPlainObject {
  readonly id: string
  readonly tableId: string
  readonly table: TableLitePlainObject
  readonly playerId: string
  readonly player: PlayerPlainObject
  readonly createdAt: string
  readonly updatedAt: string

  // In-memory properties
  readonly seatNumber: number | null
  readonly isReady: boolean
  readonly isPlaying: boolean
}

export class TablePlayer {
  public readonly id: string;
  public tableId: string;
  private _table: Table;
  public playerId: string;
  private _player: Player;
  public createdAt: Date;
  public updatedAt: Date;

  // In-memory properties
  private _seatNumber: number | null = null;
  private _isReady: boolean = false;
  private _isPlaying: boolean = false;

  constructor(props: TablePlayerProps) {
    this.id = props.id;
    this.tableId = props.table.id;
    this._table = props.table;
    this.playerId = props.player.id;
    this._player = props.player;
    this.createdAt = new Date();
    this.updatedAt = this.createdAt;
  }

  public get table(): Table {
    return this._table;
  }

  public set table(table: Table) {
    this._table = table;
    this.tableId = table.id;
  }

  public get tableNumber(): number {
    return this.table.tableNumber;
  }

  public get player(): Player {
    return this._player;
  }

  public set player(player: Player) {
    this._player = player;
    this.playerId = player.id;
  }

  public get seatNumber(): number | null {
    return (
      this._seatNumber ??
      this.table.seats.find((ts: TableSeat) => ts.occupiedByPlayer?.id === this.playerId)?.seatNumber ??
      null
    );
  }

  public set seatNumber(seatNumber: number | null) {
    this._seatNumber = seatNumber;
  }

  public get isReady(): boolean {
    return this.seatNumber !== null && this._isReady;
  }

  public set isReady(isReady: boolean) {
    this._isReady = isReady;
  }

  public get isPlaying(): boolean {
    return this.seatNumber !== null && this._isPlaying;
  }

  public set isPlaying(isPlaying: boolean) {
    this._isPlaying = isPlaying;

    if (isPlaying) {
      this._isReady = false;
    }
  }

  public resetState(): void {
    this.isReady = false;
    this.isPlaying = false;
  }

  public toPlainObject(): TablePlayerPlainObject {
    return {
      id: this.id,
      tableId: this.tableId,
      table: this.table.toLitePlainObject(),
      playerId: this.playerId,
      player: this.player.toPlainObject(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),

      // In-memory properties
      seatNumber: this.seatNumber,
      isReady: this.isReady,
      isPlaying: this.isPlaying,
    };
  }
}
