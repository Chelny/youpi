import { UserSettings } from "db/client";
import prisma from "@/lib/prisma";

export class UserSettingsService {
  public static async getUserSettingsById(id: string): Promise<UserSettings | null> {
    return prisma.userSettings.findUnique({ where: { id } });
  }

  public static async updateAvatar(userId: string, avatarId: string): Promise<UserSettings> {
    return prisma.userSettings.update({
      where: { id: userId },
      data: { avatarId },
    });
  }
}
