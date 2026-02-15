import prisma from "@/lib/prisma";
import { getTowersPlayerLiteIncludes, TowersPlayerLite } from "@/types/prisma";

export class PlayerService {
  public static async findById(id: string): Promise<TowersPlayerLite> {
    return prisma.towersPlayer.upsert({
      where: { id },
      update: {},
      create: {
        user: { connect: { id } },
        controlKeys: { create: {} },
        stats: { create: {} },
      },
      include: getTowersPlayerLiteIncludes(),
    });
  }

  public static async create(userId: string): Promise<TowersPlayerLite> {
    return prisma.towersPlayer.create({
      data: {
        user: { connect: { id: userId } },
        controlKeys: { create: {} },
        stats: { create: {} },
      },
      include: getTowersPlayerLiteIncludes(),
    });
  }

  public static async updateLastActiveAt(id: string): Promise<TowersPlayerLite> {
    return prisma.towersPlayer.update({
      where: { id },
      data: { lastActiveAt: new Date() },
      include: getTowersPlayerLiteIncludes(),
    });
  }
}
