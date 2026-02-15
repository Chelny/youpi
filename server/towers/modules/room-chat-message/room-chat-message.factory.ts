import { PlayerFactory } from "@/server/towers/modules/player/player.factory";
import { RoomChatMessage } from "@/server/towers/modules/room-chat-message/room-chat-message.entity";
import { TowersRoomChatMessageWithRelations } from "@/types/prisma";

export class RoomChatMessageFactory {
  public static createRoomChatMessage(dbRoomChatMessage: TowersRoomChatMessageWithRelations): RoomChatMessage {
    return new RoomChatMessage({
      ...dbRoomChatMessage,
      player: PlayerFactory.createPlayer(dbRoomChatMessage.player),
    });
  }
}
