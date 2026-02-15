import { TowersPlayerControlKeys } from "db/client";
import { TowersPlayerControlKeysUpdateInput } from "db/models";
import prisma from "@/lib/prisma";

export class PlayerControlKeysService {
  public static async findByPlayerId(playerId: string): Promise<TowersPlayerControlKeys | null> {
    return prisma.towersPlayerControlKeys.findUnique({
      where: { playerId },
    });
  }

  public static async create(playerId: string): Promise<TowersPlayerControlKeys> {
    return prisma.towersPlayerControlKeys.create({
      data: {
        playerId,
      },
    });
  }

  public static async update(id: string, data: TowersPlayerControlKeysUpdateInput): Promise<TowersPlayerControlKeys> {
    return prisma.towersPlayerControlKeys.update({
      where: { id },
      data,
    });
  }
}
