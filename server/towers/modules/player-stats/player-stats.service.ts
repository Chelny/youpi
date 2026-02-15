import { TowersPlayerStats } from "db/client";
import { TowersPlayerStatsUpdateInput } from "db/models";
import prisma from "@/lib/prisma";

export class PlayerStatsService {
  public static async findByPlayerId(playerId: string): Promise<TowersPlayerStats | null> {
    return prisma.towersPlayerStats.findUnique({
      where: { playerId },
    });
  }

  public static async create(playerId: string): Promise<TowersPlayerStats> {
    return prisma.towersPlayerStats.create({
      data: {
        playerId,
      },
    });
  }

  public static async update(id: string, data: TowersPlayerStatsUpdateInput): Promise<TowersPlayerStats> {
    return prisma.towersPlayerStats.update({
      where: { id },
      data,
    });
  }
}
