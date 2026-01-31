import { RoomLevel } from "db/client";
import { ROOM_MAX_USERS_CAPACITY } from "@/constants/game";
import {
  RoomChatMessage,
  RoomChatMessagePlainObject,
} from "@/server/towers/modules/room-chat-message/room-chat-message.entity";
import { RoomPlayer, RoomPlayerPlainObject } from "@/server/towers/modules/room-player/room-player.entity";
import { Table, TablePlainObject } from "@/server/towers/modules/table/table.entity";
import { UserRelationshipManager } from "@/server/youpi/modules/user-relationship/user-relationship.manager";

export interface RoomProps {
  id: string
  name: string
  level: RoomLevel
  sortOrder: number
  isFull: boolean
}

export interface RoomPlainObject {
  readonly id: string
  readonly name: string
  readonly level: RoomLevel
  readonly players: RoomPlayerPlainObject[]
  readonly chatMessages: RoomChatMessagePlainObject[]
  readonly tables: TablePlainObject[]
}

export type RoomLitePlainObject = Pick<RoomPlainObject, "id" | "name" | "level">;

export class Room {
  public readonly id: string;
  public readonly name: string;
  public readonly level: RoomLevel;
  public readonly sortOrder: number;
  public isFull: boolean;
  private _players: RoomPlayer[] = [];
  public chatMessages: RoomChatMessage[] = [];
  public tables: Table[] = [];

  constructor(props: RoomProps) {
    this.id = props.id;
    this.name = props.name;
    this.level = props.level;
    this.sortOrder = props.sortOrder;
    this.isFull = props.isFull;
  }

  public get players(): RoomPlayer[] {
    return this._players;
  }

  public set players(players: RoomPlayer[]) {
    this._players = players;
    this.isFull = this.players.length >= ROOM_MAX_USERS_CAPACITY;
  }

  public get playersCount(): number {
    return this.players.length;
  }

  public addPlayer(roomPlayer: RoomPlayer): void {
    if (!this.players.some((rp: RoomPlayer) => rp.playerId === roomPlayer.playerId)) {
      this.players.push(roomPlayer);
    }
  }

  public setPlayerTableNumber(playerId: string, tableNumber: number | null): void {
    const roomPlayer: RoomPlayer | undefined = this.players.find((rp: RoomPlayer) => rp.playerId === playerId);

    if (roomPlayer) {
      roomPlayer.tableNumber = tableNumber;
    }
  }

  public updatePlayer(roomPlayer: RoomPlayer): void {
    const index: number = this.players.findIndex((rp: RoomPlayer) => rp.playerId === roomPlayer.playerId);

    if (index === -1) {
      this.addPlayer(roomPlayer);
    } else {
      this.players[index] = roomPlayer;
    }
  }

  public removePlayer(roomPlayer: RoomPlayer): void {
    this.players = this.players.filter((rp: RoomPlayer) => rp.playerId !== roomPlayer.playerId);
  }

  public addChatMessage(message: RoomChatMessage): void {
    this.chatMessages.push(message);
  }

  public addTable(table: Table): void {
    if (!this.tables.some((t: Table) => t.id === table.id)) {
      table.onRemove(() => {
        table.game?.destroy();
        table.game = null;

        this.removeTable(table);
      });

      this.tables.push(table);
    }
  }

  public removeTable(table: Table): void {
    this.tables = this.tables.filter((t: Table) => t.id !== table.id);
  }

  public messagesFor(playerId: string): RoomChatMessage[] {
    const roomPlayer: RoomPlayer | undefined = this.players.find((rp: RoomPlayer) => rp.playerId === playerId);
    if (!roomPlayer) return [];

    return this.chatMessages.filter(async (rcm: RoomChatMessage) => {
      if (rcm.createdAt < roomPlayer.createdAt) {
        return false;
      }

      const mutedUserIds: string[] = await UserRelationshipManager.mutedUserIdsFor(playerId);

      if (mutedUserIds.includes(rcm.player.id)) {
        return false;
      }

      return true;
    });
  }

  public toLitePlainObject(): RoomLitePlainObject {
    return {
      id: this.id,
      name: this.name,
      level: this.level,
    };
  }

  public toPlainObject(): RoomPlainObject {
    return {
      ...this.toLitePlainObject(),
      players: this.players.map((rp: RoomPlayer) => rp.toPlainObject()),
      chatMessages: this.chatMessages.map((rcm: RoomChatMessage) => rcm.toPlainObject()),
      tables: this.tables.map((t: Table) => t.toPlainObject()),
    };
  }
}
