import { ConversationParticipantCreateInput, ConversationParticipantUpdateInput } from "db/models";
import prisma from "@/lib/prisma";
import { ConversationParticipantWithRelations, getConversationParticipantIncludes } from "@/types/prisma";

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

  public static async delete(id: string): Promise<void> {
    await prisma.conversation.delete({
      where: { id },
    });
  }
}
