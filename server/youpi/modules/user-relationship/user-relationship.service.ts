import { RelationshipType } from "db/client";
import prisma from "@/lib/prisma";
import { getUserRelationshipIncludes, UserRelationshipWithRelations } from "@/types/prisma";

export class UserRelationshipService {
  public static async upsert(
    sourceUserId: string,
    targetUserId: string,
    data: { type?: RelationshipType; isMuted?: boolean },
  ): Promise<UserRelationshipWithRelations | null> {
    const type: RelationshipType = typeof data.type !== "undefined" ? data.type : RelationshipType.NONE;
    const isMuted: boolean = typeof data.isMuted !== "undefined" ? data.isMuted : false;

    if (type === RelationshipType.NONE && !isMuted) {
      await prisma.userRelationship.deleteMany({
        where: { sourceUserId, targetUserId },
      });

      return null;
    }

    return prisma.userRelationship.upsert({
      where: {
        sourceUserId_targetUserId: { sourceUserId, targetUserId },
      },
      create: {
        sourceUserId,
        targetUserId,
        type,
        isMuted,
      },
      update: {
        ...(typeof data.type !== "undefined" ? { type: data.type } : {}),
        ...(typeof data.isMuted !== "undefined" ? { isMuted: data.isMuted } : {}),
      },
      include: getUserRelationshipIncludes(),
    });
  }

  public static async findByUsers(
    sourceUserId: string,
    targetUserId: string,
  ): Promise<UserRelationshipWithRelations | null> {
    return prisma.userRelationship.findUnique({
      where: {
        sourceUserId_targetUserId: { sourceUserId, targetUserId },
      },
      include: getUserRelationshipIncludes(),
    });
  }
  public static async findMany(args: {
    sourceUserId?: string
    targetUserId?: string
    type?: RelationshipType
    isMuted?: boolean
  }): Promise<UserRelationshipWithRelations[]> {
    const { sourceUserId, targetUserId, type, isMuted } = args;

    return prisma.userRelationship.findMany({
      where: {
        ...(typeof sourceUserId !== "undefined" ? { sourceUserId } : {}),
        ...(typeof targetUserId !== "undefined" ? { targetUserId } : {}),
        ...(typeof type !== "undefined" ? { type } : {}),
        ...(typeof isMuted !== "undefined" ? { isMuted } : {}),
      },
      include: getUserRelationshipIncludes(),
    });
  }

  public static async mutedUserIdsFor(sourceUserId: string): Promise<string[]> {
    const rows: { targetUserId: string }[] = await prisma.userRelationship.findMany({
      where: {
        sourceUserId,
        isMuted: true,
      },
      select: {
        targetUserId: true,
      },
    });

    return rows.map((ur: { targetUserId: string }) => ur.targetUserId);
  }

  public static async isMuted(sourceUserId: string, targetUserId: string): Promise<boolean> {
    const userRelationship: { isMuted: boolean } | null = await prisma.userRelationship.findUnique({
      where: {
        sourceUserId_targetUserId: {
          sourceUserId,
          targetUserId,
        },
      },
      select: {
        isMuted: true,
      },
    });

    return !!userRelationship?.isMuted;
  }

  public static async delete(id: string): Promise<void> {
    await prisma.userRelationship.delete({
      where: { id },
    });
  }

  public static async deleteByUsers(sourceUserId: string, targetUserId: string): Promise<void> {
    await prisma.userRelationship.deleteMany({
      where: { sourceUserId, targetUserId },
    });
  }
}
