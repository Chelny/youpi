import { DisconnectReason, Server, Socket } from "socket.io";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { SocketCallback } from "@/interfaces/socket";
import { Conversation } from "@/server/youpi/classes/Conversation";
import { ConversationParticipant } from "@/server/youpi/classes/ConversationParticipant";
import { User } from "@/server/youpi/classes/User";
import { ConversationManager } from "@/server/youpi/managers/ConversationManager";
import { ConversationParticipantManager } from "@/server/youpi/managers/ConversationPartiticpantManager";
import { InstantMessageManager } from "@/server/youpi/managers/InstantMessageManager";
import { UserManager } from "@/server/youpi/managers/UserManager";
import { UserRelationshipManager } from "@/server/youpi/managers/UserRelationshipManager";
import { UserSettingsManager } from "@/server/youpi/managers/UserSettingsManager";

export class YoupiSocketHandler {
  constructor(
    private io: Server,
    private socket: Socket,
    private user: User,
  ) {}

  public registerSocketListeners(): void {
    this.socket.on(ClientToServerEvents.USER_SETTINGS_AVATAR, this.handleSetUserAvatar);
    this.socket.on(ClientToServerEvents.USER_RELATIONSHIP_MUTE_CHECK, this.handleCheckUserMuted);
    this.socket.on(ClientToServerEvents.USER_RELATIONSHIP_MUTE, this.handleMuteUser);
    this.socket.on(ClientToServerEvents.USER_RELATIONSHIP_UNMUTE, this.handleUnmuteUser);
    this.socket.on(ClientToServerEvents.PING_REQUEST, this.handlePingUser);

    this.socket.on(ClientToServerEvents.CONVERSATIONS, this.handleGetConversations);
    this.socket.on(ClientToServerEvents.CONVERSATIONS_UNREAD, this.handleGetUnreadConversations);
    this.socket.on(ClientToServerEvents.CONVERSATION, this.handleGetConversation);
    this.socket.on(ClientToServerEvents.CONVERSATION_MARK_AS_READ, this.handleMarkConversationAsRead);
    this.socket.on(ClientToServerEvents.CONVERSATION_MUTE, this.handleMuteConversation);
    this.socket.on(ClientToServerEvents.CONVERSATION_UNMUTE, this.handleUnmuteConversation);
    this.socket.on(ClientToServerEvents.CONVERSATION_REMOVE, this.handleRemoveConversation);
    this.socket.on(ClientToServerEvents.CONVERSATION_MESSAGE_SEND, this.handleSendInstantMessage);

    this.socket.on("disconnect", (reason: DisconnectReason) => {
      const shouldCleanup: boolean =
        reason === "forced close" ||
        reason === "server shutting down" ||
        reason === "forced server close" ||
        reason === "client namespace disconnect" ||
        reason === "server namespace disconnect";

      if (shouldCleanup) {
        this.cleanupSocketListeners();
      }
    });
  }

  private cleanupSocketListeners(): void {
    this.socket.off(ClientToServerEvents.USER_SETTINGS_AVATAR, this.handleSetUserAvatar);
    this.socket.off(ClientToServerEvents.USER_RELATIONSHIP_MUTE_CHECK, this.handleCheckUserMuted);
    this.socket.off(ClientToServerEvents.USER_RELATIONSHIP_MUTE, this.handleMuteUser);
    this.socket.off(ClientToServerEvents.USER_RELATIONSHIP_UNMUTE, this.handleUnmuteUser);
    this.socket.off(ClientToServerEvents.PING_REQUEST, this.handlePingUser);

    this.socket.off(ClientToServerEvents.CONVERSATIONS, this.handleGetConversations);
    this.socket.off(ClientToServerEvents.CONVERSATIONS_UNREAD, this.handleGetUnreadConversations);
    this.socket.off(ClientToServerEvents.CONVERSATION, this.handleGetConversation);
    this.socket.off(ClientToServerEvents.CONVERSATION_MARK_AS_READ, this.handleMarkConversationAsRead);
    this.socket.off(ClientToServerEvents.CONVERSATION_MUTE, this.handleMuteConversation);
    this.socket.off(ClientToServerEvents.CONVERSATION_UNMUTE, this.handleUnmuteConversation);
    this.socket.off(ClientToServerEvents.CONVERSATION_REMOVE, this.handleRemoveConversation);
    this.socket.off(ClientToServerEvents.CONVERSATION_MESSAGE_SEND, this.handleSendInstantMessage);
  }

  private handleSetUserAvatar = async (
    { avatarId }: { avatarId: string },
    callback: <T>({ success, message, data }: SocketCallback<T>) => void,
  ): Promise<void> => {
    try {
      await UserSettingsManager.updateUserAvatar(this.user.id, avatarId);
      callback({ success: true });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Error updating the avatar" });
    }
  };

  private handleCheckUserMuted = async (
    { mutedUserId }: { mutedUserId: string },
    callback: <T>({ success, message, data }: SocketCallback<T>) => void,
  ): Promise<void> => {
    try {
      const isUserMuted: boolean = await UserRelationshipManager.isMuted(this.user.id, mutedUserId);
      callback({ success: true, data: isUserMuted });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Error checking if user is muted" });
    }
  };

  private handleMuteUser = async ({ mutedUserId }: { mutedUserId: string }): Promise<void> => {
    if (!(await UserRelationshipManager.isMuted(this.user.id, mutedUserId))) {
      const user: User | undefined = UserManager.get(mutedUserId);
      if (!user) throw new Error("User not found");
      await UserRelationshipManager.mute(this.user, user);
    }
  };

  private handleUnmuteUser = async ({ mutedUserId }: { mutedUserId: string }): Promise<void> => {
    if (await UserRelationshipManager.isMuted(this.user.id, mutedUserId)) {
      const user: User | undefined = UserManager.get(mutedUserId);
      if (!user) throw new Error("User not found");
      await UserRelationshipManager.unmute(this.user, user);
    }
  };

  private handlePingUser = async (
    { userId }: { userId: string },
    callback: <T>({ success, message, data }: SocketCallback<T>) => void,
  ): Promise<void> => {
    const startTime: number = Date.now();

    // Find the target socket
    const sockets = await this.io.fetchSockets();
    const target = sockets.find((socket) => socket.data?.session?.user?.id === userId);

    if (!target) {
      callback({ success: false, message: "Target not found" });
      return;
    }

    try {
      target.timeout(2000).emit(ServerToClientEvents.PING_ECHO, {}, (err: unknown, ok: boolean) => {
        if (err || !ok) {
          callback({ success: false, message: "Ping failed" });
          return;
        }

        const roundTrip: number = Date.now() - startTime;
        callback({ success: true, message: "Ping successfully sent back!", data: { roundTrip } });
      });
    } catch {
      callback({ success: false, message: "Unexpected error" });
    }
  };

  private handleGetConversations = ({}, callback: <T>({ success, message, data }: SocketCallback<T>) => void): void => {
    try {
      const conversations: Conversation[] = ConversationManager.getAllByUserId(this.user.id);
      callback({ success: true, data: conversations.map((c: Conversation) => c.toPlainObject()) });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Error getting conversations" });
    }
  };

  private handleGetUnreadConversations = async (
    {},
    callback: <T>({ success, message, data }: SocketCallback<T>) => void,
  ): Promise<void> => {
    try {
      const unreadConversationsCount: number = ConversationManager.getUnreadConversationsCount(this.user.id);
      callback({ success: true, data: unreadConversationsCount });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Error getting unread messages" });
    }
  };

  private handleGetConversation = (
    { conversationId }: { conversationId: string },
    callback: ({ success, message }: SocketCallback) => void,
  ): void => {
    try {
      const conversation: Conversation | undefined = ConversationManager.get(conversationId);
      if (!conversation) throw Error;

      callback({ success: true, data: conversation.toPlainObject() });
    } catch {
      callback({ success: false });
    }
  };

  private handleMarkConversationAsRead = async ({
    conversationId,
    userId,
  }: {
    conversationId: string
    userId: string
  }): Promise<void> => {
    await ConversationManager.markAsRead(conversationId, userId);
  };

  private handleMuteConversation = async ({
    conversationId,
    userId,
  }: {
    conversationId: string
    userId: string
  }): Promise<void> => {
    await ConversationManager.mute(conversationId, userId);
  };

  private handleUnmuteConversation = async ({
    conversationId,
    userId,
  }: {
    conversationId: string
    userId: string
  }): Promise<void> => {
    await ConversationManager.unmute(conversationId, userId);
  };

  private handleRemoveConversation = async ({
    conversationId,
    userId,
  }: {
    conversationId: string
    userId: string
  }): Promise<void> => {
    await ConversationManager.remove(conversationId, userId);
  };

  private handleSendInstantMessage = (
    { conversationId, recipientId, message }: { conversationId?: string; recipientId?: string; message: string },
    callback: ({ success, message }: SocketCallback) => void,
  ): void => {
    try {
      let conversation: Conversation | undefined;

      if (!conversationId) {
        if (recipientId) {
          conversation = ConversationManager.getOrCreateBetweenUsers(this.user.id, recipientId);
        } else {
          throw Error("recipientId not provided");
        }
      } else {
        conversation = ConversationManager.get(conversationId);
      }

      if (!conversation) throw Error("Conversation not found");

      const conversationParticipant: ConversationParticipant | undefined =
        ConversationParticipantManager.getOtherParticipant(conversation.id, this.user.id);
      if (!conversationParticipant) throw Error("Conversation participant not found");

      InstantMessageManager.sendMessage(conversation.id, this.user, conversationParticipant?.user, message);

      callback({ success: true, message: "Message has been sent.", data: conversation.id });
    } catch (error) {
      callback({ success: false, message: error instanceof Error ? error.message : "Error sending an instant message" });
    }
  };
}
