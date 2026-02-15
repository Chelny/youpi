import { TowersRoomChatMessageCreateInput } from "db/models";
import { CHAT_MESSSAGES_LIMIT } from "@/constants/game";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { PlayerManager } from "@/server/towers/modules/player/player.manager.ts";
import { RoomChatMessage } from "@/server/towers/modules/room-chat-message/room-chat-message.entity";
import { RoomChatMessageFactory } from "@/server/towers/modules/room-chat-message/room-chat-message.factory";
import { RoomChatMessageService } from "@/server/towers/modules/room-chat-message/room-chat-message.service";
import { TowersRoomChatMessageWithRelations } from "@/types/prisma";

export class RoomChatMessageManager {
  private static cache: Map<string, RoomChatMessage> = new Map<string, RoomChatMessage>();

  public static async loadByRoomId(roomId: string): Promise<RoomChatMessage[]> {
    const dbRoomChatMessages: TowersRoomChatMessageWithRelations[] = await RoomChatMessageService.findByRoomId(roomId);

    const messages: RoomChatMessage[] = dbRoomChatMessages.map(
      (dbRoomChatMessage: TowersRoomChatMessageWithRelations) => {
        const roomChatMessage: RoomChatMessage = RoomChatMessageFactory.createRoomChatMessage(dbRoomChatMessage);
        this.cache.set(roomChatMessage.id, roomChatMessage);
        return roomChatMessage;
      },
    );

    const roomMessages: RoomChatMessage[] = Array.from(this.cache.values()).filter(
      (rcm: RoomChatMessage) => rcm.roomId === roomId,
    );
    if (roomMessages.length > CHAT_MESSSAGES_LIMIT) {
      const toDelete: RoomChatMessage[] = roomMessages
        .sort((a: RoomChatMessage, b: RoomChatMessage) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, roomMessages.length - CHAT_MESSSAGES_LIMIT);
      toDelete.forEach((rcm: RoomChatMessage) => this.cache.delete(rcm.id));
    }

    return messages.reverse();
  }

  public static async create(props: TowersRoomChatMessageCreateInput): Promise<RoomChatMessage> {
    const dbRoomChatMessage: TowersRoomChatMessageWithRelations = await RoomChatMessageService.create(props);
    const roomChatMessage: RoomChatMessage = RoomChatMessageFactory.createRoomChatMessage(dbRoomChatMessage);

    this.cache.set(roomChatMessage.id, roomChatMessage);
    await PlayerManager.updateLastActiveAt(roomChatMessage.player.id);

    await publishRedisEvent(ServerInternalEvents.ROOM_MESSAGE_SEND, {
      roomId: roomChatMessage.roomId,
      chatMessage: roomChatMessage.toPlainObject(),
    });

    return roomChatMessage;
  }

  public static async delete(id: string): Promise<void> {
    await RoomChatMessageService.delete(id);
    this.cache.delete(id);
  }
}
