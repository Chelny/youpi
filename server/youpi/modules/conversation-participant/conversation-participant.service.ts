import { Prisma } from "db/client";
import { ConversationParticipantCreateInput, ConversationParticipantUpdateInput } from "db/models";
import prisma from "@/lib/prisma";
import {
  ConversationParticipantWithRelations,
  ConversationWithRelations,
  getConversationIncludes,
  getConversationParticipantIncludes,
} from "@/types/prisma";

export class ConversationParticipantService {
  public static async findById(id: string): Promise<ConversationParticipantWithRelations | null> {
    return prisma.conversationParticipant.findUnique({
      where: { id },
      include: getConversationParticipantIncludes(),
    });
  }

  public static async findAllById(id: string): Promise<ConversationParticipantWithRelations[]> {
    return prisma.conversationParticipant.findMany({
      where: { id },
      include: getConversationParticipantIncludes(),
    });
  }

  public static async findByConversationId(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipantWithRelations | null> {
    return prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      include: getConversationParticipantIncludes(),
    });
  }

  public static async findOtherParticipantByConversationId(
    conversationId: string,
    userId: string,
  ): Promise<ConversationParticipantWithRelations | null> {
    return prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: {
          not: userId,
        },
      },
      include: getConversationParticipantIncludes(),
    });
  }

  private static async findConversationById(
    conversationId: string,
    tx: Prisma.TransactionClient,
  ): Promise<ConversationWithRelations> {
    const conversation: ConversationWithRelations | null = await tx.conversation.findUnique({
      where: { id: conversationId },
      include: getConversationIncludes(),
    });
    if (!conversation) throw new Error("Conversation not found");

    return conversation;
  }

  public static async create(data: ConversationParticipantCreateInput): Promise<ConversationParticipantWithRelations> {
    return prisma.conversationParticipant.create({
      data,
      include: getConversationParticipantIncludes(),
    });
  }

  public static async updateMany(
    userId: string,
    data: ConversationParticipantUpdateInput,
  ): Promise<ConversationParticipantWithRelations[]> {
    await prisma.conversationParticipant.updateMany({
      where: { userId },
      data,
    });

    return prisma.conversationParticipant.findMany({
      where: { userId },
      include: getConversationParticipantIncludes(),
    });
  }

  public static async markAsRead(conversationId: string, userId: string): Promise<ConversationWithRelations> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.conversationParticipant.updateMany({
        where: { conversationId, userId },
        data: { readAt: new Date() },
      });

      return this.findConversationById(conversationId, tx);
    });
  }

  public static async mute(conversationId: string, userId: string): Promise<ConversationWithRelations> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.conversationParticipant.updateMany({
        where: { conversationId, userId, mutedAt: null },
        data: { mutedAt: new Date() },
      });

      return this.findConversationById(conversationId, tx);
    });
  }

  public static async unmute(conversationId: string, userId: string): Promise<ConversationWithRelations> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.conversationParticipant.updateMany({
        where: {
          conversationId,
          userId,
          NOT: {
            mutedAt: null,
          },
        },
        data: { mutedAt: null },
      });

      return this.findConversationById(conversationId, tx);
    });
  }

  public static async remove(conversationId: string, userId: string): Promise<ConversationWithRelations> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.conversationParticipant.updateMany({
        where: { conversationId, userId },
        data: { removedAt: new Date() },
      });

      return this.findConversationById(conversationId, tx);
    });
  }

  public static async restore(conversationId: string, userId: string): Promise<ConversationWithRelations> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.conversationParticipant.updateMany({
        where: { conversationId, userId },
        data: { removedAt: null },
      });

      return this.findConversationById(conversationId, tx);
    });
  }

  public static async delete(id: string): Promise<void> {
    await prisma.conversation.delete({
      where: { id },
    });
  }
}
