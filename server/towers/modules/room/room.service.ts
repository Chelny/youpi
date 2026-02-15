import prisma from "@/lib/prisma";
import { getTowersRoomIncludes, TowersRoomWithRelations } from "@/types/prisma";

export class RoomService {
  public static async findById(id: string): Promise<TowersRoomWithRelations | null> {
    return prisma.towersRoom.findUnique({
      where: { id },
      include: getTowersRoomIncludes(),
    });
  }

  public static async findAll(): Promise<TowersRoomWithRelations[]> {
    return prisma.towersRoom.findMany({
      include: getTowersRoomIncludes(),
    });
  }
}
