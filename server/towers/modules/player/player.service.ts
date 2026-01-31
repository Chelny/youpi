import prisma from "@/lib/prisma";
import { getTowersPlayerLiteIncludes, TowersPlayerLite } from "@/types/prisma";

export class PlayerService {
  public static async getPlayerById(id: string): Promise<TowersPlayerLite> {
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
}
