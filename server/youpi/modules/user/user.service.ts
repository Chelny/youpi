import { User, UserSettings } from "db/client";
import prisma from "@/lib/prisma";

export class UserService {
  public static async getUserById(id: string): Promise<(User & { userSettings: UserSettings | null }) | null> {
    return prisma.user.findUnique({
      where: { id },
      include: { userSettings: true },
    });
  }
}
