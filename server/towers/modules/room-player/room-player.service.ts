import { Prisma } from "db/client";
import prisma from "@/lib/prisma";
import { getTowersRoomPlayerIncludes, TowersRoomPlayerWithRelations } from "@/types/prisma";

export class RoomPlayerService {
  public static async findByRoomId(roomId: string, playerId: string): Promise<TowersRoomPlayerWithRelations | null> {
    return prisma.towersRoomPlayer.findUnique({
      where: { roomId_playerId: { roomId, playerId } },
      include: getTowersRoomPlayerIncludes(),
    });
  }

  public static async findAllByPlayerId(playerId: string): Promise<TowersRoomPlayerWithRelations[]> {
    return prisma.towersRoomPlayer.findMany({
      where: { playerId },
      include: getTowersRoomPlayerIncludes(),
    });
  }

  public static async upsert(roomId: string, playerId: string): Promise<TowersRoomPlayerWithRelations> {
    try {
      return await prisma.towersRoomPlayer.create({
        data: { roomId, playerId },
        include: getTowersRoomPlayerIncludes(),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return prisma.towersRoomPlayer.findUniqueOrThrow({
          where: { roomId_playerId: { roomId, playerId } },
          include: getTowersRoomPlayerIncludes(),
        });
      }

      throw error;
    }
  }

  public static async delete(roomId: string, playerId: string): Promise<void> {
    await prisma.towersRoomPlayer.delete({
      where: { roomId_playerId: { roomId, playerId } },
    });
  }
}
