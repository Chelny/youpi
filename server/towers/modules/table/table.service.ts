import { Prisma } from "db/client";
import { TowersTableCreateInput, TowersTableUpdateInput } from "db/models";
import { NUM_TABLE_SEATS } from "@/constants/game";
import prisma from "@/lib/prisma";
import { getTowersTableIncludes, TowersTableWithRelations } from "@/types/prisma";

export class TableService {
  public static async findById(id: string): Promise<TowersTableWithRelations | null> {
    return prisma.towersTable.findUnique({
      where: { id },
      include: getTowersTableIncludes(),
    });
  }

  public static async create(data: TowersTableCreateInput): Promise<TowersTableWithRelations> {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const table: TowersTableWithRelations = await tx.towersTable.create({
        data,
        include: getTowersTableIncludes(),
      });

      await tx.towersTableSeat.createMany({
        data: Array.from({ length: NUM_TABLE_SEATS }).map((_, index: number) => ({
          tableId: table.id,
          seatNumber: index + 1,
          teamNumber: Math.floor(index / 2) + 1,
        })),
      });

      return tx.towersTable.findUniqueOrThrow({
        where: { id: table.id },
        include: getTowersTableIncludes(),
      });
    });
  }

  public static async update(id: string, data: TowersTableUpdateInput): Promise<TowersTableWithRelations> {
    return prisma.towersTable.update({
      where: { id },
      data,
      include: getTowersTableIncludes(),
    });
  }

  public static async delete(id: string): Promise<void> {
    await prisma.towersTable.delete({
      where: { id },
    });
  }
}
