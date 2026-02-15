import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { PlayerManager } from "@/server/towers/modules/player/player.manager";
import { User } from "@/server/youpi/modules/user/user.entity";
import {
  UserRelationship,
  UserRelationshipProps,
} from "@/server/youpi/modules/user-relationship/user-relationship.entity";
import { UserRelationshipFactory } from "@/server/youpi/modules/user-relationship/user-relationship.factory";
import { UserRelationshipService } from "@/server/youpi/modules/user-relationship/user-relationship.service";
import { UserRelationshipWithRelations } from "@/types/prisma";

export class UserRelationshipManager {
  private static cache: Map<string, UserRelationship> = new Map<string, UserRelationship>();

  public static async upsert(props: Optional<UserRelationshipProps, "id">): Promise<UserRelationship | null> {
    const dbUserRelationship: UserRelationshipWithRelations | null = await UserRelationshipService.upsert(
      props.sourceUser.id,
      props.targetUser.id,
      { type: props.type, isMuted: props.isMuted },
    );

    await PlayerManager.updateLastActiveAt(props.sourceUser.id);

    if (!dbUserRelationship) return null;

    return UserRelationshipFactory.createUserRelationship(dbUserRelationship);
  }

  public static async findByUsers(
    sourceUserId: string,
    targetUserId: string,
  ): Promise<UserRelationshipWithRelations | null> {
    return UserRelationshipService.findByUsers(sourceUserId, targetUserId);
  }

  public static async mutedUserIdsFor(sourceUserId: string): Promise<string[]> {
    return UserRelationshipService.mutedUserIdsFor(sourceUserId);
  }

  public static async isMuted(sourceUserId: string, targetUserId: string): Promise<boolean> {
    return UserRelationshipService.isMuted(sourceUserId, targetUserId);
  }

  public static async mute(sourceUser: User, targetUser: User): Promise<void> {
    await this.upsert({ sourceUser, targetUser, isMuted: true });
    await PlayerManager.updateLastActiveAt(sourceUser.id);
    await publishRedisEvent(ServerInternalEvents.USER_RELATIONSHIP_MUTE, { sourceUserId: sourceUser.id });
  }

  public static async unmute(sourceUser: User, targetUser: User): Promise<void> {
    await this.upsert({ sourceUser, targetUser, isMuted: false });
    await PlayerManager.updateLastActiveAt(sourceUser.id);
    await publishRedisEvent(ServerInternalEvents.USER_RELATIONSHIP_UNMUTE, { sourceUserId: sourceUser.id });
  }

  public static async delete(id: string): Promise<void> {
    await UserRelationshipService.delete(id);
    this.cache.delete(id);
  }
}
