import { ConversationParticipantCreateInput, ConversationParticipantUpdateInput } from "db/models";
import { Conversation } from "@/server/youpi/modules/conversation/conversation.entity";
import { ConversationParticipant } from "@/server/youpi/modules/conversation-participant/conversation-participant.entity";
import { ConversationParticipantFactory } from "@/server/youpi/modules/conversation-participant/conversation-participant.factory";
import { ConversationParticipantService } from "@/server/youpi/modules/conversation-participant/conversation-participant.service";
import { ConversationParticipantWithRelations } from "@/types/prisma";

export class ConversationParticipantManager {
  private static cache: Map<string, ConversationParticipant> = new Map<string, ConversationParticipant>();

  public static async findByConversationId(conversationId: string, userId: string): Promise<ConversationParticipant> {
    const dbConversationParticipant: ConversationParticipantWithRelations | null =
      await ConversationParticipantService.findByConversationId(conversationId, userId);
    if (!dbConversationParticipant) throw new Error("Conversation participant not found");

    const conversationParticipant: ConversationParticipant =
      ConversationParticipantFactory.createConversationParticipant(dbConversationParticipant);
    this.cache.set(conversationParticipant.id, conversationParticipant);

    return conversationParticipant;
  }

  public static async findOtherParticipantByConversationId(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipant> {
    const dbConversationParticipant: ConversationParticipantWithRelations | null =
      await ConversationParticipantService.findOtherParticipantByConversationId(conversationId, userId);
    if (!dbConversationParticipant) throw new Error("Conversation participant not found");

    const conversationParticipant: ConversationParticipant =
      ConversationParticipantFactory.createConversationParticipant(dbConversationParticipant);
    this.cache.set(conversationParticipant.id, conversationParticipant);

    return conversationParticipant;
  }

  public static async create(data: ConversationParticipantCreateInput): Promise<ConversationParticipant> {
    const dbConversationParticipant: ConversationParticipantWithRelations =
      await ConversationParticipantService.create(data);
    const conversationParticipant: ConversationParticipant =
      ConversationParticipantFactory.createConversationParticipant(dbConversationParticipant);
    this.cache.set(conversationParticipant.id, conversationParticipant);
    return conversationParticipant;
  }

  public static async update(userId: string, data: ConversationParticipantUpdateInput): Promise<void> {
    const dbConversationParticipants: ConversationParticipantWithRelations[] =
      await ConversationParticipantService.updateMany(userId, data);

    dbConversationParticipants.map((dbConversationParticipant: ConversationParticipantWithRelations) => {
      const conversationParticipant: ConversationParticipant =
        ConversationParticipantFactory.createConversationParticipant(dbConversationParticipant);
      this.cache.set(conversationParticipant.id, conversationParticipant);

      // TODO: Send event to all user's conversations to update username

      return conversationParticipant;
    });
  }

  public static async getOtherParticipant(conversationId: string, userId: string): Promise<ConversationParticipant> {
    return this.findOtherParticipantByConversationId(conversationId, userId);
  }

  public static async markConversationAsRead(conversationId: string, userId: string): Promise<void> {
    const conversationParticipant: ConversationParticipant = await this.findByConversationId(conversationId, userId);
    conversationParticipant.markAsRead();
    this.cache.set(conversationParticipant.id, conversationParticipant);
  }

  public static async muteConversationForUser(conversationId: string, userId: string): Promise<void> {
    const conversationParticipant: ConversationParticipant = await this.findByConversationId(conversationId, userId);

    if (!conversationParticipant.mutedAt) {
      conversationParticipant.muteConversation();
      this.cache.set(conversationParticipant.id, conversationParticipant);
    }
  }

  public static async unmuteConversationForUser(conversationId: string, userId: string): Promise<void> {
    const conversationParticipant: ConversationParticipant = await this.findByConversationId(conversationId, userId);

    if (conversationParticipant.mutedAt) {
      conversationParticipant.unmuteConversation();
      this.cache.set(conversationParticipant.id, conversationParticipant);
    }
  }

  public static async removeConversationForUser(conversationId: string, userId: string): Promise<void> {
    const conversationParticipant: ConversationParticipant = await this.findByConversationId(conversationId, userId);

    if (!conversationParticipant.removedAt) {
      conversationParticipant.removeConversation();
      this.cache.set(conversationParticipant.id, conversationParticipant);
    }
  }

  public static async restoreConversationForUser(conversation: Conversation, userId: string): Promise<void> {
    const conversationParticipant: ConversationParticipant = await this.findByConversationId(conversation.id, userId);

    if (conversationParticipant.removedAt) {
      conversationParticipant.restoreConversation();
      this.cache.set(conversationParticipant.id, conversationParticipant);
    }
  }

  public static async delete(id: string): Promise<void> {
    await ConversationParticipantService.delete(id);
    this.cache.delete(id);
  }
}
