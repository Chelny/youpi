import { InstantMessageCreateInput } from "db/models";
import prisma from "@/lib/prisma";
import { getInstantMessageIncludes, InstantMessageWithRelations } from "@/types/prisma";

export class InstantMessageService {
  public static async create(data: InstantMessageCreateInput): Promise<InstantMessageWithRelations> {
    return prisma.instantMessage.create({
      data,
      include: getInstantMessageIncludes(),
    });
  }

  public static async delete(id: string): Promise<void> {
    await prisma.instantMessage.delete({
      where: { id },
    });
  }
}
