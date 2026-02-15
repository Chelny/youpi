import { TowersTableChatMessageCreateInput, TowersTableChatMessageUpdateInput } from "db/models";
import { CHAT_MESSSAGES_LIMIT } from "@/constants/game";
import prisma from "@/lib/prisma";
import { getTowersTableChatMessageIncludes, TowersTableChatMessageWithRelations } from "@/types/prisma";

export class TableChatMessageService {
  public static async findByTableId(tableId: string): Promise<TowersTableChatMessageWithRelations[]> {
    return prisma.towersTableChatMessage.findMany({
      where: { tableId },
      include: getTowersTableChatMessageIncludes(),
      orderBy: { createdAt: "desc" },
      take: CHAT_MESSSAGES_LIMIT,
    });
  }

  public static async create(data: TowersTableChatMessageCreateInput): Promise<TowersTableChatMessageWithRelations> {
    return prisma.towersTableChatMessage.create({
      data,
      include: getTowersTableChatMessageIncludes(),
    });
  }

  public static async update(
    id: string,
    data: TowersTableChatMessageUpdateInput,
  ): Promise<TowersTableChatMessageWithRelations> {
    return prisma.towersTableChatMessage.update({
      where: { id },
      data,
      include: getTowersTableChatMessageIncludes(),
    });
  }

  public static async delete(id: string): Promise<void> {
    await prisma.towersTableChatMessage.delete({
      where: { id },
    });
  }
}
