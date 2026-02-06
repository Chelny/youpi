import { Server, Socket } from "socket.io";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { SocketCallback } from "@/interfaces/socket";
import { SocketListener } from "@/server/socket/socket-listener";
import { Conversation } from "@/server/youpi/modules/conversation/conversation.entity";
import { ConversationManager } from "@/server/youpi/modules/conversation/conversation.manager";
import { ConversationParticipant } from "@/server/youpi/modules/conversation-participant/conversation-participant.entity";
import { ConversationParticipantManager } from "@/server/youpi/modules/conversation-participant/conversation-participant.manager";
import { InstantMessageManager } from "@/server/youpi/modules/instant-message/instant-message.manager";
import { User } from "@/server/youpi/modules/user/user.entity";
import { UserManager } from "@/server/youpi/modules/user/user.manager";
import { UserRelationshipManager } from "@/server/youpi/modules/user-relationship/user-relationship.manager";
import { UserSettingsManager } from "@/server/youpi/modules/user-settings/user-settings.manager";

export class YoupiSocketHandler {
  private socketBinder: SocketListener;

  constructor(
    private io: Server,
    private socket: Socket,
    private user: User,
  ) {
    this.socketBinder = new SocketListener(this.socket);
  }

  public registerSocketListeners(): void {
    this.socketBinder.on("disconnect", this.handleDisconnect);

    this.socketBinder.on(ClientToServerEvents.USER_SETTINGS_AVATAR, this.handleSetUserAvatar);
    this.socketBinder.on(ClientToServerEvents.USER_RELATIONSHIP_MUTE_CHECK, this.handleCheckUserMuted);
    this.socketBinder.on(ClientToServerEvents.USER_RELATIONSHIP_MUTE, this.handleMuteUser);
    this.socketBinder.on(ClientToServerEvents.USER_RELATIONSHIP_UNMUTE, this.handleUnmuteUser);
    this.socketBinder.on(ClientToServerEvents.PING_REQUEST, this.handlePingUser);

    this.socketBinder.on(ClientToServerEvents.CONVERSATIONS, this.handleGetConversations);
    this.socketBinder.on(ClientToServerEvents.CONVERSATIONS_UNREAD, this.handleGetUnreadConversations);
    this.socketBinder.on(ClientToServerEvents.CONVERSATION, this.handleGetConversation);
    this.socketBinder.on(ClientToServerEvents.CONVERSATION_MARK_AS_READ, this.handleMarkConversationAsRead);
    this.socketBinder.on(ClientToServerEvents.CONVERSATION_MUTE, this.handleMuteConversation);
    this.socketBinder.on(ClientToServerEvents.CONVERSATION_UNMUTE, this.handleUnmuteConversation);
    this.socketBinder.on(ClientToServerEvents.CONVERSATION_REMOVE, this.handleRemoveConversation);
    this.socketBinder.on(ClientToServerEvents.CONVERSATION_MESSAGE_SEND, this.handleSendInstantMessage);
  }

  private handleDisconnect = (): void => {
    this.socketBinder.dispose();
  };

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

  private handleGetUnreadConversations = (
    {},
    callback: <T>({ success, message, data }: SocketCallback<T>) => void,
  ): void => {
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

  private handleMarkConversationAsRead = async ({ conversationId }: { conversationId: string }): Promise<void> => {
    await ConversationManager.markAsRead(conversationId, this.user.id);
  };

  private handleMuteConversation = async ({ conversationId }: { conversationId: string }): Promise<void> => {
    await ConversationManager.mute(conversationId, this.user.id);
  };

  private handleUnmuteConversation = async ({ conversationId }: { conversationId: string }): Promise<void> => {
    await ConversationManager.unmute(conversationId, this.user.id);
  };

  private handleRemoveConversation = async ({ conversationId }: { conversationId: string }): Promise<void> => {
    await ConversationManager.remove(conversationId, this.user.id);
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
