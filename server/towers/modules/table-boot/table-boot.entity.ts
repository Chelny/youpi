import type { Table, TablePlainObject } from "@/server/towers/modules/table/table.entity";
import { Player, PlayerPlainObject } from "@/server/towers/modules/player/player.entity";

export interface TableBootProps {
  id: string
  table: Table
  booterPlayer: Player
  bootedPlayer: Player
}

export interface TableBootPlainObject {
  readonly id: string
  readonly tableId: string
  readonly table: TablePlainObject
  readonly booterPlayerId: string
  readonly booterPlayer: PlayerPlainObject
  readonly bootedPlayerId: string
  readonly bootedPlayer: PlayerPlainObject
}

export class TableBoot {
  public readonly id: string;
  public tableId: string;
  private _table: Table;
  public booterPlayerId: string;
  private _booterPlayer: Player;
  public bootedPlayerId: string;
  private _bootedPlayer: Player;

  constructor(props: TableBootProps) {
    this.id = props.id;
    this.tableId = props.table.id;
    this._table = props.table;
    this.booterPlayerId = props.booterPlayer.id;
    this._booterPlayer = props.booterPlayer;
    this.bootedPlayerId = props.bootedPlayer.id;
    this._bootedPlayer = props.bootedPlayer;
  }

  public get table(): Table {
    return this._table;
  }

  public set table(table: Table) {
    this._table = table;
    this.tableId = table.id;
  }

  public get booterPlayer(): Player {
    return this._booterPlayer;
  }

  public set booterPlayer(booterPlayer: Player) {
    this._booterPlayer = booterPlayer;
    this.booterPlayerId = booterPlayer.id;
  }

  public get bootedPlayer(): Player {
    return this._bootedPlayer;
  }

  public set bootedPlayer(bootedPlayer: Player) {
    this._bootedPlayer = bootedPlayer;
    this.bootedPlayerId = bootedPlayer.id;
  }

  public toPlainObject(): TableBootPlainObject {
    return {
      id: this.id,
      tableId: this.tableId,
      table: this.table.toPlainObject(),
      booterPlayerId: this.booterPlayerId,
      booterPlayer: this.booterPlayer.toPlainObject(),
      bootedPlayerId: this.bootedPlayerId,
      bootedPlayer: this.bootedPlayer.toPlainObject(),
    };
  }
}
