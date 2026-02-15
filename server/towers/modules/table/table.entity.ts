import { GameState, TableChatMessageType, TableType } from "db/client";
import type { Game, GamePlainObject } from "@/server/towers/game/game/game";
import type { Room, RoomLitePlainObject } from "@/server/towers/modules/room/room.entity";
import type {
  TableInvitation,
  TableInvitationPlainObject,
} from "@/server/towers/modules/table-invitation/table-invitation.entity";
import { ServerTowersSeat, ServerTowersTeam } from "@/interfaces/table-seats";
import { Player, PlayerPlainObject } from "@/server/towers/modules/player/player.entity";
import {
  TableChatMessage,
  TableChatMessagePlainObject,
} from "@/server/towers/modules/table-chat-message/table-chat-message.entity";
import { TablePlayer, TablePlayerPlainObject } from "@/server/towers/modules/table-player/table-player.entity";
import { TableSeat, TableSeatPlainObject } from "@/server/towers/modules/table-seat/table-seat.entity";

export interface TableProps {
  id: string
  room: Room
  tableNumber: number
  hostPlayer: Player
  tableType: TableType
  isRated: boolean
}

export interface TablePlainObject {
  readonly id: string
  readonly roomId: string
  readonly room: RoomLitePlainObject
  readonly tableNumber: number
  readonly hostPlayerId: string
  readonly hostPlayer: PlayerPlainObject
  readonly tableType: TableType
  readonly isRated: boolean
  readonly seats: TableSeatPlainObject[]
  readonly players: TablePlayerPlainObject[]
  readonly chatMessages: TableChatMessagePlainObject[]
  readonly invitations: TableInvitationPlainObject[]
  readonly game?: GamePlainObject | null
}

export type TableLitePlainObject = Pick<
  TablePlainObject,
  "id" | "roomId" | "room" | "tableNumber" | "hostPlayerId" | "hostPlayer" | "tableType" | "isRated"
>;

export class Table {
  public readonly id: string;
  public roomId: string;
  private _room: Room;
  public readonly tableNumber: number;
  public hostPlayerId: string;
  private _hostPlayer: Player;
  private _tableType: TableType;
  public isRated: boolean;
  public seats: TableSeat[] = [];
  public players: TablePlayer[] = [];
  public chatMessages: TableChatMessage[] = [];
  public invitations: TableInvitation[] = [];
  public game?: Game | null = null;
  public onRemoveCallbacks: (() => void) | null = null;

  constructor(props: TableProps) {
    this.id = props.id;
    this.roomId = props.room.id;
    this._room = props.room;
    this.tableNumber = props.tableNumber;
    this.hostPlayerId = props.hostPlayer.id;
    this._hostPlayer = props.hostPlayer;
    this._tableType = props.tableType;
    this.isRated = props.isRated;
  }

  public get room(): Room {
    return this._room;
  }

  public set room(room: Room) {
    this._room = room;
    this.roomId = room.id;
  }

  public get hostPlayer(): Player {
    return this._hostPlayer;
  }

  public set hostPlayer(player: Player) {
    this._hostPlayer = player;
    this.hostPlayerId = player.id;
  }

  public get tableType(): TableType {
    return this._tableType;
  }

  public set tableType(tableType: TableType) {
    this._tableType = tableType;
  }

  public isPlayerInTable(playerId: string): boolean {
    return this.players.some((tp: TablePlayer) => tp.playerId === playerId);
  }

  public addPlayer(tablePlayer: TablePlayer): void {
    if (!this.players.some((tp: TablePlayer) => tp.playerId === tablePlayer.playerId)) {
      this.players.push(tablePlayer);
    }
  }

  public getPlayer(playerId: string): TablePlayer | undefined {
    return this.players.find((tp: TablePlayer) => tp.playerId === playerId);
  }

  public updatePlayer(tablePlayer: TablePlayer): void {
    const index: number = this.players.findIndex((tp: TablePlayer) => tp.playerId === tablePlayer.playerId);

    if (index === -1) {
      this.addPlayer(tablePlayer);
    } else {
      this.players[index] = tablePlayer;
    }
  }

  public removePlayer(id: string): void {
    this.players = this.players.filter((tp: TablePlayer) => tp.playerId !== id);
  }

  public addChatMessage(message: TableChatMessage): void {
    this.chatMessages.push(message);
  }

  public addInvitation(invitation: TableInvitation): void {
    if (!this.invitations.some((ti: TableInvitation) => ti.id === invitation.id)) {
      this.invitations.push(invitation);
    }
  }

  public removeInvitation(id: string): void {
    this.invitations = this.invitations.filter((ti: TableInvitation) => ti.id !== id);
  }

  public onRemove(callback: () => void): void {
    this.onRemoveCallbacks = callback;
  }

  public groupSeatsByTeam(): ServerTowersTeam[] {
    const teamMap: Map<number, ServerTowersSeat[]> = new Map<number, ServerTowersSeat[]>();

    for (const tableSeat of this.seats) {
      const teamNumber: number = tableSeat.teamNumber;

      if (!teamMap.has(teamNumber)) {
        teamMap.set(teamNumber, []);
      }

      const tableSeatPlainObject: TableSeatPlainObject = tableSeat.toPlainObject();

      const serverSeat: ServerTowersSeat = {
        ...tableSeatPlainObject,
        targetNumber: tableSeat.seatNumber,
        isReversed: tableSeat.seatNumber % 2 === 0,
      };

      teamMap.get(teamNumber)!.push(serverSeat);
    }

    // Sort seats inside each team by seatNumber
    for (const seats of teamMap.values()) {
      seats.sort((a: ServerTowersSeat, b: ServerTowersSeat) => a.seatNumber - b.seatNumber);
    }

    // Structured teams sorted by teamNumber
    const structuredTeams: ServerTowersTeam[] = [...teamMap.entries()]
      .sort(([aTeamNumber], [bTeamNumber]) => aTeamNumber - bTeamNumber)
      .map(([teamNumber, seats]: [number, ServerTowersSeat[]]): ServerTowersTeam => ({ teamNumber, seats }));

    return structuredTeams;
  }

  public playerQuitsMidGame(tablePlayer: TablePlayer): void {
    if (this.game?.state === GameState.COUNTDOWN || this.game?.state === GameState.PLAYING) {
      this.game.handleUserDepartureMidGame(tablePlayer);
    }
  }

  public async messagesFor(playerId: string, mutedUserIds: string[]): Promise<TableChatMessage[]> {
    const tablePlayer: TablePlayer | undefined = this.players.find((tp: TablePlayer) => tp.playerId === playerId);
    if (!tablePlayer) return [];

    return this.chatMessages.filter(async (tcm: TableChatMessage) => {
      if (mutedUserIds.includes(tcm.player.id) && tcm.type === TableChatMessageType.CHAT) return false;
      return tcm.createdAt >= tablePlayer.createdAt;
    });
  }

  public toLitePlainObject(): TableLitePlainObject {
    return {
      id: this.id,
      roomId: this.roomId,
      room: this.room.toLitePlainObject(),
      tableNumber: this.tableNumber,
      hostPlayerId: this.hostPlayerId,
      hostPlayer: this.hostPlayer?.toPlainObject(),
      tableType: this.tableType,
      isRated: this.isRated,
    };
  }

  public toPlainObject(): TablePlainObject {
    return {
      ...this.toLitePlainObject(),
      seats: this.seats.map((ts: TableSeat) => ts.toPlainObject()),
      players: this.players.map((tp: TablePlayer) => tp.toPlainObject()),
      chatMessages: this.chatMessages.map((tcm: TableChatMessage) => tcm.toPlainObject()),
      invitations: this.invitations?.map((ti: TableInvitation) => ti.toPlainObject()),
    };
  }
}
