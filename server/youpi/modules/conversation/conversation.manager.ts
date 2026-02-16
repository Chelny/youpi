import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { Conversation } from "@/server/youpi/modules/conversation/conversation.entity";
import { ConversationFactory } from "@/server/youpi/modules/conversation/conversation.factory";
import { ConversationService } from "@/server/youpi/modules/conversation/conversation.service";
import { ConversationParticipant } from "@/server/youpi/modules/conversation-participant/conversation-participant.entity";
import { ConversationParticipantManager } from "@/server/youpi/modules/conversation-participant/conversation-participant.manager";
import { ConversationParticipantService } from "@/server/youpi/modules/conversation-participant/conversation-participant.service";
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
    return ConversationService.getUnreadCount(userId);
  }

  private static async handleParticipantAction(
    conversationId: string,
    userId: string,
    action: "markAsRead" | "mute" | "unmute" | "remove" | "restore",
    redisEvent: string,
  ): Promise<void> {
    let dbConversation: ConversationWithRelations;

    switch (action) {
      case "markAsRead":
        dbConversation = await ConversationParticipantService.markAsRead(conversationId, userId);
        break;
      case "mute":
        dbConversation = await ConversationParticipantService.mute(conversationId, userId);
        break;
      case "unmute":
        dbConversation = await ConversationParticipantService.unmute(conversationId, userId);
        break;
      case "remove":
        dbConversation = await ConversationParticipantService.remove(conversationId, userId);
        break;
      case "restore":
        dbConversation = await ConversationParticipantService.restore(conversationId, userId);
        break;
      default:
        throw new Error("Unknown action");
    }

    const conversation: Conversation = ConversationFactory.createConversation(dbConversation);
    this.cache.set(conversation.id, conversation);

    const unreadConversationsCount: number = await this.getUnreadConversationsCount(userId);

    await publishRedisEvent(redisEvent, {
      userId,
      conversation: conversation.toPlainObject(),
      unreadConversationsCount,
    });
  }

  public static async markAsRead(conversationId: string, userId: string): Promise<void> {
    this.handleParticipantAction(conversationId, userId, "markAsRead", ServerInternalEvents.CONVERSATION_MARK_AS_READ);
  }

  public static async mute(conversationId: string, userId: string): Promise<void> {
    this.handleParticipantAction(conversationId, userId, "mute", ServerInternalEvents.CONVERSATION_MUTE);
  }

  public static async unmute(conversationId: string, userId: string): Promise<void> {
    this.handleParticipantAction(conversationId, userId, "unmute", ServerInternalEvents.CONVERSATION_UNMUTE);
  }

  public static async remove(conversationId: string, userId: string): Promise<void> {
    this.handleParticipantAction(conversationId, userId, "remove", ServerInternalEvents.CONVERSATION_REMOVE);
  }

  public static async restore(conversationId: string, userId: string): Promise<void> {
    this.handleParticipantAction(conversationId, userId, "restore", ServerInternalEvents.CONVERSATION_RESTORE);
  }

  public static async delete(id: string): Promise<void> {
    await ConversationService.delete(id);
    this.cache.delete(id);
  }
}
