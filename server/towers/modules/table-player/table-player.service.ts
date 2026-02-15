import { Prisma } from "db/client";
import prisma from "@/lib/prisma";
import { getTowersTablePlayerIncludes, TowersTablePlayerWithRelations } from "@/types/prisma";

export class TablePlayerService {
  public static async findByTableId(tableId: string, playerId: string): Promise<TowersTablePlayerWithRelations | null> {
    return prisma.towersTablePlayer.findUnique({
      where: { tableId_playerId: { tableId, playerId } },
      include: getTowersTablePlayerIncludes(),
    });
  }

  public static async findAllByPlayerId(playerId: string): Promise<TowersTablePlayerWithRelations[]> {
    return prisma.towersTablePlayer.findMany({
      where: { playerId },
      include: getTowersTablePlayerIncludes(),
    });
  }

  public static async upsert(tableId: string, playerId: string): Promise<TowersTablePlayerWithRelations> {
    try {
      return await prisma.towersTablePlayer.create({
        data: { tableId, playerId },
        include: getTowersTablePlayerIncludes(),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return prisma.towersTablePlayer.findUniqueOrThrow({
          where: { tableId_playerId: { tableId, playerId } },
          include: getTowersTablePlayerIncludes(),
        });
      }

      throw error;
    }
  }

  public static async delete(tableId: string, playerId: string): Promise<void> {
    await prisma.towersTablePlayer.delete({
      where: { tableId_playerId: { tableId, playerId } },
    });
  }
}
