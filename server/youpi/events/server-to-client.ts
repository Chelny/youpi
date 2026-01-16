import { logger } from "better-auth";
import { Redis } from "ioredis";
import { Server as IoServer } from "socket.io";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";

export function youpiServerToClientEvents(redisSub: Redis, io: IoServer): void {
  const channels: string[] = [
    ServerInternalEvents.USER_SETTINGS_AVATAR,
    ServerInternalEvents.USER_RELATIONSHIP_MUTE,
    ServerInternalEvents.USER_RELATIONSHIP_UNMUTE,
    ServerInternalEvents.CONVERSATION_MUTE,
    ServerInternalEvents.CONVERSATION_UNMUTE,
    ServerInternalEvents.CONVERSATION_REMOVE,
    ServerInternalEvents.CONVERSATION_RESTORE,
    ServerInternalEvents.CONVERSATION_MESSAGE_SEND,
    ServerInternalEvents.CONVERSATION_MARK_AS_READ,
  ];

  redisSub.subscribe(...channels, (error: Error | null | undefined) => {
    if (error) return logger.error(error.message);
  });

  redisSub.on("message", async (channel: string, message: string) => {
    const data = JSON.parse(message);

    switch (channel) {
      case ServerInternalEvents.USER_SETTINGS_AVATAR: {
        const { userId, avatarId } = data;
        io.emit(ServerToClientEvents.USER_SETTINGS_AVATAR, { userId, avatarId });
        break;
      }
      case ServerInternalEvents.USER_RELATIONSHIP_MUTE: {
        const { sourceUserId } = data;
        io.to(sourceUserId).emit(ServerToClientEvents.USER_RELATIONSHIP_MUTED);
        break;
      }
      case ServerInternalEvents.USER_RELATIONSHIP_UNMUTE: {
        const { sourceUserId } = data;
        io.to(sourceUserId).emit(ServerToClientEvents.USER_RELATIONSHIP_UNMUTED);
        break;
      }
      case ServerInternalEvents.CONVERSATION_MUTE: {
        const { userId, conversationId, unreadConversationsCount } = data;
        io.to(userId).emit(ServerToClientEvents.CONVERSATION_MUTED, { conversationId });
        io.to(userId).emit(ServerToClientEvents.CONVERSATIONS_UNREAD, { unreadConversationsCount });
        break;
      }
      case ServerInternalEvents.CONVERSATION_UNMUTE: {
        const { userId, conversationId, unreadConversationsCount } = data;
        io.to(userId).emit(ServerToClientEvents.CONVERSATION_UNMUTED, { conversationId });
        io.to(userId).emit(ServerToClientEvents.CONVERSATIONS_UNREAD, { unreadConversationsCount });
        break;
      }
      case ServerInternalEvents.CONVERSATION_REMOVE: {
        const { userId, conversationId, unreadConversationsCount } = data;
        io.to(userId).emit(ServerToClientEvents.CONVERSATION_REMOVED, { conversationId });
        io.to(userId).emit(ServerToClientEvents.CONVERSATIONS_UNREAD, { unreadConversationsCount });
        break;
      }
      case ServerInternalEvents.CONVERSATION_RESTORE: {
        const { userId, conversation, unreadConversationsCount } = data;
        io.to(userId).emit(ServerToClientEvents.CONVERSATION_RESTORED, { conversation });
        io.to(userId).emit(ServerToClientEvents.CONVERSATIONS_UNREAD, { unreadConversationsCount });
        break;
      }
      case ServerInternalEvents.CONVERSATION_MESSAGE_SEND: {
        const { userId, conversation, unreadConversationsCount } = data;
        io.to(userId).emit(ServerToClientEvents.CONVERSATION_MESSAGE_SENT, { conversation });
        io.to(userId).emit(ServerToClientEvents.CONVERSATIONS_UNREAD, { unreadConversationsCount });
        break;
      }
      case ServerInternalEvents.CONVERSATION_MARK_AS_READ: {
        const { userId, conversationId, unreadConversationsCount } = data;
        io.to(userId).emit(ServerToClientEvents.CONVERSATION_MARK_AS_READ, { conversationId });
        io.to(userId).emit(ServerToClientEvents.CONVERSATIONS_UNREAD, { unreadConversationsCount });
        break;
      }
    }
  });
}
