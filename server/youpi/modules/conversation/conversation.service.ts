import prisma from "@/lib/prisma";
import { ConversationWithRelations, getConversationIncludes } from "@/types/prisma";

export class ConversationService {
  public static async findById(id: string): Promise<ConversationWithRelations | null> {
    return prisma.conversation.findUnique({
      where: { id },
      include: getConversationIncludes(),
    });
  }

  public static async findAllByUserId(userId: string): Promise<ConversationWithRelations[]> {
    return prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId,
            removedAt: null,
          },
        },
      },
      include: getConversationIncludes(),
    });
  }

  public static async getUnreadCount(userId: string): Promise<number> {
    const messages = await prisma.instantMessage.findMany({
      where: {
        NOT: {
          // Ignore own messages
          userId,
        },
        OR: [{ visibleToUserId: null }, { visibleToUserId: userId }],
        conversation: {
          participants: {
            some: {
              userId,
              mutedAt: null,
              removedAt: null,
            },
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
        conversation: {
          select: {
            participants: {
              where: { userId },
              select: { readAt: true },
            },
          },
        },
      },
    });

    let count: number = 0;

    for (const message of messages) {
      const participant: { readAt: Date | null } = message.conversation.participants[0];
      if (!participant) continue;

      // If participant hasn't read any messages yet, or readAt is before message creation → unread
      if (!participant.readAt || message.createdAt > participant.readAt) {
        count++;
      }
    }

    return count;
  }

  public static async upsert(senderId: string, recipientId: string): Promise<ConversationWithRelations> {
    const conversation: ConversationWithRelations | null = await prisma.conversation.findFirst({
      where: {
        AND: [
          {
            participants: {
              some: { userId: senderId },
            },
          },
          {
            participants: {
              some: { userId: recipientId },
            },
          },
          // Must contain ONLY those two users
          {
            participants: {
              every: {
                userId: {
                  in: [senderId, recipientId],
                },
              },
            },
          },
        ],
      },
      include: getConversationIncludes(),
    });

    if (conversation) return conversation;

    // Create conversation if not found
    return prisma.conversation.create({
      data: {
        participants: {
          create: [{ user: { connect: { id: senderId } } }, { user: { connect: { id: recipientId } } }],
        },
      },
      include: getConversationIncludes(),
    });
  }

  public static async delete(id: string): Promise<void> {
    await prisma.conversation.delete({
      where: { id },
    });
  }
}
