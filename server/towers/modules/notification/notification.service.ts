import { TowersNotificationCreateInput } from "db/models";
import prisma from "@/lib/prisma";
import { getTowersNotificationIncludes, TowersNotificationWithRelations } from "@/types/prisma";

export class NotificationService {
  public static async findById(id: string): Promise<TowersNotificationWithRelations | null> {
    return prisma.towersNotification.findUnique({
      where: { id },
      include: getTowersNotificationIncludes(),
    });
  }

  public static async findAllByPlayerId(playerId: string): Promise<TowersNotificationWithRelations[]> {
    return prisma.towersNotification.findMany({
      where: { playerId },
      include: getTowersNotificationIncludes(),
      orderBy: { createdAt: "desc" },
    });
  }

  public static async create(data: TowersNotificationCreateInput): Promise<TowersNotificationWithRelations> {
    return prisma.towersNotification.create({
      data,
      include: getTowersNotificationIncludes(),
    });
  }

  public static async markAsRead(id: string): Promise<TowersNotificationWithRelations> {
    return prisma.towersNotification.update({
      where: { id },
      data: { readAt: new Date() },
      include: getTowersNotificationIncludes(),
    });
  }

  public static async delete(id: string): Promise<void> {
    await prisma.towersNotification.delete({
      where: { id },
    });
  }
}
