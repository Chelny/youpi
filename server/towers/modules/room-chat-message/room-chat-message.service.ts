import { TowersRoomChatMessageCreateInput, TowersRoomChatMessageUpdateInput } from "db/models";
import { CHAT_MESSSAGES_LIMIT } from "@/constants/game";
import prisma from "@/lib/prisma";
import { getTowersRoomChatMessageIncludes, TowersRoomChatMessageWithRelations } from "@/types/prisma";

export class RoomChatMessageService {
  public static async findByRoomId(roomId: string): Promise<TowersRoomChatMessageWithRelations[]> {
    return prisma.towersRoomChatMessage.findMany({
      where: { roomId },
      include: getTowersRoomChatMessageIncludes(),
      orderBy: { createdAt: "desc" },
      take: CHAT_MESSSAGES_LIMIT,
    });
  }

  public static async create(data: TowersRoomChatMessageCreateInput): Promise<TowersRoomChatMessageWithRelations> {
    return prisma.towersRoomChatMessage.create({
      data,
      include: getTowersRoomChatMessageIncludes(),
    });
  }

  public static async update(
    id: string,
    data: TowersRoomChatMessageUpdateInput,
  ): Promise<TowersRoomChatMessageWithRelations> {
    return prisma.towersRoomChatMessage.update({
      where: { id },
      data,
      include: getTowersRoomChatMessageIncludes(),
    });
  }

  public static async delete(id: string): Promise<void> {
    await prisma.towersRoomChatMessage.delete({
      where: { id },
    });
  }
}
