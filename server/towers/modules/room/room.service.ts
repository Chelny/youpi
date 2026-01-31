import prisma from "@/lib/prisma";
import { getTowersRoomIncludes, TowersRoomWithRelations } from "@/types/prisma";

export class RoomService {
  public static async getRoomsWithRelations(): Promise<TowersRoomWithRelations[]> {
    return prisma.towersRoom.findMany({
      include: getTowersRoomIncludes(),
    });
  }
}
