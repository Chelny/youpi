import { TowersTableBootCreateInput } from "db/models";
import prisma from "@/lib/prisma";
import { getTowersTableBootIncludes, TowersTableBootWithRelations } from "@/types/prisma";

export class TableBootService {
  public static async findById(id: string): Promise<TowersTableBootWithRelations | null> {
    return prisma.towersTableBoot.findUnique({
      where: { id },
      include: getTowersTableBootIncludes(),
    });
  }

  public static async create(data: TowersTableBootCreateInput): Promise<TowersTableBootWithRelations> {
    return prisma.towersTableBoot.create({
      data,
      include: getTowersTableBootIncludes(),
    });
  }

  public static async delete(id: string): Promise<void> {
    await prisma.towersTableBoot.delete({
      where: { id },
    });
  }
}
