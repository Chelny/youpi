import { User } from "@/server/youpi/modules/user/user.entity";
import { UserFactory } from "@/server/youpi/modules/user/user.factory";
import {
  UserRelationship,
  UserRelationshipPlainObject,
} from "@/server/youpi/modules/user-relationship/user-relationship.entity";
import { UserRelationshipWithRelations } from "@/types/prisma";

export class UserRelationshipFactory {
  public static createUserRelationship(dbUserRelationship: UserRelationshipWithRelations): UserRelationship {
    const sourceUser: User = UserFactory.createUser(dbUserRelationship.sourceUser);
    const targetUser: User = UserFactory.createUser(dbUserRelationship.targetUser);

    return new UserRelationship({
      id: dbUserRelationship.id,
      sourceUser,
      targetUser,
      type: dbUserRelationship.type,
      blockReason: dbUserRelationship.blockReason,
      isMuted: dbUserRelationship.isMuted,
    });
  }

  public static convertManyToPlainObject(
    dbUserRelationships: UserRelationshipWithRelations[],
  ): UserRelationshipPlainObject[] {
    return dbUserRelationships.map((dbUserRelationship: UserRelationshipWithRelations) => {
      const userRelationship: UserRelationship = this.createUserRelationship(dbUserRelationship);
      return userRelationship.toPlainObject();
    });
  }
}
