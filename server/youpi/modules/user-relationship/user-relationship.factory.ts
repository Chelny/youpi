import { UserFactory } from "@/server/youpi/modules/user/user.factory";
import {
  UserRelationship,
  UserRelationshipPlainObject,
} from "@/server/youpi/modules/user-relationship/user-relationship.entity";
import { UserRelationshipWithRelations } from "@/types/prisma";

export class UserRelationshipFactory {
  public static createUserRelationship(dbUserRelationship: UserRelationshipWithRelations): UserRelationship {
    return new UserRelationship({
      id: dbUserRelationship.id,
      sourceUser: UserFactory.createUser(dbUserRelationship.sourceUser),
      targetUser: UserFactory.createUser(dbUserRelationship.targetUser),
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
