import prisma from "@/lib/prisma";
import { getTowersTableSeatIncludes, TowersTableSeatWithRelations } from "@/types/prisma";

export class TableSeatService {
  public static async createForTable(tableId: string, seatsCount: number): Promise<TowersTableSeatWithRelations[]> {
    await prisma.towersTableSeat.createMany({
      data: Array.from({ length: seatsCount }, (_, i: number) => ({
        tableId,
        seatNumber: i + 1,
        teamNumber: Math.floor(i / 2) + 1,
        occupiedByPlayerId: null,
      })),
    });

    return prisma.towersTableSeat.findMany({
      where: { tableId },
      include: getTowersTableSeatIncludes(),
      orderBy: { seatNumber: "asc" },
    });
  }

  public static async update(id: string, occupiedByPlayerId: string | null = null): Promise<void> {
    await prisma.towersTableSeat.update({
      where: { id },
      data: { occupiedByPlayerId },
    });
  }
}
