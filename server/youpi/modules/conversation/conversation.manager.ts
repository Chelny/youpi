import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { Conversation } from "@/server/youpi/modules/conversation/conversation.entity";
import { ConversationFactory } from "@/server/youpi/modules/conversation/conversation.factory";
import { ConversationService } from "@/server/youpi/modules/conversation/conversation.service";
import { ConversationParticipant } from "@/server/youpi/modules/conversation-participant/conversation-participant.entity";
import { ConversationParticipantManager } from "@/server/youpi/modules/conversation-participant/conversation-participant.manager";
import { User } from "@/server/youpi/modules/user/user.entity";
import { ConversationWithRelations } from "@/types/prisma";

export class ConversationManager {
  private static cache: Map<string, Conversation> = new Map<string, Conversation>();

  public static async findById(id: string): Promise<Conversation> {
    const cached: Conversation | undefined = this.cache.get(id);
    if (cached) return cached;

    const dbConversation: ConversationWithRelations | null = await ConversationService.findById(id);
    if (!dbConversation) throw new Error("Conversation not found");

    const conversation: Conversation = ConversationFactory.createConversation(dbConversation);
    this.cache.set(conversation.id, conversation);

    return conversation;
  }

  public static async findAllByUserId(userId: string): Promise<Conversation[]> {
    const dbConversations: ConversationWithRelations[] = await ConversationService.findAllByUserId(userId);

    return dbConversations.map((dbConversation: ConversationWithRelations) => {
      const conversation: Conversation = ConversationFactory.createConversation(dbConversation);
      this.cache.set(conversation.id, conversation);
      return conversation;
    });
  }

  public static async getOrCreateBetweenUsers(senderId: string, recipientId: string): Promise<Conversation> {
    const dbConversation: ConversationWithRelations = await ConversationService.upsert(senderId, recipientId);
    const conversation: Conversation = ConversationFactory.createConversation(dbConversation);
    this.cache.set(conversation.id, conversation);
    return conversation;
  }

  public static async addParticipant(id: string, user: User): Promise<ConversationParticipant> {
    const conversation: Conversation = await this.findById(id);
    const participant: ConversationParticipant = await ConversationParticipantManager.create({
      conversation: {
        connect: { id },
      },
      user: {
        connect: {
          id: user.id,
        },
      },
    });

    conversation.addParticipant(participant);
    this.cache.set(conversation.id, conversation);

    return participant;
  }

  public static async removeParticipant(id: string, participantId: string): Promise<void> {
    const conversation: Conversation = await this.findById(id);
    await ConversationParticipantManager.delete(participantId);
    conversation.removeParticipant(participantId);
    this.cache.set(conversation.id, conversation);
  }

  public static async getUnreadConversationsCount(userId: string): Promise<number> {
    const conversations: Conversation[] = await ConversationManager.findAllByUserId(userId);

    let unreadCount: number = 0;

    for (const conversation of conversations) {
      const participant: ConversationParticipant | undefined = conversation.participants.find(
        (cp: ConversationParticipant) => cp.userId === userId,
      );

      // Ignore muted and removed conversations
      if (!participant || participant.mutedAt || participant.removedAt) continue;

      for (const message of conversation.messages) {
        // Ignore own messages
        if (message.userId === userId) continue;

        // Ignore hidden
        if (message.visibleToUserId && message.visibleToUserId !== userId) continue;

        // If participant hasn't read any messages yet, or readAt is before message creation → unread
        if (!participant.readAt || participant.readAt < message.createdAt) {
          unreadCount++;
        }
      }
    }

    return unreadCount;
  }

  public static async markAsRead(id: string, userId: string): Promise<void> {
    await ConversationParticipantManager.markConversationAsRead(id, userId);

    const conversation: Conversation = await this.findById(id);
    const unreadConversationsCount: number = await ConversationManager.getUnreadConversationsCount(userId);

    await publishRedisEvent(ServerInternalEvents.CONVERSATION_MARK_AS_READ, {
      userId,
      conversation: conversation.toPlainObject(),
      unreadConversationsCount,
    });
  }

  public static async mute(id: string, userId: string): Promise<void> {
    await ConversationParticipantManager.muteConversationForUser(id, userId);

    const conversation: Conversation = await this.findById(id);
    const unreadConversationsCount: number = await ConversationManager.getUnreadConversationsCount(userId);

    await publishRedisEvent(ServerInternalEvents.CONVERSATION_MUTE, {
      userId,
      conversation: conversation.toPlainObject(),
      unreadConversationsCount,
    });
  }

  public static async unmute(id: string, userId: string): Promise<void> {
    await ConversationParticipantManager.unmuteConversationForUser(id, userId);

    const conversation: Conversation = await this.findById(id);
    const unreadConversationsCount: number = await ConversationManager.getUnreadConversationsCount(userId);

    await publishRedisEvent(ServerInternalEvents.CONVERSATION_UNMUTE, {
      userId,
      conversation: conversation.toPlainObject(),
      unreadConversationsCount,
    });
  }

  public static async remove(conversationId: string, userId: string): Promise<void> {
    await ConversationParticipantManager.removeConversationForUser(conversationId, userId);
    const unreadConversationsCount: number = await ConversationManager.getUnreadConversationsCount(userId);

    await publishRedisEvent(ServerInternalEvents.CONVERSATION_REMOVE, {
      userId,
      conversationId,
      unreadConversationsCount,
    });
  }

  public static async restore(id: string, userId: string): Promise<void> {
    const conversation: Conversation = await this.findById(id);
    await ConversationParticipantManager.restoreConversationForUser(conversation, userId);
    const unreadConversationsCount: number = await ConversationManager.getUnreadConversationsCount(userId);

    await publishRedisEvent(ServerInternalEvents.CONVERSATION_RESTORE, {
      userId,
      conversation: conversation.toPlainObject(),
      unreadConversationsCount,
    });
  }

  public static async delete(id: string): Promise<void> {
    await ConversationService.delete(id);
    this.cache.delete(id);
  }
}
