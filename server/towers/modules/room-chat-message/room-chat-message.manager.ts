import { createId } from "@paralleldrive/cuid2";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { PlayerManager } from "@/server/towers/modules/player/player.manager.ts";
import {
  RoomChatMessage,
  RoomChatMessageProps,
} from "@/server/towers/modules/room-chat-message/room-chat-message.entity";

export class RoomChatMessageManager {
  private static roomChatMessages: Map<string, RoomChatMessage> = new Map<string, RoomChatMessage>();

  public static get(id: string): RoomChatMessage | undefined {
    return this.roomChatMessages.get(id);
  }

  public static async create(props: Omit<RoomChatMessageProps, "id">): Promise<RoomChatMessage> {
    const roomChatMessage: RoomChatMessage = new RoomChatMessage({ id: createId(), ...props });
    this.roomChatMessages.set(roomChatMessage.id, roomChatMessage);
    PlayerManager.updateLastActiveAt(props.player.id);

    await publishRedisEvent(ServerInternalEvents.ROOM_MESSAGE_SEND, {
      roomId: props.roomId,
      chatMessage: roomChatMessage.toPlainObject(),
    });

    return roomChatMessage;
  }
}
