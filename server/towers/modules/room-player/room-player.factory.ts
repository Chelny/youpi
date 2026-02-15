import { PlayerFactory } from "@/server/towers/modules/player/player.factory";
import { RoomFactory } from "@/server/towers/modules/room/room.factory";
import { RoomPlayer } from "@/server/towers/modules/room-player/room-player.entity";
import { TowersRoomPlayerWithRelations } from "@/types/prisma";

export class RoomPlayerFactory {
  public static createRoomPlayer(dbRoomPlayer: TowersRoomPlayerWithRelations): RoomPlayer {
    return new RoomPlayer({
      ...dbRoomPlayer,
      room: RoomFactory.createRoom(dbRoomPlayer.room),
      player: PlayerFactory.createPlayer(dbRoomPlayer.player),
    });
  }
}
