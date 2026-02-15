import { TowersTableInvitationCreateInput, TowersTableInvitationUpdateInput } from "db/models";
import prisma from "@/lib/prisma";
import { getTowersTableInvitationIncludes, TowersTableInvitationWithRelations } from "@/types/prisma";

export class TableInvitationService {
  public static async findById(id: string): Promise<TowersTableInvitationWithRelations | null> {
    return prisma.towersTableInvitation.findUnique({
      where: { id },
      include: getTowersTableInvitationIncludes(),
    });
  }

  public static async findAllByPlayerId(
    tableId: string,
    playerId: string,
  ): Promise<TowersTableInvitationWithRelations[]> {
    return prisma.towersTableInvitation.findMany({
      where: {
        tableId,
        OR: [{ inviterPlayerId: playerId }, { inviteePlayerId: playerId }],
      },
      include: getTowersTableInvitationIncludes(),
    });
  }

  public static async findAllByInviteePlayerId(inviteePlayerId: string): Promise<TowersTableInvitationWithRelations[]> {
    return prisma.towersTableInvitation.findMany({
      where: { inviteePlayerId },
      include: getTowersTableInvitationIncludes(),
    });
  }

  public static async findAllByInviterPlayerId(inviterPlayerId: string): Promise<TowersTableInvitationWithRelations[]> {
    return prisma.towersTableInvitation.findMany({
      where: { inviterPlayerId },
      include: getTowersTableInvitationIncludes(),
    });
  }

  public static async create(data: TowersTableInvitationCreateInput): Promise<TowersTableInvitationWithRelations> {
    return prisma.towersTableInvitation.create({
      data,
      include: getTowersTableInvitationIncludes(),
    });
  }

  public static async update(
    id: string,
    data: TowersTableInvitationUpdateInput,
  ): Promise<TowersTableInvitationWithRelations> {
    return prisma.towersTableInvitation.update({
      where: { id },
      data,
      include: getTowersTableInvitationIncludes(),
    });
  }

  public static async delete(id: string): Promise<void> {
    await prisma.towersTableInvitation.delete({
      where: { id },
    });
  }

  public static async deleteAllByTableIdAndPlayerId(tableId: string, playerId: string): Promise<void> {
    await prisma.towersTableInvitation.deleteMany({
      where: {
        tableId,
        OR: [{ inviterPlayerId: playerId }, { inviteePlayerId: playerId }],
      },
    });
  }
}
