import { TowersRoom } from "db/client";
import type {
  TowersRoomChatMessageWithRelations,
  TowersRoomPlayerWithRelations,
  TowersRoomWithRelations,
  TowersTablePlayerWithRelations,
  TowersTableSeatWithRelations,
  TowersTableWithRelations,
} from "@/types/prisma";
import { Player } from "@/server/towers/modules/player/player.entity";
import { PlayerFactory } from "@/server/towers/modules/player/player.factory";
import { Room, RoomPlainObject } from "@/server/towers/modules/room/room.entity";
import { RoomChatMessage } from "@/server/towers/modules/room-chat-message/room-chat-message.entity";
import { RoomPlayer } from "@/server/towers/modules/room-player/room-player.entity";
import { Table } from "@/server/towers/modules/table/table.entity";
import { TablePlayer } from "@/server/towers/modules/table-player/table-player.entity";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";

export class RoomFactory {
  public static createRoom(dbRoom: TowersRoom): Room {
    return new Room(dbRoom);
  }

  public static createRoomWithRelations(dbRoom: TowersRoomWithRelations): Room {
    const room: Room = new Room(dbRoom);

    room.players = dbRoom.players.map((rp: TowersRoomPlayerWithRelations) => {
      const player: Player = PlayerFactory.createPlayer(rp.player);
      const roomPlayer: RoomPlayer = new RoomPlayer({ ...rp, room, player });

      roomPlayer.createdAt = rp.createdAt;
      roomPlayer.updatedAt = rp.updatedAt;

      return roomPlayer;
    });

    room.chatMessages = dbRoom.chatMessages.reduce(
      (acc: RoomChatMessage[], rcm: TowersRoomChatMessageWithRelations) => {
        const roomPlayer: RoomPlayer | undefined = room.players.find((rp: RoomPlayer) => rp.playerId === rcm.playerId);
        if (!roomPlayer) return acc;

        acc.push(new RoomChatMessage({ ...rcm, player: roomPlayer.player }));

        return acc;
      },
      [] as RoomChatMessage[],
    );

    room.tables = dbRoom.tables.map((t: TowersTableWithRelations) => {
      const roomPlayer: RoomPlayer | undefined = room.players.find((rp: RoomPlayer) => rp.playerId === t.hostPlayerId);
      const hostPlayer: Player = roomPlayer?.player ?? PlayerFactory.createPlayer(t.hostPlayer);
      const table: Table = new Table({ ...t, room, hostPlayer });

      table.players = t.players.map(
        (tp: TowersTablePlayerWithRelations) =>
          new TablePlayer({
            id: tp.id,
            table,
            player: PlayerFactory.createPlayer(tp.player),
          }),
      );

      table.seats = t.seats.map(
        (ts: TowersTableSeatWithRelations) =>
          new TableSeat({
            id: ts.id,
            tableId: ts.tableId,
            seatNumber: ts.seatNumber,
            occupiedByPlayer: ts.occupiedByPlayer ? PlayerFactory.createPlayer(ts.occupiedByPlayer) : null,
          }),
      );

      return table;
    });

    return room;
  }

  public static convertManyToPlainObject(dbRooms: TowersRoomWithRelations[]): RoomPlainObject[] {
    return dbRooms.map((dbRoom: TowersRoomWithRelations) => {
      const room: Room = this.createRoomWithRelations(dbRoom);
      return room.toPlainObject();
    });
  }
}
