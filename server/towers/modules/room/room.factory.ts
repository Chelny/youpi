import { TowersRoom } from "db/browser";
import type {
  TowersPlayerLite,
  TowersRoomChatMessageWithRelations,
  TowersRoomPlayerWithRelations,
  TowersRoomsListWithCount,
  TowersRoomWithRelations,
  TowersTableWithRelations,
} from "@/types/prisma";
import { Player } from "@/server/towers/modules/player/player.entity";
import { PlayerFactory } from "@/server/towers/modules/player/player.factory";
import { Room, RoomPlainObject } from "@/server/towers/modules/room/room.entity";
import { RoomManager } from "@/server/towers/modules/room/room.manager";
import { RoomChatMessage } from "@/server/towers/modules/room-chat-message/room-chat-message.entity";
import { RoomPlayer } from "@/server/towers/modules/room-player/room-player.entity";
import { Table } from "@/server/towers/modules/table/table.entity";

export class RoomFactory {
  public static createRoom(dbRoom: TowersRoom): Room {
    return new Room(dbRoom);
  }

  public static convertManyToPlainObject(dbRooms: TowersRoomsListWithCount[]): RoomPlainObject[] {
    return dbRooms.map((dbRoom: TowersRoomsListWithCount) => {
      const room: Room = this.createRoom(dbRoom);
      return room.toPlainObject();
    });
  }

  public static convertToPlainObject(dbRoom: TowersRoomWithRelations, userId: string): RoomPlainObject {
    const room: Room = this.createRoom(dbRoom);

    room.players = dbRoom.players.map((rp: TowersRoomPlayerWithRelations) => {
      const dbPlayer: TowersPlayerLite = rp.player;
      const player: Player = PlayerFactory.createPlayer(dbPlayer);
      const roomPlayer: RoomPlayer = new RoomPlayer({ id: rp.id, room, player });

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

    room.tables = dbRoom.tables.reduce((acc: Table[], t: TowersTableWithRelations) => {
      const roomPlayer: RoomPlayer | undefined = room.players.find((rp: RoomPlayer) => rp.playerId === t.hostPlayerId);
      if (!roomPlayer) return acc;

      acc.push(new Table({ ...t, room, hostPlayer: roomPlayer.player }));

      return acc;
    }, [] as Table[]);

    return RoomManager.roomViewForPlayer(room, userId);
  }
}
