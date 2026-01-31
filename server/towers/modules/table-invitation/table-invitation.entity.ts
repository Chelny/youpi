import { TableInvitationStatus } from "db/client";
import { Player, PlayerPlainObject } from "@/server/towers/modules/player/player.entity";
import { Room, RoomLitePlainObject } from "@/server/towers/modules/room/room.entity";
import { Table, TableLitePlainObject } from "@/server/towers/modules/table/table.entity";

export interface TableInvitationProps {
  id: string
  room: Room
  table: Table
  inviterPlayer: Player
  inviteePlayer: Player
}

export interface TableInvitationPlainObject {
  readonly id: string
  readonly roomId: string
  readonly room: RoomLitePlainObject
  readonly tableId: string
  readonly table: TableLitePlainObject
  readonly inviterPlayerId: string
  readonly inviterPlayer: PlayerPlainObject
  readonly inviteePlayerId: string
  readonly inviteePlayer: PlayerPlainObject
  readonly status: TableInvitationStatus
  readonly declinedReason: string | null
}

export class TableInvitation {
  public readonly id: string;
  public roomId: string;
  private _room: Room;
  public tableId: string;
  private _table: Table;
  public inviterPlayerId: string;
  private _inviterPlayer: Player;
  public inviteePlayerId: string;
  private _inviteePlayer: Player;
  public status: TableInvitationStatus = TableInvitationStatus.PENDING;
  public declinedReason: string | null = null;

  constructor(props: TableInvitationProps) {
    this.id = props.id;
    this.roomId = props.room.id;
    this._room = props.room;
    this.tableId = props.table.id;
    this._table = props.table;
    this.inviterPlayerId = props.inviterPlayer.id;
    this._inviterPlayer = props.inviterPlayer;
    this.inviteePlayerId = props.inviteePlayer.id;
    this._inviteePlayer = props.inviteePlayer;
  }

  public get room(): Room {
    return this._room;
  }

  public set room(room: Room) {
    this._room = room;
    this.roomId = room.id;
  }

  public get table(): Table {
    return this._table;
  }

  public set table(table: Table) {
    this._table = table;
    this.tableId = table.id;
  }

  public get inviterPlayer(): Player {
    return this._inviterPlayer;
  }

  public set inviterPlayer(inviterPlayer: Player) {
    this._inviterPlayer = inviterPlayer;
    this.inviterPlayerId = inviterPlayer.id;
  }

  public get inviteePlayer(): Player {
    return this._inviteePlayer;
  }

  public set inviteePlayer(inviteePlayer: Player) {
    this._inviteePlayer = inviteePlayer;
    this.inviteePlayerId = inviteePlayer.id;
  }

  public toPlainObject(): TableInvitationPlainObject {
    return {
      id: this.id,
      roomId: this.roomId,
      room: this.room.toLitePlainObject(),
      tableId: this.tableId,
      table: this.table.toLitePlainObject(),
      inviterPlayerId: this.inviterPlayerId,
      inviterPlayer: this.inviterPlayer?.toPlainObject(),
      inviteePlayerId: this.inviteePlayerId,
      inviteePlayer: this.inviteePlayer?.toPlainObject(),
      status: this.status,
      declinedReason: this.declinedReason,
    };
  }
}
